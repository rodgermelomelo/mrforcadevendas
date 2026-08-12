/**
 * Lógica de importação ERP no servidor (porte de scripts/import-erp.ts).
 * Server-only: usa o cliente service role. Logs sempre sanitizados (sem PII).
 */
import { parseDadosV4, type ParsedRecords, type ParseResult } from "@/lib/erp/parser/dados-v4";
import { diagnoseCatalog, type CatalogDiagnosis } from "@/lib/erp/catalog-diagnosis";

/** Configuração administrativa do nível de preço por tabela. */
export const PRICE_LEVEL_MAP: Record<string, number> = {
  "002": 1,
  "012": 1,
  "033": 1,
  "053": 2,
  "055": 2,
  "061": 1,
};

const CHUNK = 500;

/** Reconstrói os bytes Latin-1 enviados pelo browser (1 char = 1 byte). */
export function bytesFromLatin1String(content: string): Uint8Array {
  const bytes = new Uint8Array(content.length);
  for (let i = 0; i < content.length; i += 1) bytes[i] = content.charCodeAt(i) & 0xff;
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function parseUpload(content: string): { bytes: Uint8Array; result: ParseResult } {
  const bytes = bytesFromLatin1String(content);
  return { bytes, result: parseDadosV4(bytes) };
}

export interface ImportEntities {
  product_groups: Record<string, unknown>[];
  segments: Record<string, unknown>[];
  billing_methods: Record<string, unknown>[];
  price_tables: Record<string, unknown>[];
  erp_sellers: Record<string, unknown>[];
  products: Record<string, unknown>[];
  product_prices: Record<string, unknown>[];
  inventory_snapshots: Record<string, unknown>[];
  catalog_review: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  customer_seller_links: Record<string, unknown>[];
}

/** Monta as entidades do banco a partir dos registros do arquivo (mesma lógica do script). */
export function buildEntities(records: ParsedRecords): ImportEntities {
  const product_groups = records.productGroups.map((g) => ({ code: g.erpCode, name: g.label || g.erpCode }));
  const segments = records.segments.map((s) => ({ code: s.erpCode, name: s.label || s.erpCode }));
  const billing_methods = records.billingMethods.map((b) => ({ code: b.erpCode, description: b.label || b.erpCode }));
  const price_tables = records.priceTables.map((t) => ({
    code: t.erpCode,
    name: t.label || t.erpCode,
    mapped_level: PRICE_LEVEL_MAP[t.erpCode] ?? null,
    level_label: PRICE_LEVEL_MAP[t.erpCode] !== undefined ? `Valor ${PRICE_LEVEL_MAP[t.erpCode]! + 1}` : null,
  }));

  // Vendedores: código canônico de 3 dígitos + placeholders p/ reps citados por clientes.
  const sellers = new Map<string, { erp_code: string; name: string; active: boolean }>();
  for (const s of records.sellers) {
    const code3 = s.erpCode.slice(0, 3);
    if (!sellers.has(code3)) {
      sellers.set(code3, { erp_code: code3, name: s.name || `Representante ${code3}`, active: !s.inactiveHint });
    }
  }
  for (const c of records.customers) {
    if (!sellers.has(c.erpSellerCode)) {
      sellers.set(c.erpSellerCode, {
        erp_code: c.erpSellerCode,
        name: `Representante ${c.erpSellerCode}`,
        active: false,
      });
    }
  }

  const products = records.products.map((p) => {
    // Tenta extrair a marca e a categoria da descrição oficial
    const desc = (p.officialDescription || "").toUpperCase();
    let brand = "OUTROS";
    let category = "DIVERSOS";

    // 1. Identificar MARCA
    // Prioridade para marcas conhecidas na descrição
    if (desc.includes("DAILUS")) brand = "DAILUS";
    else if (desc.includes("ACEMAR")) brand = "ACEMAR";
    else if (desc.includes("ÁGUA DE CHEIRO")) brand = "ÁGUA DE CHEIRO";
    else if (desc.includes("DIVINA FLORA")) brand = "DIVINA FLORA";
    else if (desc.includes("CUCCIO")) brand = "CUCCIO";
    else if (desc.includes("VERNISSAGE")) brand = "VERNISSAGE";
    else if (desc.includes("FOX")) brand = "FOX";
    
    // Fallback de marca pelo grupo ERP
    if (brand === "OUTROS" && p.erpGroupCode) {
      const g = records.productGroups.find(group => group.erpCode === p.erpGroupCode);
      if (g?.label) {
        const parts = g.label.trim().split(/\s*-\s*|\s+/);
        const groupFirstPart = parts[0] ? parts[0].toUpperCase() : g.label.toUpperCase();
        
        const KNOWN_BRANDS = ["DAILUS", "ACEMAR", "ÁGUA DE CHEIRO", "DIVINA FLORA", "CUCCIO", "VERNISSAGE", "FOX"];
        if (KNOWN_BRANDS.includes(groupFirstPart)) {
          brand = groupFirstPart;
        }
      }
    }

    // 2. Identificar CATEGORIA
    const categories = [
      "AMACIANTE", "AMOLECEDOR", "BASE", "BATOM", "BLUSH", "ESMALTE", 
      "PINCEL", "PÓ COMPACTO", "CORRETIVO", "ILUMINADOR", "MÁSCARA", 
      "DELINEADOR", "SOMBRA", "REMOVEDOR", "HIDRATANTE", "SABONETE",
      "PERFUME", "COLÔNIA", "BODY SPLASH", "ÓLEO", "SHAMPOO", "CONDICIONADOR",
      "LAPIS", "LENÇO", "MANTEIGA", "TOALHA", "LAPISEIRA"
    ];

    for (const cat of categories) {
      if (desc.includes(cat)) {
        category = cat;
        break;
      }
    }

    // Heurística específica para ACEMAR: O grupo ERP é a categoria real (ex: ACEMAR - ACESSORIOS)
    if (brand === "ACEMAR" && p.erpGroupCode) {
      const g = records.productGroups.find(group => group.erpCode === p.erpGroupCode);
      if (g?.label) {
        const labelUpper = g.label.toUpperCase();
        if (labelUpper.includes("ACEMAR")) {
          const parts = g.label.split(/\s*-\s*/);
          if (parts.length > 1) {
            category = (parts[1] || "").trim().toUpperCase() || category;
          } else {
            const clean = labelUpper.replace("ACEMAR", "").trim();
            if (clean) category = clean;
          }
        }
      }
    }

    // Fallback de categoria se ainda for DIVERSOS
    if (category === "DIVERSOS" && p.erpGroupCode) {
      const g = records.productGroups.find(group => group.erpCode === p.erpGroupCode);
      if (g?.label) {
        let groupName = g.label.toUpperCase();
        const cleanCategory = groupName.replace(brand, "").replace(/^-/, "").trim();
        if (cleanCategory) category = cleanCategory;
      }
    }
    
    return {
      erp_code: p.erpCode,
      name: p.officialDescription || `Produto ${p.erpCode}`,
      group_code: p.erpGroupCode || null,
      brand: brand.toUpperCase(),
      category: category.toUpperCase(),
      unit: p.unit || "UN",
      is_launch: false,
      released: !p.erpCode.startsWith("Z"),
      active: !p.erpCode.startsWith("Z"),
    };
  });

  const product_prices = records.prices.map((pr) => ({
    product_erp_code: pr.erpProductCode,
    price_table_code: pr.erpPriceTableCode,
    value_1: pr.values[0] ?? 0,
    value_2: pr.values[1] ?? 0,
    value_3: pr.values[2] ?? 0,
    value_4: pr.values[3] ?? 0,
    value_5: pr.values[4] ?? 0,
    value_6: pr.values[5] ?? 0,
  }));

  const inventory_snapshots = records.inventory.map((inv) => ({
    product_erp_code: inv.erpProductCode,
    quantity: inv.quantity ?? 0,
    captured_at: new Date().toISOString(),
  }));

  // Dedup por erp_code: o ERP traz ~16 códigos de cliente repetidos; sem isso o
  // upsert em lote falha com "ON CONFLICT ... cannot affect row a second time".
  // Última ocorrência vence.
  const customersByCode = new Map<string, Record<string, unknown>>();
  const customerSellerLinksByKey = new Map<string, Record<string, unknown>>();
  for (const c of records.customers) {
    customersByCode.set(c.erpCode, {
      erp_code: c.erpCode,
      legal_name: c.legalName || `CLIENTE ${c.erpCode}`,
      trade_name: c.tradeName || c.legalName || `CLIENTE ${c.erpCode}`,
      tax_id: c.taxId || "",
      city: c.city || "",
      uf: c.uf || "",
      price_table_code: c.priceTableCode || "000",
      seller_erp_code: c.erpSellerCode,
      credit_limit: c.creditLimit ?? 0,
      restricted: false,
      active: true,
    });
    customerSellerLinksByKey.set(`${c.erpCode}\u0001${c.erpSellerCode}`, {
      customer_erp_code: c.erpCode,
      seller_erp_code: c.erpSellerCode,
      price_table_code: c.priceTableCode || "000",
      payment_term: "",
      segment_code: null,
      active: true,
      source: "erp",
    });
  }
  const customers = [...customersByCode.values()];
  const customer_seller_links = [...customerSellerLinksByKey.values()];

  // Diagnóstico → catalog_review
  const catalogCodes = new Set(records.products.map((p) => p.erpCode));
  const stockCodes = new Set(records.inventory.map((i) => i.erpProductCode));
  const priceCodes = new Set(records.prices.map((p) => p.erpProductCode));
  const stockByCode = new Map(records.inventory.map((i) => [i.erpProductCode, i.quantity ?? 0]));
  const catalog_review: Record<string, unknown>[] = [];
  for (const p of records.products) {
    const q = stockByCode.get(p.erpCode);
    const hasPrice = priceCodes.has(p.erpCode);
    const detail = q === undefined ? "sem_estoque" : q < 0 ? "estoque_negativo" : q === 0 ? "estoque_zero" : "estoque_ok";
    catalog_review.push({
      erp_code: p.erpCode,
      classification: "catalogo",
      detail: `${detail}${hasPrice ? "" : ";sem_preco"}`,
    });
  }
  for (const code of stockCodes) {
    if (!catalogCodes.has(code)) catalog_review.push({ erp_code: code, classification: "somente_estoque", detail: null });
  }
  for (const code of priceCodes) {
    if (!catalogCodes.has(code) && !stockCodes.has(code)) {
      catalog_review.push({ erp_code: code, classification: "somente_preco", detail: null });
    }
  }

  return {
    product_groups,
    segments,
    billing_methods,
    price_tables,
    erp_sellers: [...sellers.values()],
    products,
    product_prices,
    inventory_snapshots,
    catalog_review,
    customers,
    customer_seller_links,
  };
}

export interface StagingSummary {
  ok: boolean;
  parserVersion: string;
  layoutVersion: string | null;
  generatedDate: string | null;
  generatedTime: string | null;
  fileBytes: number;
  logicalCount: number;
  trailerCount: number | null;
  countsMatch: boolean;
  reconstructedRecords: number;
  emptyLines: number;
  typeCounts: { type: string; label: string; count: number }[];
  errors: { line: number; type: string; code: string; message: string }[];
  diagnosis: CatalogDiagnosis;
  entityCounts: Record<string, number>;
  fileHash: string;
  alreadyPublished: boolean;
}

export function summarize(
  result: ParseResult,
  entities: ImportEntities,
  fileHash: string,
  alreadyPublished: boolean,
): StagingSummary {
  const { report, records, errors } = result;
  return {
    ok: report.ok,
    parserVersion: report.parserVersion,
    layoutVersion: report.layoutVersion,
    generatedDate: report.generatedDate,
    generatedTime: report.generatedTime,
    fileBytes: report.fileBytes,
    logicalCount: report.logicalCount,
    trailerCount: report.trailerCount,
    countsMatch: report.countsMatch,
    reconstructedRecords: report.reconstructedRecords,
    emptyLines: report.emptyLines,
    typeCounts: report.typeCounts.map((t) => ({ type: t.type, label: t.label, count: t.count })),
    errors: errors.slice(0, 25),
    diagnosis: diagnoseCatalog(records),
    entityCounts: Object.fromEntries(
      Object.entries(entities).map(([k, v]) => [k, (v as unknown[]).length]),
    ),
    fileHash,
    alreadyPublished,
  };
}

type AdminClient = any;

/** Upsert idempotente em lotes (deduplicando pela chave de conflito). */
export async function upsertAll(
  sb: AdminClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<number> {
  const keys = onConflict.split(",").map((k) => k.trim());
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    byKey.set(keys.map((k) => String(row[k] ?? "")).join("\u0001"), row);
  }
  const unique = [...byKey.values()];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { error } = await sb.from(table).upsert(unique.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
  return unique.length;
}


/** Publica todas as entidades (ordem de dependência). */
export async function publishEntities(sb: AdminClient, e: ImportEntities): Promise<Record<string, number>> {
  const done: Record<string, number> = {};
  done["product_groups"] = await upsertAll(sb, "product_groups", e.product_groups, "code");
  done["segments"] = await upsertAll(sb, "segments", e.segments, "code");
  done["billing_methods"] = await upsertAll(sb, "billing_methods", e.billing_methods, "code");
  done["price_tables"] = await upsertAll(sb, "price_tables", e.price_tables, "code");
  done["erp_sellers"] = await upsertAll(sb, "erp_sellers", e.erp_sellers, "erp_code");
  done["products"] = await upsertAll(sb, "products", e.products, "erp_code");
  
  const distinctBrands = [...new Set(e.products.map(p => p['brand'] as string))].filter(Boolean);
  if (distinctBrands.length > 0) {
    const brandRows = distinctBrands.map(name => ({ name, active: true }));
    await sb.from("brands").upsert(brandRows, { onConflict: "name", ignoreDuplicates: true });
  }

  const allProducts = await sb.from("products").select("erp_code, brand, category").eq("active", true);
  if (allProducts.data) {
    const brandsWithHierarchy = new Map<string, Set<string>>();
    for (const p of allProducts.data) {
      if (p.brand && p.category && p.brand !== "OUTROS" && p.category !== "DIVERSOS") {
        const categories = brandsWithHierarchy.get(p.brand) || new Set();
        categories.add(p.category);
        brandsWithHierarchy.set(p.brand, categories);
      }
    }

    for (const [brandName, brandCategories] of brandsWithHierarchy.entries()) {
      const categoryRows = Array.from(brandCategories).map(cat => ({
        name: cat,
        active: true,
        metadata: { isCategory: true, parentBrand: brandName }
      }));
      await sb.from("brands").upsert(categoryRows, { onConflict: "name", ignoreDuplicates: true });
      
      const { data: brandRow } = await sb.from("brands").select("metadata").eq("name", brandName).single();
      const currentMeta = brandRow?.metadata || {};
      const updatedMeta = { ...currentMeta, categories: Array.from(brandCategories) };
      await sb.from("brands").update({ metadata: updatedMeta }).eq("name", brandName);
    }
  }

  done["product_prices"] = await upsertAll(sb, "product_prices", e.product_prices, "product_erp_code,price_table_code");
  done["inventory_snapshots"] = await upsertAll(sb, "inventory_snapshots", e.inventory_snapshots, "product_erp_code");
  done["catalog_review"] = await upsertAll(sb, "catalog_review", e.catalog_review, "erp_code");
  done["customers"] = await upsertAll(sb, "customers", e.customers, "erp_code");
  done["customer_seller_links"] = await upsertAll(
    sb,
    "customer_seller_links",
    e.customer_seller_links,
    "customer_erp_code,seller_erp_code",
  );
  return done;
}
