/**
 * Lógica de importação ERP no servidor (porte de scripts/import-erp.ts).
 * Server-only: usa o cliente service role. Logs sempre sanitizados (sem PII).
 */
import { parseDadosV4, type ParsedRecords, type ParseResult } from "@/lib/erp/parser/dados-v4";
import { diagnoseCatalog, type CatalogDiagnosis } from "@/lib/erp/catalog-diagnosis";
import { inferProductTaxonomy, productGroupLabelMap } from "@/lib/erp/product-taxonomy";
import { sanitizeMessage } from "@/lib/erp/parser/sanitize";
import {
  resolveCustomerSegments,
  type SegmentAuditEntry,
  type SegmentAuditStatus,
  type SegmentColumnDetection,
} from "@/lib/erp/customer-segments";

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

export interface CatalogImportImpact {
  incomingProducts: number;
  existingProducts: number;
  newProducts: number;
  missingProducts: number;
  newGroups: number;
  taxonomySuggestions: number;
  preservedCuratedProducts: number;
  newProductSamples: string[];
  missingProductSamples: string[];
  newGroupSamples: string[];
}

/** Monta as entidades do banco a partir dos registros do arquivo (mesma lógica do script). */
export function buildEntities(records: ParsedRecords): ImportEntities {
  const groupLabel = productGroupLabelMap(records.productGroups);
  const product_groups = records.productGroups.map((g) => ({ code: g.erpCode, name: g.label || g.erpCode }));
  const segments = records.segments.map((s) => ({
    code: s.erpCode,
    name: s.label || s.erpCode,
    active: true
  }));
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
    const suggestion = inferProductTaxonomy(p, groupLabel.get(p.erpGroupCode));
    return {
      erp_code: p.erpCode,
      name: p.officialDescription || `Produto ${p.erpCode}`,
      group_code: p.erpGroupCode || null,
      unit: p.unit || "UN",
      erp_brand_suggestion: suggestion.brand,
      erp_category_suggestion: suggestion.category,
      erp_segment_suggestion: suggestion.segment,
      erp_taxonomy_updated_at: new Date().toISOString(),
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
      // null = arquivo não trouxe o limite → preserva o valor já cadastrado
      // (ver upsertCustomersPreservingCredit).
      credit_limit: c.creditLimit ?? null,
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
  catalogImpact?: CatalogImportImpact | undefined;
}

export function summarize(
  result: ParseResult,
  entities: ImportEntities,
  fileHash: string,
  alreadyPublished: boolean,
  catalogImpact?: CatalogImportImpact,
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
    catalogImpact,
  };
}

type AdminClient = any;

