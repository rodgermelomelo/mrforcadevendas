/**
 * Completa product_enrichments.image_url com imagens conhecidas do catalogo.
 *
 * Uso:
 *   npm run enrich:images -- [--dry-run] [--brand=DAILUS|ACEMAR] [--overwrite]
 *
 * Por padrao, preserva qualquer image_url ja existente. Requer service role
 * porque escreve em product_enrichments sem passar pela UI administrativa.
 */
import { existsSync, readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  knownExternalProductImageUrl,
  normalizeCatalogText,
  productImageSearchText,
  type ProductImageCandidate,
} from "../src/lib/product-image-catalog";

const CHUNK = 500;
type DbRow = Record<string, unknown>;

function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf-8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

async function fetchAllRows(sb: SupabaseClient, table: string, select = "*"): Promise<DbRow[]> {
  const rows: DbRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .range(from, from + 999);
    if (error) throw new Error(`select ${table}: ${error.message}`);
    const page = (data ?? []) as DbRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function upsertAll(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(index + CHUNK, rows.length)}/${rows.length}   `);
  }
  process.stdout.write("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const overwrite = args.includes("--overwrite");
  const brandFilter = argValue("--brand");
  const normalizedBrandFilter = brandFilter ? normalizeCatalogText(brandFilter) : null;

  loadEnvFiles();
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltam SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.",
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [products, enrichments] = await Promise.all([
    fetchAllRows(sb, "products", "erp_code, name, brand, category, group_code, active"),
    fetchAllRows(sb, "product_enrichments", "product_erp_code, image_url"),
  ]);

  const imageByCode = new Map(
    enrichments.map((row) => [String(row.product_erp_code), row.image_url]),
  );
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const product of products) {
    const candidate: ProductImageCandidate = {
      erpCode: String(product.erp_code),
      name: String(product.name ?? ""),
      brand: nullableString(product.brand),
      category: nullableString(product.category),
      groupCode: nullableString(product.group_code),
      imageUrl: null,
    };
    if (normalizedBrandFilter && !productImageSearchText(candidate).includes(normalizedBrandFilter))
      continue;
    if (!overwrite && imageByCode.get(candidate.erpCode)) continue;

    const imageUrl = knownExternalProductImageUrl(candidate);
    if (!imageUrl) continue;
    rows.push({ product_erp_code: candidate.erpCode, image_url: imageUrl, updated_at: now });
  }

  console.log(`\nProdutos lidos: ${products.length}`);
  console.log(`Imagens conhecidas para gravar: ${rows.length}`);
  if (brandFilter) console.log(`Filtro de marca/termo: ${brandFilter}`);
  if (dryRun) {
    for (const row of rows.slice(0, 12)) console.log(`  ${row.product_erp_code}: ${row.image_url}`);
    console.log("\nDRY-RUN: nada foi gravado.\n");
    return;
  }

  if (rows.length === 0) {
    console.log("Nada para atualizar.\n");
    return;
  }
  await upsertAll(sb, "product_enrichments", rows, "product_erp_code");
  console.log("Imagens do catalogo enriquecidas.\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
