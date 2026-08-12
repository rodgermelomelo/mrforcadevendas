import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Customer, PriceTable, Product } from "@/lib/domain/types";
import { isRepresentativeRole } from "@/lib/domain/roles";
import type { ApprovalRule } from "@/lib/orders/validation";

export interface BrandMetadataEntry {
  isCategory?: boolean;
  parentBrand?: string | null;
}

export interface WorkspaceCoreData {
  customers: Customer[];
  priceTables: PriceTable[];
  sellerName: string;
  sellerCodes: string[];
  sellers: {
    code: string;
    name: string;
    customerCount: number;
    monthlyGoal?: number | undefined;
  }[];
  lastUpdate: string | null;
  approvalRules: ApprovalRule[];
  role: string | null;
  brandMetadata: Record<string, BrandMetadataEntry>;
}

export interface CatalogWorkspaceData {
  products: Product[];
  groups: string[];
}

type DbRow = Record<string, unknown>;
type QueryError = { message?: string } | null;
type QueryResult<T> = Promise<{ data: T | null; error: QueryError }>;

interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: unknown[]): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(from: number, to: number): QueryResult<DbRow[]>;
  limit(count: number): QueryResult<DbRow[]>;
  maybeSingle(): QueryResult<DbRow>;
}

interface WorkspaceDb {
  from(table: string): QueryBuilder;
}

const PAGE_SIZE = 1000;

function dbClient(supabase: unknown): WorkspaceDb {
  return supabase as WorkspaceDb;
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

function isClockSkewError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("issued at future") || message.includes("jwt not yet valid");
}

function isMissingTable(error: unknown, tableName: string): boolean {
  return errorMessage(error).toLowerCase().includes(tableName.toLowerCase());
}

async function runQuery<T extends { error: QueryError }>(fn: () => Promise<T>): Promise<T> {
  let result = await fn();
  for (let attempt = 0; attempt < 3 && isClockSkewError(result.error); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    result = await fn();
  }
  return result;
}