async function fetchAllRows(
  db: AdminClient,
  table: string,
  select = "*",
  apply?: (query: any) => any,
): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    let query = db.from(table).select(select);
    if (apply) query = apply(query);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new Error(`select ${table}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export async function analyzeCatalogImpact(sb: AdminClient, e: ImportEntities): Promise<CatalogImportImpact> {
  const [existingProducts, existingGroups] = await Promise.all([
    fetchAllRows(sb, "products", "erp_code, brand, category, released, active, is_launch"),
    fetchAllRows(sb, "product_groups", "code"),
  ]);
  const incomingProductCodes = new Set(e.products.map((p) => String(p["erp_code"])));
  const existingProductCodes = new Set(existingProducts.map((p: any) => String(p.erp_code)));
  const incomingGroupCodes = new Set(e.product_groups.map((g) => String(g["code"])));
  const existingGroupCodes = new Set(existingGroups.map((g: any) => String(g.code)));

  const newProductSamples = [...incomingProductCodes]
    .filter((code) => !existingProductCodes.has(code))
    .sort()
    .slice(0, 8);
  const missingProductSamples = [...existingProductCodes]
    .filter((code) => !incomingProductCodes.has(code))
    .sort()
    .slice(0, 8);
  const newGroupSamples = [...incomingGroupCodes]
    .filter((code) => !existingGroupCodes.has(code))
    .sort()
    .slice(0, 8);
  const newProductCodes = [...incomingProductCodes].filter((code) => !existingProductCodes.has(code));
  const missingProductCodes = [...existingProductCodes].filter((code) => !incomingProductCodes.has(code));
  const newGroupCodes = [...incomingGroupCodes].filter((code) => !existingGroupCodes.has(code));

  const preservedCuratedProducts = existingProducts.filter((product: any) => {
    if (!incomingProductCodes.has(String(product.erp_code))) return false;
    return Boolean(product.brand || product.category || product.released === false || product.active === false || product.is_launch);
  }).length;

  return {
    incomingProducts: incomingProductCodes.size,
    existingProducts: existingProductCodes.size,
    newProducts: newProductCodes.length,
    missingProducts: missingProductCodes.length,
    newGroups: newGroupCodes.length,
    taxonomySuggestions: e.products.filter((p) => p["erp_brand_suggestion"] || p["erp_category_suggestion"]).length,
    preservedCuratedProducts,
    newProductSamples,
    missingProductSamples,
    newGroupSamples,
  };
}

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

async function upsertProductsPreservingCatalog(sb: AdminClient, rows: Record<string, unknown>[]): Promise<number> {
  const existingRows = await fetchAllRows(sb, "products", "erp_code, brand, category, released, active, is_launch");
  const existingByCode = new Map(existingRows.map((row: any) => [String(row.erp_code), row]));
  const protectedRows = rows.map((row) => {
    const existing = existingByCode.get(String(row["erp_code"]));
    return {
      ...row,
      brand: existing?.brand ?? null,
      category: existing?.category ?? null,
      released: existing?.released ?? true,
      active: existing?.active ?? true,
      is_launch: existing?.is_launch ?? false,
    };
  });
  return upsertAll(sb, "products", protectedRows, "erp_code");
}

/**
 * Clientes: quando o arquivo do ERP não traz limite de crédito (null), mantém o
 * valor já cadastrado (que pode ter sido ajustado manualmente por um admin).
 * Nunca zera um limite existente por ausência de dado no arquivo.
 */
async function upsertCustomersPreservingCredit(
  sb: AdminClient,
  rows: Record<string, unknown>[],
): Promise<number> {
  const existingRows = await fetchAllRows(sb, "customers", "erp_code, credit_limit");
  const existingByCode = new Map(
    existingRows.map((row: any) => [String(row.erp_code), Number(row.credit_limit ?? 0)]),
  );
  const merged = rows.map((row) => {
    const incoming = row["credit_limit"];
    if (incoming !== null && incoming !== undefined && Number(incoming) > 0) return row;
    return { ...row, credit_limit: existingByCode.get(String(row["erp_code"])) ?? 0 };
  });
  return upsertAll(sb, "customers", merged, "erp_code");
}

/** Publica todas as entidades (ordem de dependência). */
export async function publishEntities(sb: AdminClient, e: ImportEntities): Promise<Record<string, number>> {
  const done: Record<string, number> = {};
  done["product_groups"] = await upsertAll(sb, "product_groups", e.product_groups, "code");
  done["segments"] = await upsertAll(sb, "segments", e.segments, "code");
  done["billing_methods"] = await upsertAll(sb, "billing_methods", e.billing_methods, "code");
  done["price_tables"] = await upsertAll(sb, "price_tables", e.price_tables, "code");
  done["erp_sellers"] = await upsertAll(sb, "erp_sellers", e.erp_sellers, "erp_code");
  done["products"] = await upsertProductsPreservingCatalog(sb, e.products);

  done["product_prices"] = await upsertAll(sb, "product_prices", e.product_prices, "product_erp_code,price_table_code");
  done["inventory_snapshots"] = await upsertAll(sb, "inventory_snapshots", e.inventory_snapshots, "product_erp_code");
  done["catalog_review"] = await upsertAll(sb, "catalog_review", e.catalog_review, "erp_code");
  done["customers"] = await upsertCustomersPreservingCredit(sb, e.customers);
  done["customer_seller_links"] = await upsertAll(
    sb,
    "customer_seller_links",
    e.customer_seller_links,
    "customer_erp_code,seller_erp_code",
  );
  return done;
}

/* ========================= IMPORTAÇÃO DE SEGMENTOS ======================== */

export interface SegmentImportOutcome {
  detection: SegmentColumnDetection;
  totals: Record<SegmentAuditStatus, number>;
  entries: SegmentAuditEntry[];
}

/**
 * Aplica o segmento comercial de cada cliente e devolve a trilha de auditoria.
 * Nunca lança: falhas viram linhas de auditoria com motivo sanitizado, para que
 * um problema de segmento não derrube a publicação inteira do ERP.
 */
export async function importCustomerSegments(
  sb: AdminClient,
  records: ParsedRecords,
): Promise<SegmentImportOutcome> {
  const segmentCodes = records.segments.map((s) => s.erpCode);
  const existing = await fetchAllRows(sb, "customers", "erp_code, segment_code");
  const currentByCustomer = new Map<string, string | null>(
    existing.map((row: any) => [String(row.erp_code), (row.segment_code as string | null) ?? null]),
  );

  const result = resolveCustomerSegments(records.customers, segmentCodes, currentByCustomer);
  const entries = [...result.entries];

  // Só gravamos quem realmente mudou.
  const toUpdate = entries.filter((entry) => entry.status === "updated");
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const slice = toUpdate.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map(async (entry) => {
        const { error } = await sb
          .from("customers")
          .update({ segment_code: entry.newSegmentCode })
          .eq("erp_code", entry.customerErpCode);
        if (!error) {
          await sb
            .from("customer_seller_links")
            .update({ segment_code: entry.newSegmentCode })
            .eq("customer_erp_code", entry.customerErpCode);
        }
        return error ? entry.customerErpCode : null;
      }),
    );
    for (const failedCode of results) {
      if (!failedCode) continue;
      const entry = entries.find((e2) => e2.customerErpCode === failedCode);
      if (!entry) continue;
      entry.status = "failed";
      entry.reason = "erro_ao_gravar";
    }
  }

  const totals: Record<SegmentAuditStatus, number> = { updated: 0, unchanged: 0, skipped: 0, failed: 0 };
  for (const entry of entries) totals[entry.status] = (totals[entry.status] ?? 0) + 1;

  return { detection: result.detection, totals, entries };
}

/** Persiste a trilha de auditoria (somente códigos — nenhuma PII). */
export async function saveSegmentAudit(
  sb: AdminClient,
  runId: string | null,
  entries: SegmentAuditEntry[],
): Promise<void> {
  const rows = entries.map((entry) => ({
    run_id: runId,
    customer_erp_code: entry.customerErpCode,
    previous_segment_code: entry.previousSegmentCode,
    new_segment_code: entry.newSegmentCode,
    status: entry.status,
    reason: sanitizeMessage(entry.reason),
  }));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from("segment_import_audit").insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`insert segment_import_audit: ${error.message}`);
  }
}

