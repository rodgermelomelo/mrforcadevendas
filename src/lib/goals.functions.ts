/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SOLD_STATUSES = ["confirmed", "approved", "auto_approved"];
const PAGE_SIZE = 1000;
const GLOBAL_SCOPE_REF = "__global__";

export type GoalScope = "global" | "representative" | "team" | "brand" | "category" | "product";
export type GoalTargetSource = "seller_goals" | "goal_targets" | null;
export type GoalTargetKind = "configured" | "seller_sum" | "missing";

export interface GoalMetricRow {
  id: string | null;
  source: GoalTargetSource;
  scope: GoalScope;
  scopeRef: string;
  label: string;
  subtitle: string;
  targetValue: number;
  actualValue: number;
  progress: number;
  remainingValue: number;
  orderCount: number;
  itemCount: number;
  quantity: number;
  targetKind: GoalTargetKind;
}

export interface GoalOption {
  value: string;
  label: string;
  description: string;
}

export interface GoalsWorkspace {
  month: string;
  monthStart: string;
  canManage: boolean;
  scope: "all" | "visible";
  goalTargetsReady: boolean;
  totals: {
    targetValue: number;
    actualValue: number;
    progress: number;
    remainingValue: number;
    orderCount: number;
    sellerCount: number;
    missingTargets: number;
  };
  general: GoalMetricRow;
  representatives: GoalMetricRow[];
  teams: GoalMetricRow[];
  brands: GoalMetricRow[];
  categories: GoalMetricRow[];
  products: GoalMetricRow[];
  options: {
    representatives: GoalOption[];
    teams: GoalOption[];
    brands: GoalOption[];
    categories: GoalOption[];
    products: GoalOption[];
  };
}

export interface GoalTargetDraft {
  id?: string;
  scope: GoalScope;
  scopeRef: string;
  month: string;
  targetValue: number;
  notes?: string;
  active?: boolean;
}

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

