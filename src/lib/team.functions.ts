import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------- contratos ------------------------------- */

export interface TeamSellerRow {
  erpCode: string;
  name: string;
  active: boolean;
  users: string[];
  customerCount: number;
  goal: number;
  sold: number;
  progress: number;
  orderCount: number;
  pendingCount: number;
  pendingValue: number;
  rejectedCount: number;
  draftCount: number;
  averageTicket: number;
  lastOrderAt: string | null;
}

export interface TeamOrderRow {
  id: string;
  number: string;
  sellerErpCode: string;
  sellerName: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface TeamOverview {
  month: string;
  scope: "all" | "visible";
  canManageGoals: boolean;
  totals: {
    sellers: number;
    goal: number;
    sold: number;
    progress: number;
    orderCount: number;
    pendingCount: number;
    pendingValue: number;
    activeSellers: number;
  };
  sellers: TeamSellerRow[];
  pendingOrders: TeamOrderRow[];
  recentOrders: TeamOrderRow[];
}

/** Status que contam como venda efetiva no período. */
const SOLD_STATUSES = ["confirmed", "approved", "auto_approved"];
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

/* ------------------------------- permissões ------------------------------ */

async function assertApprover(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_approver", { _user_id: context.userId });
  if (data !== true) throw new Error("Área exclusiva de gerentes, gestores e supervisores.");
}

/* --------------------------------- dados --------------------------------- */

export const getTeamOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month?: string } | undefined) => {
    const month = input?.month;
    if (month && !/^\d{4}-\d{2}$/.test(month)) throw new Error("Período inválido.");
    return { month: month ?? new Date().toISOString().slice(0, 7) };
  })
  .handler(async ({ data, context }): Promise<TeamOverview> => {
    await assertApprover(context);
    const { supabase, userId } = context;

    const monthStart = `${data.month}-01`;
    const start = new Date(`${monthStart}T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const [adminRes, visibleRes] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: userId }),
      supabase.rpc("visible_seller_codes", { _user_id: userId }),
    ]);

    const isAdmin = adminRes.data === true;
    const visibleCodes: string[] = Array.isArray(visibleRes.data)
      ? visibleRes.data.map((r: any) => (typeof r === "string" ? r : r?.visible_seller_codes)).filter(Boolean)
      : [];

    let sellersQuery = supabase.from("erp_sellers").select("erp_code, name, active").order("name");
    if (!isAdmin) sellersQuery = sellersQuery.in("erp_code", visibleCodes.length ? visibleCodes : ["__none__"]);

    const [sellersRes, goalsRes, ordersRes, customersRes, linksRes, profilesRes, canManageRes] =
      await Promise.all([
        sellersQuery,
        supabase.from("seller_goals" as any).select("*").eq("month", monthStart),
        supabase
          .from("orders")
          .select("id, number, seller_erp_code, seller_name, customer_name, total, status, created_at")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false }),
        fetchAllRows(supabase, "customer_seller_links", "seller_erp_code, active", (q) => q.eq("active", true)),
        supabase.from("user_erp_seller_links").select("user_id, seller_erp_code"),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.rpc("is_approver", { _user_id: userId }),
      ]);

    const sellers = (sellersRes.data ?? []) as any[];
    const allowed = new Set(sellers.map((s) => s.erp_code));

    const goals = new Map<string, number>();
    for (const g of (goalsRes.data ?? []) as any[]) goals.set(g.seller_erp_code, Number(g.target_value));

    const customerCount = new Map<string, number>();
    for (const c of (customersRes.data ?? []) as any[]) {
      if (c.active === false) continue;
      customerCount.set(c.seller_erp_code, (customerCount.get(c.seller_erp_code) ?? 0) + 1);
    }

    const profileLabel = new Map<string, string>();
    for (const p of (profilesRes.data ?? []) as any[]) {
      profileLabel.set(p.id, p.full_name || p.email || p.id.slice(0, 8));
    }
    const usersBySeller = new Map<string, string[]>();
    for (const l of (linksRes.data ?? []) as any[]) {
      const list = usersBySeller.get(l.seller_erp_code) ?? [];
      list.push(profileLabel.get(l.user_id) ?? l.user_id.slice(0, 8));
      usersBySeller.set(l.seller_erp_code, list);
    }

    const orders = ((ordersRes.data ?? []) as any[]).filter((o) => allowed.has(o.seller_erp_code));

    const rows: TeamSellerRow[] = sellers.map((s) => {
      const mine = orders.filter((o) => o.seller_erp_code === s.erp_code);
      const sold = mine
        .filter((o) => SOLD_STATUSES.includes(o.status))
        .reduce((acc, o) => acc + Number(o.total), 0);
      const soldCount = mine.filter((o) => SOLD_STATUSES.includes(o.status)).length;
      const pending = mine.filter((o) => o.status === "pending_approval");
      const goal = goals.get(s.erp_code) ?? 0;
      return {
        erpCode: s.erp_code,
        name: s.name,
        active: s.active,
        users: usersBySeller.get(s.erp_code) ?? [],
        customerCount: customerCount.get(s.erp_code) ?? 0,
        goal,
        sold,
        progress: goal > 0 ? Math.round((sold / goal) * 100) : 0,
        orderCount: mine.length,
        pendingCount: pending.length,
        pendingValue: pending.reduce((acc, o) => acc + Number(o.total), 0),
        rejectedCount: mine.filter((o) => o.status === "rejected").length,
        draftCount: mine.filter((o) => o.status === "draft").length,
        averageTicket: soldCount > 0 ? sold / soldCount : 0,
        lastOrderAt: mine.length > 0 ? mine[0].created_at : null,
      };
    });

    const toRow = (o: any): TeamOrderRow => ({
      id: o.id,
      number: o.number,
      sellerErpCode: o.seller_erp_code,
      sellerName: o.seller_name,
      customerName: o.customer_name,
      total: Number(o.total),
      status: o.status,
      createdAt: o.created_at,
    });

    const totalGoal = rows.reduce((acc, r) => acc + r.goal, 0);
    const totalSold = rows.reduce((acc, r) => acc + r.sold, 0);

    return {
      month: data.month,
      scope: isAdmin ? "all" : "visible",
      canManageGoals: canManageRes.data === true,
      totals: {
        sellers: rows.length,
        goal: totalGoal,
        sold: totalSold,
        progress: totalGoal > 0 ? Math.round((totalSold / totalGoal) * 100) : 0,
        orderCount: orders.length,
        pendingCount: orders.filter((o) => o.status === "pending_approval").length,
        pendingValue: orders
          .filter((o) => o.status === "pending_approval")
          .reduce((acc, o) => acc + Number(o.total), 0),
        activeSellers: rows.filter((r) => r.orderCount > 0).length,
      },
      sellers: rows,
      pendingOrders: orders.filter((o) => o.status === "pending_approval").slice(0, 20).map(toRow),
      recentOrders: orders.slice(0, 20).map(toRow),
    };
  });

export const getIsApprover = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("is_approver", { _user_id: context.userId });
    return data === true;
  });
