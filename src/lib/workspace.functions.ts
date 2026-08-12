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

import {
  dbClient,
  errorMessage,
  failIfAny,
  fetchAllRows,
  isMissingTable,
  mapApprovalRules,
  mapBrandMetadata,
  mapCustomers,
  mapPriceTables,
  mapSellerSummary,
  metadataValue,
  numberValue,
  nullableNumber,
  nullableText,
  priceValues,
  rows,
  runQuery,
  text,
  booleanValue,
} from "@/lib/workspace-core.server";


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
