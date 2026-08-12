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
  scope: "all" | "visible" | "team";
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

export interface CommercialTeamRow {
  id: string;
  name: string;
  description: string;
  leaderUserId: string | null;
  leaderName: string;
  leaderEmail: string | null;
  leaderRoles: string[];
  active: boolean;
  sellerCodes: string[];
  sellerNames: string[];
  members: CommercialTeamMemberRow[];
  sellerCount: number;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialTeamMemberRow {
  erpCode: string;
  name: string;
  active: boolean;
  customerCount: number;
}

export interface TeamUserOption {
  id: string;
  name: string;
  email: string | null;
  roles: string[];
}

export interface TeamSellerOption {
  erpCode: string;
  name: string;
  active: boolean;
  customerCount: number;
}

export interface CommercialTeamsPayload {
  canManageTeams: boolean;
  teams: CommercialTeamRow[];
  users: TeamUserOption[];
  sellers: TeamSellerOption[];
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

async function getAdminFlag(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  return data === true;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  if (!(await getAdminFlag(context)))
    throw new Error("Apenas administradores podem gerenciar equipes.");
}

/* --------------------------------- dados --------------------------------- */

export const getTeamOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month?: string; teamId?: string } | undefined) => {
    const month = input?.month;
    if (month && !/^\d{4}-\d{2}$/.test(month)) throw new Error("Período inválido.");
    return {
      month: month ?? new Date().toISOString().slice(0, 7),
      teamId: input?.teamId?.trim() || undefined,
    };
  })
  .handler(async ({ data, context }): Promise<TeamOverview> => {
    await assertApprover(context);
    const { supabase, userId } = context;

    const monthStart = `${data.month}-01`;
    const start = new Date(`${monthStart}T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const [adminRes, visibleRes, teamMembersRes] = await Promise.all([
      getAdminFlag(context),
      supabase.rpc("visible_seller_codes", { _user_id: userId }),
      data.teamId
        ? supabase
            .from("commercial_team_sellers")
            .select("seller_erp_code")
            .eq("team_id", data.teamId)
        : Promise.resolve({ data: null, error: null }),
    ]);

    const isAdmin = adminRes === true;
    if (teamMembersRes.error) throw new Error(teamMembersRes.error.message);
    const visibleCodes: string[] = Array.isArray(visibleRes.data)
      ? visibleRes.data
          .map((r: any) => (typeof r === "string" ? r : r?.visible_seller_codes))
          .filter(Boolean)
      : [];
    const teamCodes: string[] | null = data.teamId
      ? ((teamMembersRes.data ?? []) as any[]).map((r) => r.seller_erp_code).filter(Boolean)
      : null;

    let sellersQuery = supabase.from("erp_sellers").select("erp_code, name, active").order("name");
    if (teamCodes) {
      sellersQuery = sellersQuery.in("erp_code", teamCodes.length ? teamCodes : ["__none__"]);
    } else if (!isAdmin) {
      sellersQuery = sellersQuery.in("erp_code", visibleCodes.length ? visibleCodes : ["__none__"]);
    }

    const [sellersRes, goalsRes, ordersRes, customersRes, linksRes, profilesRes, canManageRes] =
      await Promise.all([
        sellersQuery,
        supabase
          .from("seller_goals" as any)
          .select("*")
          .eq("month", monthStart),
        supabase
          .from("orders")
          .select(
            "id, number, seller_erp_code, seller_name, customer_name, total, status, created_at",
          )
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false }),
        fetchAllRows(supabase, "customer_seller_links", "seller_erp_code, active", (q) =>
          q.eq("active", true),
        ),
        supabase.from("user_erp_seller_links").select("user_id, seller_erp_code"),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.rpc("is_approver", { _user_id: userId }),
      ]);

    const sellers = (sellersRes.data ?? []) as any[];
    const allowed = new Set(sellers.map((s) => s.erp_code));

    const goals = new Map<string, number>();
    for (const g of (goalsRes.data ?? []) as any[])
      goals.set(g.seller_erp_code, Number(g.target_value));

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
      scope: data.teamId ? "team" : isAdmin ? "all" : "visible",
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
      pendingOrders: orders
        .filter((o) => o.status === "pending_approval")
        .slice(0, 20)
        .map(toRow),
      recentOrders: orders.slice(0, 20).map(toRow),
    };
  });

export const getCommercialTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommercialTeamsPayload> => {
    await assertApprover(context);
    const { supabase, userId } = context;
    const isAdmin = await getAdminFlag(context);

    const [teamsRes, membersRes, sellersRes, customersRes, profilesRes, rolesRes] =
      await Promise.all([
        supabase
          .from("commercial_teams")
          .select("id, name, description, leader_user_id, active, created_at, updated_at")
          .order("name"),
        supabase.from("commercial_team_sellers").select("team_id, seller_erp_code"),
        supabase.from("erp_sellers").select("erp_code, name, active").order("name"),
        fetchAllRows(supabase, "customer_seller_links", "seller_erp_code, active", (q) =>
          q.eq("active", true),
        ),
        isAdmin
          ? supabase.from("profiles").select("id, full_name, email").order("full_name")
          : supabase.from("profiles").select("id, full_name, email").eq("id", userId),
        isAdmin
          ? supabase.from("user_roles").select("user_id, role")
          : supabase.from("user_roles").select("user_id, role").eq("user_id", userId),
      ]);

    for (const res of [teamsRes, membersRes, sellersRes, profilesRes, rolesRes]) {
      if (res.error) throw new Error(res.error.message);
    }
    if (customersRes.error) throw new Error(customersRes.error.message);

    const sellers = (sellersRes.data ?? []) as any[];
    const sellerName = new Map(sellers.map((s) => [s.erp_code, s.name]));
    const sellerByCode = new Map(sellers.map((s) => [s.erp_code, s]));
    const membersByTeam = new Map<string, string[]>();
    for (const member of (membersRes.data ?? []) as any[]) {
      const list = membersByTeam.get(member.team_id) ?? [];
      list.push(member.seller_erp_code);
      membersByTeam.set(member.team_id, list);
    }

    const customerCount = new Map<string, number>();
    for (const c of customersRes.data ?? []) {
      if (c.active === false) continue;
      customerCount.set(c.seller_erp_code, (customerCount.get(c.seller_erp_code) ?? 0) + 1);
    }

    const rolesByUser = new Map<string, string[]>();
    for (const role of (rolesRes.data ?? []) as any[]) {
      const list = rolesByUser.get(role.user_id) ?? [];
      list.push(role.role);
      rolesByUser.set(role.user_id, list);
    }

    const users = ((profilesRes.data ?? []) as any[]).map((profile) => ({
      id: profile.id,
      name: profile.full_name || profile.email || profile.id.slice(0, 8),
      email: profile.email,
      roles: rolesByUser.get(profile.id) ?? [],
    }));
    const userById = new Map(users.map((u) => [u.id, u]));

    const teams = ((teamsRes.data ?? []) as any[]).map((team) => {
      const sellerCodes = (membersByTeam.get(team.id) ?? []).sort();
      const leader = team.leader_user_id ? userById.get(team.leader_user_id) : null;
      const members = sellerCodes.map((code) => {
        const seller = sellerByCode.get(code);
        return {
          erpCode: code,
          name: seller?.name ?? code,
          active: seller?.active ?? true,
          customerCount: customerCount.get(code) ?? 0,
        } satisfies CommercialTeamMemberRow;
      });
      return {
        id: team.id,
        name: team.name,
        description: team.description ?? "",
        leaderUserId: team.leader_user_id,
        leaderName: leader?.name ?? "Sem líder",
        leaderEmail: leader?.email ?? null,
        leaderRoles: leader?.roles ?? [],
        active: team.active,
        sellerCodes,
        sellerNames: sellerCodes.map((code) => sellerName.get(code) ?? code),
        members,
        sellerCount: sellerCodes.length,
        customerCount: sellerCodes.reduce((acc, code) => acc + (customerCount.get(code) ?? 0), 0),
        createdAt: team.created_at,
        updatedAt: team.updated_at,
      } satisfies CommercialTeamRow;
    });

    return {
      canManageTeams: isAdmin,
      teams,
      users,
      sellers: sellers.map((seller) => ({
        erpCode: seller.erp_code,
        name: seller.name,
        active: seller.active,
        customerCount: customerCount.get(seller.erp_code) ?? 0,
      })),
    };
  });

export const saveCommercialTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      teamId?: string;
      name: string;
      description?: string;
      leaderUserId: string;
      sellerCodes: string[];
      active?: boolean;
    }) => {
      if (!input?.name?.trim()) throw new Error("Informe o nome da equipe.");
      if (!input?.leaderUserId) throw new Error("Selecione o líder da equipe.");
      if (!Array.isArray(input.sellerCodes) || input.sellerCodes.length === 0) {
        throw new Error("Selecione pelo menos um representante.");
      }
      return {
        teamId: input.teamId?.trim() || undefined,
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        leaderUserId: input.leaderUserId,
        sellerCodes: [...new Set(input.sellerCodes.map((code) => code.trim()).filter(Boolean))],
        active: input.active ?? true,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      name: data.name,
      description: data.description,
      leader_user_id: data.leaderUserId,
      active: data.active,
    };

    const teamRes = data.teamId
      ? await context.supabase
          .from("commercial_teams")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", data.teamId)
          .select("id")
          .single()
      : await context.supabase
          .from("commercial_teams")
          .insert({ ...payload, created_by: context.userId })
          .select("id")
          .single();
    if (teamRes.error) throw new Error(teamRes.error.message);

    const teamId = teamRes.data.id as string;
    const deleteRes = await context.supabase
      .from("commercial_team_sellers")
      .delete()
      .eq("team_id", teamId);
    if (deleteRes.error) throw new Error(deleteRes.error.message);

    const insertRes = await context.supabase
      .from("commercial_team_sellers")
      .insert(data.sellerCodes.map((code) => ({ team_id: teamId, seller_erp_code: code })));
    if (insertRes.error) throw new Error(insertRes.error.message);

    await context.supabase.from("audit_logs" as any).insert({
      actor_id: context.userId,
      entity: "commercial_teams",
      entity_id: teamId,
      action: data.teamId ? "update" : "create",
      detail: {
        name: data.name,
        leaderUserId: data.leaderUserId,
        sellerCount: data.sellerCodes.length,
      },
    });

    return { ok: true, teamId };
  });

export const deleteCommercialTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => {
    if (!input?.teamId) throw new Error("Equipe inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("commercial_teams")
      .delete()
      .eq("id", data.teamId);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs" as any).insert({
      actor_id: context.userId,
      entity: "commercial_teams",
      entity_id: data.teamId,
      action: "delete",
      detail: {},
    });
    return { ok: true };
  });

export const getIsApprover = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("is_approver", { _user_id: context.userId });
    return data === true;
  });
