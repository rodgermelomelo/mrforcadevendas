import type { Customer, PriceTable } from "@/lib/domain/types";
import { isRepresentativeRole } from "@/lib/domain/roles";
import type { ApprovalRule } from "@/lib/orders/validation";
import type { BrandMetadataEntry } from "@/lib/workspace.functions";

export type DbRow = Record<string, unknown>;
export type QueryError = { message?: string } | null;
export type QueryResult<T> = Promise<{ data: T | null; error: QueryError }>;

export interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: unknown[]): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(from: number, to: number): QueryResult<DbRow[]>;
  limit(count: number): QueryResult<DbRow[]>;
  maybeSingle(): QueryResult<DbRow>;
}

export interface WorkspaceDb {
  from(table: string): QueryBuilder;
}

export const PAGE_SIZE = 2000; // Aumentado para reduzir o número de requisições sequenciais (round-trips)

export function dbClient(supabase: unknown): WorkspaceDb {
  return supabase as WorkspaceDb;
}

export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

export function isClockSkewError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("issued at future") || message.includes("jwt not yet valid");
}

export function isMissingTable(error: unknown, tableName: string): boolean {
  return errorMessage(error).toLowerCase().includes(tableName.toLowerCase());
}

export async function runQuery<T extends { error: QueryError }>(fn: () => Promise<T>): Promise<T> {
  let result = await fn();
  for (let attempt = 0; attempt < 3 && isClockSkewError(result.error); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    result = await fn();
  }
  return result;
}

export async function fetchAllRows(
  db: WorkspaceDb,
  table: string,
  select = "*",
  apply?: (query: QueryBuilder) => QueryBuilder,
): Promise<{ data: DbRow[]; error: QueryError }> {
  const rows: DbRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from(table).select(select);
    if (apply) query = apply(query);

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };

    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

export function rows(result: { data: DbRow[] | null }): DbRow[] {
  return result.data ?? [];
}

export function text(row: DbRow | null | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" ? value : fallback;
}

