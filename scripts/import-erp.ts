/**
 * Importa o dados.txt do ERP para o Supabase (vendedores, clientes, produtos,
 * grupos, tabelas, preços, estoque, diagnóstico de catálogo).
 *
 * Uso:
 *   npm run import:erp -- "<caminho/dados.txt>" [--dry-run] ["<romaneio.html>"]
 *
 * Requer no .env (NÃO versionado):
 *   SUPABASE_URL=...                 (URL do projeto)
 *   SUPABASE_SERVICE_ROLE_KEY=...    (segredo — só local; ignora RLS p/ carga admin)
 *
 * DADOS REAIS vão SOMENTE para o seu Supabase. Nada é escrito no repositório.
 * --dry-run: parseia e mostra contagens/amostras sanitizadas, sem tocar no banco.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js"; // type-only (apagado em runtime)
import { parseDadosV4 } from "../src/lib/erp/parser/dados-v4";

/**
 * Carregador de env sem dependência. Lê .env.local (segredos, ignorado pelo Git)
 * e .env (URL/publishable). Valores já definidos no ambiente têm prioridade.
 */
function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf-8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}
import { diagnoseCatalog } from "../src/lib/erp/catalog-diagnosis";
import { extractEanRelations } from "../src/lib/erp/html/ean-extractor";
import { inferProductTaxonomy, productGroupLabelMap } from "../src/lib/erp/product-taxonomy";

// Configuração admin do nível de preço por tabela (provisória — ver OPEN_QUESTIONS Q1).
const PRICE_LEVEL_MAP: Record<string, number> = { "002": 1, "012": 1, "033": 1, "053": 2, "055": 2, "061": 1 };
const CHUNK = 500;

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}
function maskTax(id: string): string {
  return id.length > 4 ? "•".repeat(id.length - 4) + id.slice(-4) : "••••";
}

async function upsertAll(sb: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string): Promise<number> {
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
    done += chunk.length;
    process.stdout.write(`\r  ${table}: ${fmt(done)}/${fmt(rows.length)}   `);
  }
  process.stdout.write("\n");
  return done;
}

