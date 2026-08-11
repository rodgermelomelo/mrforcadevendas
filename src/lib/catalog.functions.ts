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
  sellers: { code: string; name: string; customerCount: number }[];
  lastUpdate: string | null;
  approvalRules: ApprovalRule[];
  role: string | null;
}

/** Carrega carteira + catálogo do usuário autenticado (RLS limita a carteira visível). */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceData> => {
    const { supabase, userId } = context;

    const [
      customersRes,
      productsRes,
      pricesRes,
      tablesRes,
      groupsRes,
      inventoryRes,
      enrichRes,
      linksRes,
      profileRes,
      rulesRes,
      roleRes,
      sellersRes,
      brandsRes,
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("active", true).order("trade_name"),
      supabase.from("products").select("*").eq("active", true).order("erp_code"),
      supabase.from("product_prices").select("*"),
      supabase.from("price_tables").select("*"),
      supabase.from("product_groups").select("*"),
      supabase.from("inventory_snapshots").select("*"),
      supabase.from("product_enrichments").select("*"),
      supabase.from("user_erp_seller_links").select("seller_erp_code").eq("user_id", userId),
      supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      supabase.from("approval_rules").select("*").eq("active", true),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("erp_sellers").select("erp_code, name").order("erp_code"),
      supabase.from("brands").select("name").eq("active", true),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const approvalRules: ApprovalRule[] = (rulesRes.data ?? [])
      .filter((r) => r.valid_from <= today && (r.valid_to === null || r.valid_to >= today))
      .map((r) => ({
        exception: r.exception_type as ApprovalRule["exception"],
        authority: r.authority as ApprovalRule["authority"],
        ...(r.min_percent === null ? {} : { minPercent: Number(r.min_percent) }),
        ...(r.max_percent === null ? {} : { maxPercent: Number(r.max_percent) }),
        ...(r.min_amount === null ? {} : { minAmount: Number(r.min_amount) }),
        ...(r.max_amount === null ? {} : { maxAmount: Number(r.max_amount) }),
      }));

    const groupName = new Map((groupsRes.data ?? []).map((g) => [g.code, g.name]));
    const stock = new Map((inventoryRes.data ?? []).map((i) => [i.product_erp_code, Number(i.quantity)]));
    const image = new Map((enrichRes.data ?? []).map((e) => [e.product_erp_code, e.image_url]));

    const activeBrands = new Set((brandsRes.data ?? []).map((b: any) => b.name));
    
    const pricesByProduct = new Map<string, Record<string, number[]>>();
    for (const row of pricesRes.data ?? []) {
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

    const priceTables: PriceTable[] = (tablesRes.data ?? []).map((t) => ({
      code: t.code,
      name: t.name,
      mappedLevel: t.mapped_level,
      levelLabel: t.level_label,
    }));

    const customers: Customer[] = (customersRes.data ?? []).map((c) => ({
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

    const products: Product[] = (productsRes.data ?? [])
      .filter((p) => {
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
        brand: p.brand || (groupName.get(p.group_code ?? "") ?? p.group_code ?? "OUTROS").split(" ")[0].toUpperCase(),
        category: p.category || "DIVERSOS",
        prices: pricesByProduct.get(p.erp_code) ?? {},
      }));

    const lastUpdate =
      (inventoryRes.data ?? [])
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
    const sellers = (sellersRes.data ?? [])
      .map((s) => ({
        code: s.erp_code,
        name: s.name || `Representante ${s.erp_code}`,
        customerCount: custCountBySeller.get(s.erp_code) ?? 0,
      }))
      .filter((s) => s.customerCount > 0)
      .sort((a, b) => b.customerCount - a.customerCount);

    return {
      customers,
      products,
      priceTables,
      groups: (groupsRes.data ?? []).map((g) => g.name),
      sellerName: profileRes.data?.full_name || profileRes.data?.email || "Vendedor",
      sellerCodes: (linksRes.data ?? []).map((l) => l.seller_erp_code),
      sellers,
      lastUpdate,
      approvalRules,
      role: roleRes.data?.role || null,
    };
  });
