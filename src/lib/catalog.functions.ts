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

const PAGE_SIZE = 1000;

async function fetchAllRows(
  db: any,
  table: string,
  select = "*",
  apply?: (query: any) => any,
): Promise<{ data: any[]; error: any }> {
  const rows: any[] = [];

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

/** Carrega carteira + catálogo do usuário autenticado (RLS limita a carteira visível). */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceData> => {
    const { supabase, userId } = context;

    // Use absolute raw supabase access with "as any" to bypass complex type checks
    const db: any = supabase;

    const [
      customersRes,
      productsRes,
      pricesRes,
      tablesRes,
      groupsRes,
      inventoryRes,
      enrichRes,
      customerLinksRes,
      linksRes,
      profileRes,
      rulesRes,
      roleRes,
      sellersRes,
      brandsRes,
      goalsRes,
    ] = await Promise.all([
      fetchAllRows(db, "customers", "*", (q) => q.eq("active", true).order("trade_name")),
      fetchAllRows(db, "products", "*", (q) => q.eq("active", true).order("erp_code")),
      fetchAllRows(db, "product_prices", "*", (q) => q.order("product_erp_code").order("price_table_code")),
      fetchAllRows(db, "price_tables", "*", (q) => q.order("code")),
      fetchAllRows(db, "product_groups", "*", (q) => q.order("code")),
      fetchAllRows(db, "inventory_snapshots", "*", (q) => q.order("product_erp_code")),
      fetchAllRows(db, "product_enrichments", "*", (q) => q.order("product_erp_code")),
      fetchAllRows(db, "customer_seller_links", "*", (q) =>
        q.eq("active", true).order("seller_erp_code").order("customer_erp_code"),
      ),
      db.from("user_erp_seller_links").select("seller_erp_code").eq("user_id", userId),
      db.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      db.from("approval_rules").select("*").eq("active", true),
      db.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      db.from("erp_sellers").select("erp_code, name").order("erp_code"),
      db.from("brands").select("name, active, metadata").eq("active", true),
      db.from("seller_goals").select("*").eq("month", new Date().toISOString().slice(0, 7) + "-01"),
    ]);

    const customerLinksMissing =
      Boolean(customerLinksRes.error) &&
      String(customerLinksRes.error.message ?? "")
        .toLowerCase()
        .includes("customer_seller_links");

    const failed = [
      ["customers", customersRes],
      ["products", productsRes],
      ["product_prices", pricesRes],
      ["price_tables", tablesRes],
      ["product_groups", groupsRes],
      ["inventory_snapshots", inventoryRes],
      ["product_enrichments", enrichRes],
      ...(customerLinksMissing ? [] : [["customer_seller_links", customerLinksRes]]),
      ["user_erp_seller_links", linksRes],
      ["profiles", profileRes],
      ["approval_rules", rulesRes],
      ["user_roles", roleRes],
      ["erp_sellers", sellersRes],
      ["brands", brandsRes],
      ["seller_goals", goalsRes],
    ].find(([, result]) => result.error);

    if (failed) {
      throw new Error(`Falha ao carregar ${failed[0]}: ${failed[1].error.message}`);
    }

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

    const customerByCode = new Map((customersRes.data ?? []).map((c: any) => [c.erp_code, c]));
    const customerContexts =
      (customerLinksRes.data ?? [])
        .map((link: any) => ({ link, customer: customerByCode.get(link.customer_erp_code) }))
        .filter((ctx: any) => Boolean(ctx.customer));

    // Compatibilidade temporária para bancos ainda sem vínculos migrados.
    const legacyCustomerContexts = (customersRes.data ?? []).map((customer: any) => ({
      customer,
      link: {
        seller_erp_code: customer.seller_erp_code,
        price_table_code: customer.price_table_code,
        payment_term: customer.payment_term,
        segment_code: customer.segment_code,
      },
    }));

    const customers: Customer[] = (customerContexts.length > 0 ? customerContexts : legacyCustomerContexts).map(
      ({ customer: c, link }: any) => ({
        id: `${c.id}:${link.seller_erp_code}`,
        erpCode: c.erp_code,
        legalName: c.legal_name,
        tradeName: c.trade_name,
        taxId: c.tax_id,
        city: c.city,
        uf: c.uf,
        segment: link.segment_code ?? c.segment_code ?? "",
        priceTableCode: link.price_table_code || c.price_table_code,
        paymentTerm: link.payment_term || c.payment_term,
        restricted: c.restricted,
        restrictionReason: c.restriction_reason ?? undefined,
        creditLimit: Number(c.credit_limit),
        openBalance: Number(c.open_balance),
        minOrderValue: Number(c.min_order_value),
        lastOrderAt: c.last_order_at,
        sellerErpCode: link.seller_erp_code,
      }),
    );

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
    
    const goalsBySeller = new Map((goalsRes.data ?? []).map((g: any) => [g.seller_erp_code, Number(g.target_value)]));

    const sellers = (sellersRes.data ?? [])
      .map((s: any) => ({
        code: s.erp_code,
        name: s.name || `Representante ${s.erp_code}`,
        customerCount: custCountBySeller.get(s.erp_code) ?? 0,
        monthlyGoal: goalsBySeller.get(s.erp_code),
      }))
      .filter((s: any) => s.customerCount > 0)
      .sort((a: any, b: any) => b.customerCount - a.customerCount);

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