async function fetchAllRows(sb: SupabaseClient, table: string, select = "*"): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`select ${table}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function upsertProductsPreservingCatalog(sb: SupabaseClient, rows: Record<string, unknown>[]): Promise<number> {
  const existingRows = await fetchAllRows(sb, "products", "erp_code, brand, category, released, active, is_launch");
  const existingByCode = new Map(existingRows.map((row: any) => [String(row.erp_code), row]));
  const protectedRows = rows.map((row) => {
    const existing = existingByCode.get(String(row.erp_code));
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  const dadosPath = positional[0] ?? process.env.ERP_FILE;
  const htmlPath = positional[1];
  if (!dadosPath) {
    console.error('Uso: npm run import:erp -- "<dados.txt>" [--dry-run] ["<romaneio.html>"]');
    process.exit(1);
  }

  const bytes = readFileSync(dadosPath);
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const { report, records, errors } = parseDadosV4(bytes);

  console.log(`\n▶ Importação ERP (parser ${report.parserVersion}) — ${dadosPath.split("/").pop()}`);
  console.log(`  Gerado ${report.generatedDate} ${report.generatedTime} · reg. lógicos ${fmt(report.logicalCount)} · confere ${report.countsMatch ? "SIM" : "NÃO"}`);
  if (!report.ok) {
    console.error(`\n✗ REJEITADO — arquivo inválido (${errors.length} erros). Nada foi importado.`);
    for (const e of errors.slice(0, 10)) console.error(`   [${e.line}] ${e.code}: ${e.message}`);
    process.exit(2);
  }

  // ---------- Montagem das entidades ----------
  const groupLabel = productGroupLabelMap(records.productGroups);

  const product_groups = records.productGroups.map((g) => ({ code: g.erpCode, name: g.label || g.erpCode }));
  const segments = records.segments.map((s) => ({ code: s.erpCode, name: s.label || s.erpCode }));
  const billing_methods = records.billingMethods.map((b) => ({ code: b.erpCode, description: b.label || b.erpCode }));
  const price_tables = records.priceTables.map((t) => ({
    code: t.erpCode,
    name: t.label || t.erpCode,
    mapped_level: PRICE_LEVEL_MAP[t.erpCode] ?? null,
    level_label: PRICE_LEVEL_MAP[t.erpCode] !== undefined ? `Valor ${PRICE_LEVEL_MAP[t.erpCode]! + 1}` : null,
  }));

  // Vendedores: código canônico de 3 díg (tipo 05) + placeholders p/ reps referenciados por clientes.
  const sellers = new Map<string, { erp_code: string; name: string; active: boolean }>();
  for (const s of records.sellers) {
    const code3 = s.erpCode.slice(0, 3);
    if (!sellers.has(code3)) sellers.set(code3, { erp_code: code3, name: s.name || `Representante ${code3}`, active: !s.inactiveHint });
  }
  for (const c of records.customers) {
    if (!sellers.has(c.erpSellerCode)) sellers.set(c.erpSellerCode, { erp_code: c.erpSellerCode, name: `Representante ${c.erpSellerCode}`, active: false });
  }
  const erp_sellers = [...sellers.values()];

  const products = records.products.map((p) => {
    const suggestion = inferProductTaxonomy(p, groupLabel.get(p.erpGroupCode));
    return {
      erp_code: p.erpCode,
      name: p.officialDescription || `Produto ${p.erpCode}`,
      group_code: p.erpGroupCode || null,
      unit: p.unit || "UN",
      erp_brand_suggestion: suggestion.brand,
      erp_category_suggestion: suggestion.category,
      erp_taxonomy_updated_at: new Date().toISOString(),
    };
  });

  const product_prices: Record<string, unknown>[] = records.prices.map((pr) => ({
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
  }));

  // Dedup por erp_code: o ERP traz ~16 códigos de cliente repetidos; sem isso o
  // upsert em lote falha com "ON CONFLICT ... cannot affect row a second time".
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
      credit_limit: c.creditLimit ?? 0, // 🟡 financeiro pendente de confirmação (Q6)
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

  // Diagnóstico do catálogo → catalog_review
  const catalogCodes = new Set(records.products.map((p) => p.erpCode));
  const stockCodes = new Set(records.inventory.map((i) => i.erpProductCode));
  const priceCodes = new Set(records.prices.map((p) => p.erpProductCode));
  const stockByCode = new Map(records.inventory.map((i) => [i.erpProductCode, i.quantity ?? 0]));
  const catalog_review: Record<string, unknown>[] = [];
  for (const p of records.products) {
    const q = stockByCode.get(p.erpCode);
    const hasPrice = priceCodes.has(p.erpCode);
    const detail = q === undefined ? "sem_estoque" : q < 0 ? "estoque_negativo" : q === 0 ? "estoque_zero" : "estoque_ok";
    catalog_review.push({ erp_code: p.erpCode, classification: "catalogo", detail: `${detail}${hasPrice ? "" : ";sem_preco"}` });
  }
  for (const code of stockCodes) if (!catalogCodes.has(code)) catalog_review.push({ erp_code: code, classification: "somente_estoque", detail: null });
  for (const code of priceCodes) if (!catalogCodes.has(code) && !stockCodes.has(code)) catalog_review.push({ erp_code: code, classification: "somente_preco", detail: null });

  // EANs (opcional, via HTML)
  let product_eans: Record<string, unknown>[] = [];
  if (htmlPath) {
    product_eans = extractEanRelations(readFileSync(htmlPath, "utf-8")).map((r) => ({ product_erp_code: r.productErpCode, ean: r.ean }));
  }

  const diag = diagnoseCatalog(records);
  console.log("\n  Entidades a importar:");
  console.log(`    vendedores ......... ${fmt(erp_sellers.length)}`);
  console.log(`    clientes ........... ${fmt(customers.length)}`);
  console.log(`    produtos (catálogo). ${fmt(products.length)}`);
  console.log(`    grupos ............. ${fmt(product_groups.length)}`);
  console.log(`    tabelas de preço ... ${fmt(price_tables.length)}`);
  console.log(`    preços ............. ${fmt(product_prices.length)}`);
  console.log(`    estoque ............ ${fmt(inventory_snapshots.length)}`);
  console.log(`    catalog_review ..... ${fmt(catalog_review.length)}`);
  console.log(`    vínculos carteira .. ${fmt(customer_seller_links.length)}`);
  if (product_eans.length) console.log(`    EANs (HTML) ........ ${fmt(product_eans.length)}`);
  console.log(`    diagnóstico: catálogo ${fmt(diag.inCatalog)} · só-estoque ${fmt(diag.stockOnly)} · só-preço ${fmt(diag.priceOnly)}`);

  if (dryRun) {
    console.log("\n  Amostra sanitizada de clientes:");
    for (const c of customers.slice(0, 3)) {
      console.log(`    #${c.erp_code} rep ${c.seller_erp_code} · ${c.trade_name.slice(0, 24)} · ${c.city}/${c.uf} · CNPJ ${maskTax(c.tax_id)} · tab ${c.price_table_code}`);
    }
    console.log("\n  DRY-RUN: nada foi gravado. Rode sem --dry-run (com .env configurado) para importar.\n");
    return;
  }

  // ---------- Conexão Supabase (service role) ----------
  loadEnvFiles(); // .env.local (segredo) + .env (URL)
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("\n✗ Faltam SUPABASE_URL (do .env) e/ou SUPABASE_SERVICE_ROLE_KEY (coloque no .env.local). Abortando.");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // registro da importação
  const { data: run, error: runErr } = await sb
    .from("erp_import_runs")
    .insert({ file_hash: fileHash, parser_version: report.parserVersion, file_version: report.layoutVersion, status: "publishing", totals: { byType: report.typeCounts, diagnosis: diag } })
    .select("id")
    .single();
  if (runErr) {
    console.error("✗ Não foi possível criar erp_import_runs:", runErr.message);
    process.exit(3);
  }
  const runId = (run as { id: string }).id;

  console.log("\n  Publicando no Supabase (upsert idempotente):");
  try {
    await upsertAll(sb, "product_groups", product_groups, "code");
    await upsertAll(sb, "segments", segments, "code");
    await upsertAll(sb, "billing_methods", billing_methods, "code");
    await upsertAll(sb, "price_tables", price_tables, "code");
    await upsertAll(sb, "erp_sellers", erp_sellers, "erp_code");
    await upsertProductsPreservingCatalog(sb, products);
    await upsertAll(sb, "product_prices", product_prices, "product_erp_code,price_table_code");
    await upsertAll(sb, "inventory_snapshots", inventory_snapshots, "product_erp_code");
    await upsertAll(sb, "catalog_review", catalog_review, "erp_code");
    if (product_eans.length) await upsertAll(sb, "product_eans", product_eans, "product_erp_code,ean");
    await upsertAll(sb, "customers", customers, "erp_code");
    await upsertAll(sb, "customer_seller_links", customer_seller_links, "customer_erp_code,seller_erp_code");
    await sb.from("erp_import_runs").update({ status: "published", finished_at: new Date().toISOString() }).eq("id", runId);
    console.log(`\n✓ Importação concluída. import_run ${runId}\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb.from("erp_import_runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", runId);
    await sb.from("erp_import_errors").insert({ run_id: runId, message: msg.slice(0, 500) });
    console.error(`\n✗ Falha na publicação: ${msg}`);
    process.exit(4);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