async function fetchAllRows(
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

function rows(result: { data: DbRow[] | null }): DbRow[] {
  return result.data ?? [];
}

function text(row: DbRow | null | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" ? value : fallback;
}

function nullableText(row: DbRow | null | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(row: DbRow | null | undefined, key: string, fallback = 0) {
  const value = row?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nullableNumber(row: DbRow | null | undefined, key: string): number | null {
  const value = row?.[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(row: DbRow | null | undefined, key: string) {
  return row?.[key] === true;
}

function metadataValue(row: DbRow | null | undefined): BrandMetadataEntry {
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

function priceValues(row: DbRow) {
  return [
    numberValue(row, "value_1"),
    numberValue(row, "value_2"),
    numberValue(row, "value_3"),
    numberValue(row, "value_4"),
    numberValue(row, "value_5"),
    numberValue(row, "value_6"),
  ];
}

function mapPriceTables(rowsToMap: DbRow[], role: string | null): PriceTable[] {
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

function mapApprovalRules(ruleRows: DbRow[]) {
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

function mapCustomers(customerRows: DbRow[], linkRows: DbRow[], customerLinksMissing: boolean) {
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

function mapSellerSummary(customers: Customer[], sellerRows: DbRow[], goalRows: DbRow[]) {
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

function mapBrandMetadata(brandRows: DbRow[]): Record<string, BrandMetadataEntry> {
  return Object.fromEntries(brandRows.map((brand) => [text(brand, "name"), metadataValue(brand)]));
}

function failIfAny(results: [string, { error: QueryError }][]) {
  const failed = results.find(([, result]) => result.error);
  if (failed) throw new Error(`Falha ao carregar ${failed[0]}: ${errorMessage(failed[1].error)}`);
}

export const getWorkspaceCore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceCoreData> => {
    const db = dbClient(context.supabase);
    const month = `${new Date().toISOString().slice(0, 7)}-01`;

    const [
      customersRes,
      tablesRes,
      customerLinksRes,
      sellerLinksRes,
      profileRes,
      rulesRes,
      roleRes,
      sellersRes,
      brandsRes,
      goalsRes,
      lastInventoryRes,
    ] = await Promise.all([
      runQuery(() =>
        fetchAllRows(
          db,
          "customers",
          "id, erp_code, legal_name, trade_name, tax_id, city, uf, segment_code, price_table_code, payment_term, restricted, restriction_reason, credit_limit, open_balance, min_order_value, last_order_at, seller_erp_code",
          (query) => query.eq("active", true).order("trade_name"),
        ),
      ),
      runQuery(() => fetchAllRows(db, "price_tables", "*", (query) => query.order("code"))),
      runQuery(() =>
        fetchAllRows(db, "customer_seller_links", "*", (query) =>
          query.eq("active", true).order("seller_erp_code").order("customer_erp_code"),
        ),
      ),
      runQuery(() =>
        db
          .from("user_erp_seller_links")
          .select("seller_erp_code")
          .eq("user_id", context.userId)
          .range(0, 999),
      ),
      runQuery(() =>
        db.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
      ),
      runQuery(() => db.from("approval_rules").select("*").eq("active", true).range(0, 999)),
      runQuery(() =>
        db.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
      ),
      runQuery(() =>
        fetchAllRows(db, "erp_sellers", "erp_code, name", (query) => query.order("erp_code")),
      ),
      runQuery(() =>
        db.from("brands").select("name, active, metadata").eq("active", true).range(0, 999),
      ),
      runQuery(() => db.from("seller_goals").select("*").eq("month", month).range(0, 999)),
      runQuery(() =>
        db
          .from("inventory_snapshots")
          .select("captured_at")
          .order("captured_at", { ascending: false })
          .limit(1),
      ),
    ]);

    const customerLinksMissing =
      Boolean(customerLinksRes.error) &&
      isMissingTable(customerLinksRes.error, "customer_seller_links");
    failIfAny([
      ["customers", customersRes],
      ["price_tables", tablesRes],
      ...(customerLinksMissing
        ? []
        : ([["customer_seller_links", customerLinksRes]] as [string, { error: QueryError }][])),
      ["user_erp_seller_links", sellerLinksRes],
      ["profiles", profileRes],
      ["approval_rules", rulesRes],
      ["user_roles", roleRes],
      ["erp_sellers", sellersRes],
      ["brands", brandsRes],
      ["seller_goals", goalsRes],
      ["inventory_snapshots", lastInventoryRes],
    ]);

    const role = nullableText(roleRes.data, "role");
    const customers = mapCustomers(
      rows(customersRes),
      rows(customerLinksRes),
      customerLinksMissing,
    );
    const profile = profileRes.data;
    const sellerName = text(profile, "full_name", text(profile, "email", "Vendedor"));

    return {
      customers,
      priceTables: mapPriceTables(rows(tablesRes), role),
      sellerName,
      sellerCodes: rows(sellerLinksRes)
        .map((link) => text(link, "seller_erp_code"))
        .filter(Boolean),
      sellers: mapSellerSummary(customers, rows(sellersRes), rows(goalsRes)),
      lastUpdate: nullableText(rows(lastInventoryRes)[0], "captured_at"),
      approvalRules: mapApprovalRules(rows(rulesRes)),
      role,
      brandMetadata: mapBrandMetadata(rows(brandsRes)),
    };
  });

export const getCatalogWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogWorkspaceData> => {
    const db = dbClient(context.supabase);

    const [
      productsRes,
      tablesRes,
      groupsRes,
      inventoryRes,
      enrichRes,
      customerLinksRes,
      roleRes,
      brandsRes,
    ] = await Promise.all([
      runQuery(() =>
        fetchAllRows(db, "products", "*", (query) => query.eq("active", true).order("erp_code")),
      ),
      runQuery(() => fetchAllRows(db, "price_tables", "*", (query) => query.order("code"))),
      runQuery(() => fetchAllRows(db, "product_groups", "*", (query) => query.order("code"))),
      runQuery(() =>
        fetchAllRows(db, "inventory_snapshots", "*", (query) => query.order("product_erp_code")),
      ),
      runQuery(() =>
        fetchAllRows(db, "product_enrichments", "*", (query) => query.order("product_erp_code")),
      ),
      runQuery(() =>
        fetchAllRows(db, "customer_seller_links", "price_table_code", (query) =>
          query.eq("active", true).order("price_table_code"),
        ),
      ),
      runQuery(() =>
        db.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
      ),
      runQuery(() =>
        db.from("brands").select("name, active, metadata").eq("active", true).range(0, 999),
      ),
    ]);

    const customerLinksMissing =
      Boolean(customerLinksRes.error) &&
      isMissingTable(customerLinksRes.error, "customer_seller_links");
    failIfAny([
      ["products", productsRes],
      ["price_tables", tablesRes],
      ["product_groups", groupsRes],
      ["inventory_snapshots", inventoryRes],
      ["product_enrichments", enrichRes],
      ...(customerLinksMissing
        ? []
        : ([["customer_seller_links", customerLinksRes]] as [string, { error: QueryError }][])),
      ["user_roles", roleRes],
      ["brands", brandsRes],
    ]);

    const visiblePriceTables = new Set(
      rows(customerLinksRes)
        .map((link) => text(link, "price_table_code"))
        .filter(Boolean),
    );
    const shouldFetchAllPrices = customerLinksMissing;
    const shouldFetchPrices = shouldFetchAllPrices || visiblePriceTables.size > 0;
    const pricesRes = shouldFetchPrices
      ? await runQuery(() =>
          fetchAllRows(db, "product_prices", "*", (query) => {
            const ordered = query.order("product_erp_code").order("price_table_code");
            return shouldFetchAllPrices
              ? ordered
              : ordered.in("price_table_code", Array.from(visiblePriceTables));
          }),
        )
      : { data: [], error: null };
    failIfAny([["product_prices", pricesRes]]);

    const role = nullableText(roleRes.data, "role");
    const hidePriceTableDetails = isRepresentativeRole(role);
    const groupName = new Map(
      rows(groupsRes).map((group) => [text(group, "code"), text(group, "name")]),
    );
    const stock = new Map(
      rows(inventoryRes).map((item) => [
        text(item, "product_erp_code"),
        numberValue(item, "quantity"),
      ]),
    );
    const image = new Map(
      rows(enrichRes).map((item) => [
        text(item, "product_erp_code"),
        nullableText(item, "image_url"),
      ]),
    );
    const mappedLevelByTable = new Map(
      rows(tablesRes).map((table) => [text(table, "code"), nullableNumber(table, "mapped_level")]),
    );
    const activeBrands = new Set(
      rows(brandsRes)
        .map((brand) => text(brand, "name"))
        .filter(Boolean),
    );

    const pricesByProduct = new Map<string, Record<string, number[]>>();
    for (const row of rows(pricesRes)) {
      const tableCode = text(row, "price_table_code");
      if (hidePriceTableDetails && !visiblePriceTables.has(tableCode)) continue;

      const productCode = text(row, "product_erp_code");
      const values = priceValues(row);
      const current = pricesByProduct.get(productCode) ?? {};

      if (hidePriceTableDetails) {
        const mappedLevel = mappedLevelByTable.get(tableCode);
        const maskedValues = [0, 0, 0, 0, 0, 0];
        if (
          typeof mappedLevel === "number" &&
          mappedLevel >= 0 &&
          mappedLevel < maskedValues.length
        ) {
          maskedValues[mappedLevel] = values[mappedLevel] ?? 0;
        }
        current[tableCode] = maskedValues;
      } else {
        current[tableCode] = values;
      }

      pricesByProduct.set(productCode, current);
    }

    const products = rows(productsRes)
      .filter((product) => {
        if (activeBrands.size === 0) return true;
        const groupCode = text(product, "group_code");
        const group = groupName.get(groupCode) || groupCode || "Outros";
        const inferredBrand =
          text(product, "brand") || group.split(" ")[0]?.toUpperCase() || "OUTROS";
        return activeBrands.has(inferredBrand);
      })
      .map((product): Product => {
        const groupCode = text(product, "group_code");
        const group = groupName.get(groupCode) || groupCode || "Outros";
        const brand =
          text(product, "brand") ||
          (group ? group.split(" ")[0]?.toUpperCase() || "OUTROS" : "OUTROS");
        const category = text(product, "category") || text(product, "erp_category_suggestion") || "DIVERSOS";
        const segment = text(product, "segment") || text(product, "erp_segment_suggestion") || "GERAL";
        const erpCode = text(product, "erp_code");

        return {
          id: text(product, "id", erpCode),
          erpCode,
          name: text(product, "name", erpCode),
          group,
          unit: text(product, "unit", "UN"),
          stock: stock.get(erpCode) ?? 0,
          isLaunch: booleanValue(product, "is_launch"),
          imageUrl: image.get(erpCode) ?? null,
          brand,
          category,
          segment,
          prices: pricesByProduct.get(erpCode) ?? {},
        };
      });

    return {
      products,
      groups: rows(groupsRes).map((group) => text(group, "name")),
    };
  });
