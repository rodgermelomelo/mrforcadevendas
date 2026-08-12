import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Customer, PriceTable, Product } from "@/lib/domain/types";
import type { ApprovalRule } from "@/lib/orders/validation";

export interface WorkspaceData {
  customers: Customer[];
  products: Product[];
  priceTables: PriceTable[];
  groups: string[];
  sellerName: string;
  sellerCodes: string[];
  sellers: { code: string; name: string; customerCount: number; monthlyGoal?: number | undefined }[];
  lastUpdate: string | null;
  approvalRules: ApprovalRule[];
  role: string | null;
  brandMetadata: Record<string, any>;
}

/** Carrega carteira + catálogo do usuário autenticado (RLS limita a carteira visível). */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceData> => {
    const { supabase, userId } = context;

    // Use absolute raw queries to bypass type instantiation limits for large complex schemas
    const fetch = async (table: string, options: any = {}) => {
      let query = supabase.from(table as any).select(options.select || "*");
      if (options.eq) {
        for (const [k, v] of Object.entries(options.eq)) {
          query = query.eq(k as any, v as any);
        }
      }
      if (options.order) query = query.order(options.order);
      if (options.maybeSingle) return query.maybeSingle();
      return query;
    };

    const customersRes = await fetch("customers", { eq: { active: true }, order: "trade_name" });
    const productsRes = await fetch("products", { eq: { active: true }, order: "erp_code" });
    const pricesRes = await fetch("product_prices");
    const tablesRes = await fetch("price_tables");
    const groupsRes = await fetch("product_groups");
    const inventoryRes = await fetch("inventory_snapshots");
    const enrichRes = await fetch("product_enrichments");
    const linksRes = await fetch("user_erp_seller_links", { eq: { user_id: userId }, select: "seller_erp_code" });
    const profileRes = await fetch("profiles", { eq: { id: userId }, select: "full_name, email", maybeSingle: true });
    const rulesRes = await fetch("approval_rules", { eq: { active: true } });
    const roleRes = await fetch("user_roles", { eq: { user_id: userId }, select: "role", maybeSingle: true });
    const sellersRes = await fetch("erp_sellers", { order: "erp_code", select: "erp_code, name" });
    const brandsRes = await fetch("brands", { eq: { active: true }, select: "name, active, metadata" });
    const goalsRes = await fetch("seller_goals", { eq: { month: new Date().toISOString().slice(0, 7) + "-01" } });

    const today = new Date().toISOString().slice(0, 10);
    const approvalRules: ApprovalRule[] = (rulesRes.data as any[] ?? [])
      .filter((r) => r.valid_from <= today && (r.valid_to === null || r.valid_to >= today))
      .map((r) => ({
        exception: r.exception_type as ApprovalRule["exception"],
        authority: r.authority as ApprovalRule["authority"],
        ...(r.min_percent === null ? {} : { minPercent: Number(r.min_percent) }),
        ...(r.max_percent === null ? {} : { maxPercent: Number(r.max_percent) }),
        ...(r.min_amount === null ? {} : { minAmount: Number(r.min_amount) }),
        ...(r.max_amount === null ? {} : { maxAmount: Number(r.max_amount) }),
      }));

    const groupName = new Map((groupsRes.data as any[] ?? []).map((g) => [g.code, g.name]));
    const stock = new Map((inventoryRes.data as any[] ?? []).map((i) => [i.product_erp_code, Number(i.quantity)]));
    const image = new Map((enrichRes.data as any[] ?? []).map((e) => [e.product_erp_code, e.image_url]));

    const activeBrands = new Set((brandsRes.data as any[] ?? []).map((b: any) => b.name));
    
    const pricesByProduct = new Map<string, Record<string, number[]>>();
    for (const row of pricesRes.data as any[] ?? []) {
      const current = pricesByProduct.get(row.product_erp_code) ?? {};
      current[row.price_table_code] = [
        Number(row.value_1),
        Number(row.value_2),
        Number(row.value_3),
        Number(row.value_4),
        Number(row.value_5),
        Number(row.value_6),
      ];
      pricesByProduct.set(row.product_erp_code, current);
    }

    const priceTables: PriceTable[] = (tablesRes.data as any[] ?? []).map((t) => ({
      code: t.code,
      name: t.name,
      mappedLevel: t.mapped_level,
      levelLabel: t.level_label,
    }));

    const customers: Customer[] = (customersRes.data as any[] ?? []).map((c) => ({
      id: c.id,
      erpCode: c.erp_code,
      legalName: c.legal_name,
      tradeName: c.trade_name,
      taxId: c.tax_id,
      city: c.city,
      uf: c.uf,
      segment: c.segment_code ?? "",
      priceTableCode: c.price_table_code,
      paymentTerm: c.payment_term,
      restricted: c.restricted,
      restrictionReason: c.restriction_reason ?? undefined,
      creditLimit: Number(c.credit_limit),
      openBalance: Number(c.open_balance),
      minOrderValue: Number(c.min_order_value),
      lastOrderAt: c.last_order_at,
      sellerErpCode: c.seller_erp_code,
    }));

    const products: Product[] = (productsRes.data as any[] ?? [])
      .filter((p) => {
        if (activeBrands.size === 0) return true;
        const brand = p.brand || (groupName.get(p.group_code ?? "") ?? p.group_code ?? "Outros").split(" ")[0];
        return activeBrands.has(brand);
      })
      .map((p) => ({
        id: p.id,
        erpCode: p.erp_code,
        name: p.name,
        group: groupName.get(p.group_code ?? "") ?? p.group_code ?? "Outros",
        unit: p.unit,
        stock: stock.get(p.erp_code) ?? 0,
        isLaunch: p.is_launch,
        imageUrl: image.get(p.erp_code) ?? null,
        brand: p.brand || (p.group_code ? (groupName.get(p.group_code) || p.group_code || "OUTROS").split(" ")[0]?.toUpperCase() || "OUTROS" : "OUTROS"),
        category: (p as any).category || "DIVERSOS",
        prices: pricesByProduct.get(p.erp_code) ?? {},
      }));

    const lastUpdate =
      (inventoryRes.data as any[] ?? [])
        .map((i) => i.captured_at)
        .sort()
        .at(-1) ?? null;

    // Representantes com contagem de clientes visíveis (para filtro da carteira).
    const custCountBySeller = new Map<string, number>();
    for (const c of customers) {
      const code = c.sellerErpCode;
      if (!code) continue;
      custCountBySeller.set(code, (custCountBySeller.get(code) ?? 0) + 1);
    }
    
    const goalsBySeller = new Map((goalsRes.data as any[] ?? []).map(g => [g.seller_erp_code, Number(g.goal_amount)]));

    const sellers = (sellersRes.data as any[] ?? [])
      .map((s) => ({
        code: s.erp_code,
        name: s.name || `Representante ${s.erp_code}`,
        customerCount: custCountBySeller.get(s.erp_code) ?? 0,
        monthlyGoal: goalsBySeller.get(s.erp_code) as number | undefined,
      }))
      .filter((s) => s.customerCount > 0)
      .sort((a, b) => b.customerCount - a.customerCount);

    return {
      customers,
      products,
      priceTables,
      groups: (groupsRes.data as any[] ?? []).map((g) => g.name),
      sellerName: (profileRes.data as any)?.full_name || (profileRes.data as any)?.email || "Vendedor",
      sellerCodes: (linksRes.data as any[] ?? []).map((l) => l.seller_erp_code),
      sellers,
      lastUpdate,
      approvalRules,
      role: (roleRes.data as any)?.role || null,
      brandMetadata: Object.fromEntries((brandsRes.data as any[] ?? []).map((b: any) => [b.name, b.metadata || {}])),
    };
  });
