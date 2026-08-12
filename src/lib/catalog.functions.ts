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

    // Use absolute raw supabase access with "as any" to bypass complex type checks
    const db: any = supabase;

    const customersRes = await db.from("customers").select("*").eq("active", true).order("trade_name");
    const productsRes = await db.from("products").select("*").eq("active", true).order("erp_code");
    const pricesRes = await db.from("product_prices").select("*");
    const tablesRes = await db.from("price_tables").select("*");
    const groupsRes = await db.from("product_groups").select("*");
    const inventoryRes = await db.from("inventory_snapshots").select("*");
    const enrichRes = await db.from("product_enrichments").select("*");
    const linksRes = await db.from("user_erp_seller_links").select("seller_erp_code").eq("user_id", userId);
    const profileRes = await db.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const rulesRes = await db.from("approval_rules").select("*").eq("active", true);
    const roleRes = await db.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    const sellersRes = await db.from("erp_sellers").select("erp_code, name").order("erp_code");
    const brandsRes = await db.from("brands").select("name, active, metadata").eq("active", true);
    const goalsRes = await db.from("seller_goals").select("*").eq("month", new Date().toISOString().slice(0, 7) + "-01");

    const today = new Date().toISOString().slice(0, 10);
    const approvalRules: ApprovalRule[] = (rulesRes.data ?? [])
      .filter((r: any) => r.valid_from <= today && (r.valid_to === null || r.valid_to >= today))
      .map((r: any) => ({
        exception: r.exception_type as ApprovalRule["exception"],
        authority: r.authority as ApprovalRule["authority"],
        ...(r.min_percent === null ? {} : { minPercent: Number(r.min_percent) }),
        ...(r.max_percent === null ? {} : { maxPercent: Number(r.max_percent) }),
        ...(r.min_amount === null ? {} : { minAmount: Number(r.min_amount) }),
        ...(r.max_amount === null ? {} : { maxAmount: Number(r.max_amount) }),
      }));

    const groupName = new Map((groupsRes.data ?? []).map((g: any) => [g.code, g.name]));
    const stock = new Map((inventoryRes.data ?? []).map((i: any) => [i.product_erp_code, Number(i.quantity)]));
    const image = new Map((enrichRes.data ?? []).map((e: any) => [e.product_erp_code, e.image_url]));

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

    const priceTables: PriceTable[] = (tablesRes.data ?? []).map((t: any) => ({
      code: t.code,
      name: t.name,
      mappedLevel: t.mapped_level,
      levelLabel: t.level_label,
    }));

    const customers: Customer[] = (customersRes.data ?? []).map((c: any) => ({
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
      .filter((p: any) => {
        if (activeBrands.size === 0) return true;
        const brand = p.brand || (groupName.get(p.group_code ?? "") ?? p.group_code ?? "Outros").split(" ")[0];
        return activeBrands.has(brand);
      })
      .map((p: any) => ({
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
      (inventoryRes.data ?? [])
        .map((i: any) => i.captured_at)
        .sort()
        .at(-1) ?? null;

    // Representantes com contagem de clientes visíveis (para filtro da carteira).
    const custCountBySeller = new Map<string, number>();
    for (const c of customers) {
      const code = c.sellerErpCode;
      if (!code) continue;
      custCountBySeller.set(code, (custCountBySeller.get(code) ?? 0) + 1);
    }
    
    const goalsBySeller = new Map((goalsRes.data ?? []).map((g: any) => [g.seller_erp_code, Number(g.goal_amount)]));

    const sellers = (sellersRes.data ?? [])
      .map((s: any) => ({
        code: s.erp_code,
        name: s.name || `Representante ${s.erp_code}`,
        customerCount: custCountBySeller.get(s.erp_code) ?? 0,
        monthlyGoal: goalsBySeller.get(s.erp_code),
      }))
      .filter((s: any) => s.customerCount > 0)
      .sort((a, b) => b.customerCount - a.customerCount);

    return {
      customers,
      products,
      priceTables,
      groups: (groupsRes.data ?? []).map((g: any) => g.name),
      sellerName: profileRes.data?.full_name || profileRes.data?.email || "Vendedor",
      sellerCodes: (linksRes.data ?? []).map((l: any) => l.seller_erp_code),
      sellers,
      lastUpdate,
      approvalRules,
      role: roleRes.data?.role || null,
      brandMetadata: Object.fromEntries((brandsRes.data ?? []).map((b: any) => [b.name, b.metadata || {}])),
    };
  });