function normalizeMonthInput(month: string | undefined) {
  const value = month ?? new Date().toISOString().slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(0, 7)}-01`;
  throw new Error("Período inválido.");
}

function monthKey(monthStart: string) {
  return monthStart.slice(0, 7);
}

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function progress(actualValue: number, targetValue: number) {
  if (targetValue <= 0) return 0;
  return Math.round((actualValue / targetValue) * 100);
}

function normalizeText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function categoryScopeRef(brand: string, category: string) {
  return `${brand}::${category}`;
}

function makeRow(input: {
  id?: string | null;
  source?: GoalTargetSource;
  scope: GoalScope;
  scopeRef: string;
  label: string;
  subtitle?: string;
  targetValue: number;
  actualValue: number;
  orderCount?: number;
  itemCount?: number;
  quantity?: number;
  targetKind?: GoalTargetKind;
}): GoalMetricRow {
  const targetValue = Math.max(0, input.targetValue);
  const actualValue = Math.max(0, input.actualValue);
  return {
    id: input.id ?? null,
    source: input.source ?? null,
    scope: input.scope,
    scopeRef: input.scopeRef,
    label: input.label,
    subtitle: input.subtitle ?? "",
    targetValue,
    actualValue,
    progress: progress(actualValue, targetValue),
    remainingValue: Math.max(0, targetValue - actualValue),
    orderCount: input.orderCount ?? 0,
    itemCount: input.itemCount ?? 0,
    quantity: input.quantity ?? 0,
    targetKind: input.targetKind ?? (targetValue > 0 ? "configured" : "missing"),
  };
}

function targetKey(scope: GoalScope, scopeRef: string) {
  return `${scope}:${scopeRef}`;
}

function missingGoalTargetsTable(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("goal_targets") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("not found"))
  );
}

async function readGoalTargets(
  db: any,
  monthStart: string,
): Promise<{ rows: any[]; ready: boolean }> {
  const { data, error } = await db
    .from("goal_targets" as any)
    .select("*")
    .eq("month", monthStart)
    .eq("active", true);
  if (error) {
    if (missingGoalTargetsTable(error)) return { rows: [], ready: false };
    throw new Error(error.message);
  }
  return { rows: data ?? [], ready: true };
}

async function visibleSellerCodes(context: { supabase: any; userId: string }) {
  const rpc = await context.supabase.rpc("visible_seller_codes", { _user_id: context.userId });
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data
      .map((row: any) => (typeof row === "string" ? row : row?.visible_seller_codes))
      .filter(Boolean) as string[];
  }

  const { data, error } = await context.supabase
    .from("user_erp_seller_links")
    .select("seller_erp_code")
    .eq("user_id", context.userId);
  if (error) return [];
  return [
    ...new Set((data ?? []).map((row: any) => row.seller_erp_code).filter(Boolean)),
  ] as string[];
}

async function canManageGoals(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_approver", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  return data === true;
}

async function assertGoalManager(context: { supabase: any; userId: string }) {
  if (!(await canManageGoals(context))) {
    throw new Error("Seu perfil não permite editar metas.");
  }
}

async function audit(
  context: { supabase: any; userId: string },
  entityId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  await context.supabase.from("audit_logs" as any).insert({
    actor_id: context.userId,
    entity: "goal_targets",
    entity_id: entityId,
    action,
    detail: JSON.parse(JSON.stringify(detail)),
  });
}

type SalesAccumulator = {
  actualValue: number;
  quantity: number;
  itemCount: number;
  orderIds: Set<string>;
};

function touchAccumulator(map: Map<string, SalesAccumulator>, key: string) {
  const current = map.get(key);
  if (current) return current;
  const next: SalesAccumulator = {
    actualValue: 0,
    quantity: 0,
    itemCount: 0,
    orderIds: new Set<string>(),
  };
  map.set(key, next);
  return next;
}

export const getGoalsWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month?: string } | undefined) => {
    const monthStart = normalizeMonthInput(input?.month);
    return { month: monthKey(monthStart), monthStart };
  })
  .handler(async ({ data, context }): Promise<GoalsWorkspace> => {
    const { supabase, userId } = context;
    const start = new Date(`${data.monthStart}T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const [adminRes, manageFlag, visibleCodes] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: userId }),
      canManageGoals(context),
      visibleSellerCodes(context),
    ]);
    if (adminRes.error) throw new Error(adminRes.error.message);
    const isAdmin = adminRes.data === true;

    let sellersQuery = supabase.from("erp_sellers").select("erp_code, name, active").order("name");
    if (!isAdmin) {
      sellersQuery = sellersQuery.in(
        "erp_code",
        visibleCodes.length > 0 ? visibleCodes : ["__none__"],
      );
    }

    const [
      sellersRes,
      sellerGoalsRes,
      goalTargetsRes,
      teamsRes,
      teamMembersRes,
      productsRes,
      ordersRes,
    ] = await Promise.all([
      sellersQuery,
      supabase
        .from("seller_goals" as any)
        .select("*")
        .eq("month", data.monthStart),
      readGoalTargets(supabase, data.monthStart),
      supabase
        .from("commercial_teams")
        .select("id, name, description, leader_user_id, active")
        .eq("active", true)
        .order("name"),
      supabase.from("commercial_team_sellers").select("team_id, seller_erp_code"),
      fetchAllRows(supabase, "products", "erp_code, name, brand, category, active", (q) =>
        q.eq("active", true).order("name"),
      ),
      supabase
        .from("orders")
        .select(
          "id, seller_erp_code, seller_name, total, status, created_at, order_items(product_erp_code, product_name, quantity, total)",
        )
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
    ]);

    for (const res of [sellersRes, sellerGoalsRes, teamsRes, teamMembersRes, ordersRes]) {
      if (res.error) throw new Error(res.error.message);
    }
    if (productsRes.error) throw new Error(productsRes.error.message);

    const sellers = (sellersRes.data ?? []) as any[];
    const allowedSellerCodes = new Set(sellers.map((seller) => seller.erp_code));

    const sellerGoals = new Map<string, any>();
    for (const row of (sellerGoalsRes.data ?? []) as any[]) {
      sellerGoals.set(row.seller_erp_code, row);
    }

    const goalTargets = new Map<string, any>();
    for (const row of goalTargetsRes.rows) {
      goalTargets.set(targetKey(row.scope as GoalScope, row.scope_ref), row);
    }

    const productRows = (productsRes.data ?? []) as any[];
    const productByCode = new Map<string, any>(
      productRows.map((product) => [product.erp_code, product]),
    );

    const soldOrders = ((ordersRes.data ?? []) as any[])
      .filter((order) => allowedSellerCodes.has(order.seller_erp_code))
      .filter((order) => SOLD_STATUSES.includes(order.status));

    const sellerActual = new Map<string, SalesAccumulator>();
    const brandActual = new Map<string, SalesAccumulator>();
    const categoryActual = new Map<string, SalesAccumulator>();
    const productActual = new Map<string, SalesAccumulator>();

    for (const order of soldOrders) {
      const sellerAcc = touchAccumulator(sellerActual, order.seller_erp_code);
      sellerAcc.actualValue += numberValue(order.total);
      sellerAcc.orderIds.add(order.id);

      for (const item of order.order_items ?? []) {
        const productCode = item.product_erp_code as string;
        const product = productByCode.get(productCode);
        const brand = normalizeText(product?.brand, "SEM MARCA");
        const category = normalizeText(product?.category, "DIVERSOS");
        const amount = numberValue(item.total);
        const quantity = numberValue(item.quantity);

        for (const [key, map] of [
          [brand, brandActual],
          [categoryScopeRef(brand, category), categoryActual],
          [productCode, productActual],
        ] as const) {
          const acc = touchAccumulator(map, key);
          acc.actualValue += amount;
          acc.quantity += quantity;
          acc.itemCount += 1;
          acc.orderIds.add(order.id);
        }
      }
    }

    const representativeRows = sellers.map((seller) => {
      const actual = sellerActual.get(seller.erp_code);
      const goal = sellerGoals.get(seller.erp_code);
      const targetValue = numberValue(goal?.target_value);
      return makeRow({
        id: goal?.id ?? null,
        source: goal ? "seller_goals" : null,
        scope: "representative",
        scopeRef: seller.erp_code,
        label: seller.name,
        subtitle: `${seller.erp_code}${seller.active === false ? " · inativo" : ""}`,
        targetValue,
        actualValue: actual?.actualValue ?? 0,
        orderCount: actual?.orderIds.size ?? 0,
        targetKind: goal ? "configured" : "missing",
      });
    });

    const teamMembers = new Map<string, string[]>();
    for (const member of (teamMembersRes.data ?? []) as any[]) {
      if (!allowedSellerCodes.has(member.seller_erp_code)) continue;
      const list = teamMembers.get(member.team_id) ?? [];
      list.push(member.seller_erp_code);
      teamMembers.set(member.team_id, list);
    }

    const teamRows = ((teamsRes.data ?? []) as any[]).map((team) => {
      const sellerCodes = teamMembers.get(team.id) ?? [];
      const direct = goalTargets.get(targetKey("team", team.id));
      const sellerGoalSum = sellerCodes.reduce(
        (acc, code) => acc + numberValue(sellerGoals.get(code)?.target_value),
        0,
      );
      const actualValue = sellerCodes.reduce(
        (acc, code) => acc + (sellerActual.get(code)?.actualValue ?? 0),
        0,
      );
      const orderIds = new Set<string>();
      for (const code of sellerCodes) {
        for (const orderId of sellerActual.get(code)?.orderIds ?? []) orderIds.add(orderId);
      }
      return makeRow({
        id: direct?.id ?? null,
        source: direct ? "goal_targets" : null,
        scope: "team",
        scopeRef: team.id,
        label: team.name,
        subtitle: `${sellerCodes.length.toLocaleString("pt-BR")} representantes`,
        targetValue: direct ? numberValue(direct.target_value) : sellerGoalSum,
        actualValue,
        orderCount: orderIds.size,
        targetKind: direct ? "configured" : sellerGoalSum > 0 ? "seller_sum" : "missing",
      });
    });

    const brandRows = buildDimensionRows({
      scope: "brand",
      actuals: brandActual,
      targets: goalTargets,
      labels: new Map(
        productRows.map((product) => [normalizeText(product.brand, "SEM MARCA"), ""]),
      ),
      subtitle: (key) =>
        `${productRows.filter((product) => normalizeText(product.brand, "SEM MARCA") === key).length} produtos`,
    });

    const categoryLabels = new Map<string, string>();
    for (const product of productRows) {
      const brand = normalizeText(product.brand, "SEM MARCA");
      const category = normalizeText(product.category, "DIVERSOS");
      categoryLabels.set(categoryScopeRef(brand, category), `${category} · ${brand}`);
    }
    const categoryRows = buildDimensionRows({
      scope: "category",
      actuals: categoryActual,
      targets: goalTargets,
      labels: categoryLabels,
      subtitle: (key) => {
        const [brand, category] = key.split("::");
        const count = productRows.filter(
          (product) =>
            normalizeText(product.brand, "SEM MARCA") === brand &&
            normalizeText(product.category, "DIVERSOS") === category,
        ).length;
        return `${count.toLocaleString("pt-BR")} produtos`;
      },
    });

    const productLabels = new Map<string, string>();
    const productSubtitles = new Map<string, string>();
    for (const product of productRows) {
      const brand = normalizeText(product.brand, "SEM MARCA");
      const category = normalizeText(product.category, "DIVERSOS");
      productLabels.set(product.erp_code, product.name);
      productSubtitles.set(product.erp_code, `${product.erp_code} · ${brand} · ${category}`);
    }
    const productRowsForGoals = buildDimensionRows({
      scope: "product",
      actuals: productActual,
      targets: goalTargets,
      labels: productLabels,
      subtitle: (key) => productSubtitles.get(key) ?? key,
    }).slice(0, 80);

    const directGlobal = goalTargets.get(targetKey("global", GLOBAL_SCOPE_REF));
    const targetTotal = directGlobal
      ? numberValue(directGlobal.target_value)
      : representativeRows.reduce((acc, row) => acc + row.targetValue, 0);
    const actualTotal = representativeRows.reduce((acc, row) => acc + row.actualValue, 0);
    const general = makeRow({
      id: directGlobal?.id ?? null,
      source: directGlobal ? "goal_targets" : null,
      scope: "global",
      scopeRef: GLOBAL_SCOPE_REF,
      label: "Meta geral",
      subtitle: directGlobal
        ? "Meta consolidada cadastrada"
        : "Somada a partir das metas dos representantes",
      targetValue: targetTotal,
      actualValue: actualTotal,
      orderCount: soldOrders.length,
      targetKind: directGlobal ? "configured" : targetTotal > 0 ? "seller_sum" : "missing",
    });

    const missingTargets = [
      ...representativeRows,
      ...teamRows,
      ...brandRows,
      ...categoryRows,
      ...productRowsForGoals,
    ].filter((row) => row.actualValue > 0 && row.targetValue <= 0).length;

    return {
      month: data.month,
      monthStart: data.monthStart,
      canManage: manageFlag,
      scope: isAdmin ? "all" : "visible",
      goalTargetsReady: goalTargetsRes.ready,
      totals: {
        targetValue: general.targetValue,
        actualValue: general.actualValue,
        progress: general.progress,
        remainingValue: general.remainingValue,
        orderCount: soldOrders.length,
        sellerCount: sellers.length,
        missingTargets,
      },
      general,
      representatives: sortRows(representativeRows),
      teams: sortRows(teamRows),
      brands: sortRows(brandRows),
      categories: sortRows(categoryRows),
      products: sortRows(productRowsForGoals),
      options: {
        representatives: sellers.map((seller) => ({
          value: seller.erp_code,
          label: seller.name,
          description: seller.erp_code,
        })),
        teams: ((teamsRes.data ?? []) as any[]).map((team) => ({
          value: team.id,
          label: team.name,
          description: team.description || "Equipe comercial",
        })),
        brands: uniqueOptions(
          productRows.map((product) => normalizeText(product.brand, "SEM MARCA")),
        ),
        categories: [...categoryLabels.entries()]
          .map(([value, label]) => ({ value, label, description: value.replace("::", " · ") }))
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
        products: productRows
          .map((product) => ({
            value: product.erp_code,
            label: product.name,
            description: `${product.erp_code} · ${normalizeText(product.brand, "SEM MARCA")}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
          .slice(0, 1000),
      },
    };
  });

function uniqueOptions(values: string[]): GoalOption[] {
  return [...new Set(values)]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((value) => ({ value, label: value, description: "Marca" }));
}

function sortRows(rows: GoalMetricRow[]) {
  return [...rows].sort(
    (a, b) => b.actualValue - a.actualValue || a.label.localeCompare(b.label, "pt-BR"),
  );
}

function buildDimensionRows(input: {
  scope: Extract<GoalScope, "brand" | "category" | "product">;
  actuals: Map<string, SalesAccumulator>;
  targets: Map<string, any>;
  labels: Map<string, string>;
  subtitle: (key: string) => string;
}) {
  const keys = new Set<string>();
  for (const key of input.actuals.keys()) keys.add(key);
  for (const [key, target] of input.targets.entries()) {
    if (target.scope === input.scope) keys.add(String(target.scope_ref));
  }

  return [...keys].map((key) => {
    const actual = input.actuals.get(key);
    const target = input.targets.get(targetKey(input.scope, key));
    return makeRow({
      id: target?.id ?? null,
      source: target ? "goal_targets" : null,
      scope: input.scope,
      scopeRef: key,
      label: input.labels.get(key) || key,
      subtitle: input.subtitle(key),
      targetValue: numberValue(target?.target_value),
      actualValue: actual?.actualValue ?? 0,
      orderCount: actual?.orderIds.size ?? 0,
      itemCount: actual?.itemCount ?? 0,
      quantity: actual?.quantity ?? 0,
      targetKind: target ? "configured" : "missing",
    });
  });
}

function validateGoalDraft(input: GoalTargetDraft): Required<GoalTargetDraft> {
  if (!input) throw new Error("Dados incompletos.");
  const scopes: GoalScope[] = ["global", "representative", "team", "brand", "category", "product"];
  if (!scopes.includes(input.scope)) throw new Error("Tipo de meta inválido.");
  const month = normalizeMonthInput(input.month);
  const scopeRef = input.scope === "global" ? GLOBAL_SCOPE_REF : input.scopeRef?.trim();
  if (!scopeRef) throw new Error("Selecione onde a meta será aplicada.");
  if (!Number.isFinite(input.targetValue) || input.targetValue < 0) {
    throw new Error("Valor de meta inválido.");
  }
  return {
    id: input.id ?? "",
    scope: input.scope,
    scopeRef,
    month,
    targetValue: input.targetValue,
    notes: input.notes?.trim() ?? "",
    active: input.active ?? true,
  };
}

export const saveGoalTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateGoalDraft)
  .handler(async ({ data, context }) => {
    await assertGoalManager(context);

    if (data.scope === "representative") {
      const { error } = await context.supabase.from("seller_goals" as any).upsert(
        {
          seller_erp_code: data.scopeRef,
          month: data.month,
          target_value: data.targetValue,
        },
        { onConflict: "seller_erp_code, month" },
      );
      if (error) throw new Error(error.message);
      await audit(context, data.scopeRef, "upsert_representative_goal", {
        month: data.month,
        targetValue: data.targetValue,
      });
      return { ok: true };
    }

    const { error } = await context.supabase.from("goal_targets" as any).upsert(
      {
        month: data.month,
        scope: data.scope,
        scope_ref: data.scopeRef,
        target_value: data.targetValue,
        notes: data.notes,
        active: data.active,
        created_by: context.userId,
      },
      { onConflict: "month, scope, scope_ref" },
    );

    if (error) {
      if (missingGoalTargetsTable(error)) {
        throw new Error("A tabela de metas gerais ainda não foi aplicada no Supabase.");
      }
      throw new Error(error.message);
    }

    await audit(context, `${data.scope}:${data.scopeRef}`, "upsert_goal", {
      scope: data.scope,
      scopeRef: data.scopeRef,
      month: data.month,
      targetValue: data.targetValue,
    });
    return { ok: true };
  });

export const deleteGoalTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; source: GoalTargetSource }) => {
    if (!input?.id) throw new Error("Meta inválida.");
    if (input.source !== "seller_goals" && input.source !== "goal_targets") {
      throw new Error("Origem da meta inválida.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertGoalManager(context);
    const table = data.source === "seller_goals" ? "seller_goals" : "goal_targets";
    const { error } = await context.supabase
      .from(table as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, data.id, "delete_goal", { source: data.source });
    return { ok: true };
  });