export function nullableText(row: DbRow | null | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberValue(row: DbRow | null | undefined, key: string, fallback = 0) {
  const value = row?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function nullableNumber(row: DbRow | null | undefined, key: string): number | null {
  const value = row?.[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function booleanValue(row: DbRow | null | undefined, key: string) {
  return row?.[key] === true;
}

export function metadataValue(row: DbRow | null | undefined): BrandMetadataEntry {
  const value = row?.["metadata"];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      ...(typeof record["isCategory"] === "boolean" ? { isCategory: record["isCategory"] } : {}),
      ...(typeof record["parentBrand"] === "string" || record["parentBrand"] === null
        ? { parentBrand: record["parentBrand"] }
        : {}),
    };
  }
  return {};
}

export function priceValues(row: DbRow) {
  return [
    numberValue(row, "value_1"),
    numberValue(row, "value_2"),
    numberValue(row, "value_3"),
    numberValue(row, "value_4"),
    numberValue(row, "value_5"),
    numberValue(row, "value_6"),
  ];
}

export function mapPriceTables(rowsToMap: DbRow[], role: string | null): PriceTable[] {
  const hidePriceTableDetails = isRepresentativeRole(role);

  return rowsToMap.map((row) => {
    const mappedLevel = nullableNumber(row, "mapped_level");
    return {
      code: text(row, "code"),
      name: hidePriceTableDetails ? "Política comercial" : text(row, "name"),
      mappedLevel,
      levelLabel:
        hidePriceTableDetails && mappedLevel !== null
          ? "Preço do cliente"
          : nullableText(row, "level_label"),
    };
  });
}

export function mapApprovalRules(ruleRows: DbRow[]) {
  const today = new Date().toISOString().slice(0, 10);

  return ruleRows
    .filter((row) => {
      const validFrom = text(row, "valid_from");
      const validTo = nullableText(row, "valid_to");
      return validFrom <= today && (validTo === null || validTo >= today);
    })
    .map((row): ApprovalRule => {
      const minPercent = nullableNumber(row, "min_percent");
      const maxPercent = nullableNumber(row, "max_percent");
      const minAmount = nullableNumber(row, "min_amount");
      const maxAmount = nullableNumber(row, "max_amount");

      return {
        exception: text(row, "exception_type") as ApprovalRule["exception"],
        authority: text(row, "authority") as ApprovalRule["authority"],
        ...(minPercent === null ? {} : { minPercent }),
        ...(maxPercent === null ? {} : { maxPercent }),
        ...(minAmount === null ? {} : { minAmount }),
        ...(maxAmount === null ? {} : { maxAmount }),
      };
    });
}

export function mapCustomers(customerRows: DbRow[], linkRows: DbRow[], customerLinksMissing: boolean) {
  const customerByCode = new Map(
    customerRows.map((customer) => [text(customer, "erp_code"), customer]),
  );
  const linkedContexts = linkRows
    .map((link) => ({
      link,
      customer: customerByCode.get(text(link, "customer_erp_code")),
    }))
    .filter((context): context is { link: DbRow; customer: DbRow } => Boolean(context.customer));

  const legacyContexts = customerRows.map((customer) => ({
    customer,
    link: {
      seller_erp_code: text(customer, "seller_erp_code"),
      price_table_code: text(customer, "price_table_code"),
      payment_term: text(customer, "payment_term"),
      segment_code: text(customer, "segment_code"),
    },
  }));

  const contexts =
    !customerLinksMissing && linkedContexts.length > 0 ? linkedContexts : legacyContexts;

  return contexts.map(({ customer, link }): Customer => {
    const sellerErpCode = text(link, "seller_erp_code");
    const restrictionReason = nullableText(customer, "restriction_reason") ?? undefined;

    return {
      id: `${text(customer, "id")}:${sellerErpCode}`,
      erpCode: text(customer, "erp_code"),
      legalName: text(customer, "legal_name"),
      tradeName: text(customer, "trade_name"),
      taxId: text(customer, "tax_id"),
      city: text(customer, "city"),
      uf: text(customer, "uf"),
      segment: text(link, "segment_code", text(customer, "segment_code")),
      priceTableCode: text(link, "price_table_code", text(customer, "price_table_code")),
      paymentTerm: text(link, "payment_term", text(customer, "payment_term")),
      restricted: booleanValue(customer, "restricted"),
      restrictionReason,
      creditLimit: numberValue(customer, "credit_limit"),
      openBalance: numberValue(customer, "open_balance"),
      minOrderValue: numberValue(customer, "min_order_value"),
      lastOrderAt: nullableText(customer, "last_order_at"),
      sellerErpCode,
    };
  });
}

export function mapSellerSummary(customers: Customer[], sellerRows: DbRow[], goalRows: DbRow[]) {
  const customerCountBySeller = new Map<string, number>();
  for (const customer of customers) {
    const code = customer.sellerErpCode;
    if (!code) continue;
    customerCountBySeller.set(code, (customerCountBySeller.get(code) ?? 0) + 1);
  }

  const goalsBySeller = new Map(
    goalRows.map((goal) => [text(goal, "seller_erp_code"), numberValue(goal, "target_value")]),
  );

  return sellerRows
    .map((seller) => {
      const code = text(seller, "erp_code");
      return {
        code,
        name: text(seller, "name", `Representante ${code}`),
        customerCount: customerCountBySeller.get(code) ?? 0,
        monthlyGoal: goalsBySeller.get(code),
      };
    })
    .filter((seller) => seller.customerCount > 0)
    .sort((a, b) => b.customerCount - a.customerCount);
}

export function mapBrandMetadata(brandRows: DbRow[]): Record<string, BrandMetadataEntry> {
  return Object.fromEntries(brandRows.map((brand) => [text(brand, "name"), metadataValue(brand)]));
}

export function failIfAny(results: [string, { error: QueryError }][]) {
  const failed = results.find(([, result]) => result.error);
  if (failed) throw new Error(`Falha ao carregar ${failed[0]}: ${errorMessage(failed[1].error)}`);
}
