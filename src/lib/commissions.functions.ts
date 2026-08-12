import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calculateCommissionLines,
  type CommissionLineResult,
  type CommissionRuleEngineRow,
} from "@/lib/commissions/engine";
import type { OrderItemSnapshot } from "@/lib/domain/types";

const SOLD_STATUSES = ["confirmed", "approved", "auto_approved"];
const PAGE_SIZE = 1000;

export interface CommissionRuleDraft {
  id?: string;
  name: string;
  percent: number;
  brand: string | null;
  category: string | null;
  productErpCode: string | null;
  sellerErpCodes: string[];
  priority: number;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  notes: string;
}

export interface CommissionRuleRow extends CommissionRuleDraft {
  id: string;
  productName: string | null;
  sellerLabels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommissionOptions {
  brands: string[];
  categories: { name: string; brand: string | null; productCount: number }[];
  products: { erpCode: string; name: string; brand: string | null; category: string | null }[];
  sellers: { erpCode: string; name: string; active: boolean }[];
}

export interface CommissionOrderRow {
  id: string;
  number: string;
  customerName: string;
  sellerErpCode: string;
  sellerName: string;
  total: number;
  commissionTotal: number;
  status: string;
  createdAt: string;
}

export interface MyCommissionSummary {
  month: string;
  sellerCodes: string[];
  totals: {
    sold: number;
    commission: number;
    orders: number;
    items: number;
    averageRate: number;
    pendingCommission: number;
  };
  recentOrders: CommissionOrderRow[];
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

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "administrador",
  });
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}

async function audit(
  context: { supabase: any; userId: string },
  entityId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  await context.supabase.from("audit_logs" as any).insert({
    actor_id: context.userId,
    entity: "commission_rules",
    entity_id: entityId,
    action,
    detail: JSON.parse(JSON.stringify(detail)),
  });
}

function cleanText(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
}

function mapRule(row: any): CommissionRuleEngineRow {
  return {
    id: row.id,
    name: row.name || "Regra de comissao",
    percent: Number(row.percent ?? 0),
    brand: row.brand ?? null,
    category: row.category ?? null,
    productErpCode: row.product_erp_code ?? null,
    priority: Number(row.priority ?? 100),
    validFrom: row.valid_from,
    validTo: row.valid_to ?? null,
    active: Boolean(row.active),
    sellerErpCodes: (row.commission_rule_sellers ?? []).map((s: any) => s.seller_erp_code),
  };
}

function validateRule(input: CommissionRuleDraft): CommissionRuleDraft {
  if (!input) throw new Error("Dados incompletos.");
  if (!Number.isFinite(input.percent) || input.percent < 0 || input.percent > 100) {
    throw new Error("Percentual de comissao invalido.");
  }
  if (!input.validFrom) throw new Error("Informe o inicio da vigencia.");
  if (input.validTo && input.validTo < input.validFrom) {
    throw new Error("Fim da vigencia nao pode ser anterior ao inicio.");
  }
  return {
    ...input,
    name: input.name.trim(),
    brand: cleanText(input.brand),
    category: cleanText(input.category),
    productErpCode: cleanText(input.productErpCode),
    sellerErpCodes: [...new Set((input.sellerErpCodes ?? []).map((code) => code.trim()).filter(Boolean))],
    notes: input.notes.trim(),
    priority: Number.isFinite(input.priority) ? input.priority : 100,
  };
}

export const listCommissionOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommissionOptions> => {
    await assertAdmin(context);
    const [productsRes, sellersRes] = await Promise.all([
      fetchAllRows(context.supabase, "products", "erp_code, name, brand, category, active", (q) =>
        q.eq("active", true).order("name"),
      ),
      context.supabase.from("erp_sellers").select("erp_code, name, active").order("name"),
    ]);
    if (productsRes.error) throw new Error(productsRes.error.message);
    if (sellersRes.error) throw new Error(sellersRes.error.message);

    const brands = new Set<string>();
    const categoryCount = new Map<string, { name: string; brand: string | null; productCount: number }>();
    for (const p of productsRes.data ?? []) {
      if (p.brand) brands.add(String(p.brand));
      if (!p.category) continue;
      const brand = p.brand ? String(p.brand) : null;
      const key = `${brand ?? ""}::${p.category}`;
      const current = categoryCount.get(key) ?? { name: String(p.category), brand, productCount: 0 };
      current.productCount += 1;
      categoryCount.set(key, current);
    }

    return {
      brands: [...brands].sort((a, b) => a.localeCompare(b, "pt-BR")),
      categories: [...categoryCount.values()].sort(
        (a, b) => (a.brand ?? "").localeCompare(b.brand ?? "", "pt-BR") || a.name.localeCompare(b.name, "pt-BR"),
      ),
      products: (productsRes.data ?? []).map((p: any) => ({
        erpCode: p.erp_code,
        name: p.name,
        brand: p.brand ?? null,
        category: p.category ?? null,
      })),
      sellers: (sellersRes.data ?? []).map((s: any) => ({
        erpCode: s.erp_code,
        name: s.name,
        active: s.active,
      })),
    };
  });

export const listCommissionRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommissionRuleRow[]> => {
    await assertAdmin(context);
    const [rulesRes, sellersRes, productsRes] = await Promise.all([
      context.supabase
        .from("commission_rules" as any)
        .select("*, commission_rule_sellers(seller_erp_code)")
        .order("active", { ascending: false })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      context.supabase.from("erp_sellers").select("erp_code, name"),
      context.supabase.from("products").select("erp_code, name"),
    ]);
    if (rulesRes.error) throw new Error(rulesRes.error.message);
    if (sellersRes.error) throw new Error(sellersRes.error.message);
    if (productsRes.error) throw new Error(productsRes.error.message);

    const sellerName = new Map((sellersRes.data ?? []).map((s: any) => [s.erp_code, s.name]));
    const productName = new Map((productsRes.data ?? []).map((p: any) => [p.erp_code, p.name]));

    return (rulesRes.data ?? []).map((row: any) => {
      const rule = mapRule(row);
      return {
        id: rule.id,
        name: rule.name,
        percent: rule.percent,
        brand: rule.brand,
        category: rule.category,
        productErpCode: rule.productErpCode,
        productName: rule.productErpCode ? String(productName.get(rule.productErpCode) ?? "") || null : null,
        sellerErpCodes: rule.sellerErpCodes,
        sellerLabels: rule.sellerErpCodes.map((code) => `${code} - ${sellerName.get(code) ?? code}`),
        priority: rule.priority,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        active: rule.active,
        notes: row.notes ?? "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  });

export const saveCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRule)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      name: data.name || "Regra de comissao",
      percent: data.percent,
      brand: data.brand,
      category: data.category,
      product_erp_code: data.productErpCode,
      priority: data.priority,
      valid_from: data.validFrom,
      valid_to: data.validTo,
      active: data.active,
      notes: data.notes,
    };

    let ruleId = data.id;
    if (ruleId) {
      const { error } = await context.supabase.from("commission_rules" as any).update(row).eq("id", ruleId);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await context.supabase
        .from("commission_rules" as any)
        .insert({ ...row, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      ruleId = (inserted as unknown as { id: string }).id;
    }

    const { error: deleteError } = await context.supabase
      .from("commission_rule_sellers" as any)
      .delete()
      .eq("rule_id", ruleId);
    if (deleteError) throw new Error(deleteError.message);

    if (data.sellerErpCodes.length > 0) {
      const { error: sellersError } = await context.supabase.from("commission_rule_sellers" as any).insert(
        data.sellerErpCodes.map((sellerErpCode) => ({
          rule_id: ruleId,
          seller_erp_code: sellerErpCode,
        })),
      );
      if (sellersError) throw new Error(sellersError.message);
    }

    await audit(context, ruleId!, data.id ? "update" : "create", {
      percent: data.percent,
      brand: data.brand,
      category: data.category,
      productErpCode: data.productErpCode,
      sellerCount: data.sellerErpCodes.length,
    });
    return { ok: true, id: ruleId };
  });

export const deleteCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Regra invalida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("commission_rules" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, data.id, "delete", {});
    return { ok: true };
  });

export async function calculateOrderCommissionsFromDb(
  supabase: any,
  input: {
    sellerErpCode: string;
    items: OrderItemSnapshot[];
    orderDiscountPercent: number;
    isBonus: boolean;
  },
): Promise<{ total: number; lines: CommissionLineResult[] }> {
  const codes = [...new Set(input.items.map((item) => item.erpCode))];
  const today = new Date().toISOString().slice(0, 10);
  const [productsRes, rulesRes] = await Promise.all([
    codes.length > 0
      ? supabase.from("products").select("erp_code, brand, category").in("erp_code", codes)
      : { data: [], error: null },
    supabase.from("commission_rules" as any).select("*, commission_rule_sellers(seller_erp_code)").eq("active", true),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (rulesRes.error) throw new Error(rulesRes.error.message);

  const products = (productsRes.data ?? []).map((p: any) => ({
    erpCode: p.erp_code,
    brand: p.brand ?? null,
    category: p.category ?? null,
  }));
  const rules = (rulesRes.data ?? [])
    .filter((r: any) => r.valid_from <= today && (r.valid_to === null || r.valid_to >= today))
    .map(mapRule);
  const lines = calculateCommissionLines({
    items: input.items.map((item) => ({ erpCode: item.erpCode, total: item.total })),
    products,
    rules,
    sellerErpCode: input.sellerErpCode,
    orderDiscountPercent: input.orderDiscountPercent,
    isBonus: input.isBonus,
  });
  const total = Math.round(lines.reduce((acc, line) => acc + line.commissionValue, 0) * 100) / 100;
  return { total, lines };
}

export const getMyCommissionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month?: string } | undefined) => {
    const month = input?.month ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Periodo invalido.");
    return { month };
  })
  .handler(async ({ data, context }): Promise<MyCommissionSummary> => {
    const { supabase, userId } = context;
    const monthStart = `${data.month}-01`;
    const start = new Date(`${monthStart}T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const { data: links, error: linksError } = await supabase
      .from("user_erp_seller_links")
      .select("seller_erp_code")
      .eq("user_id", userId);
    if (linksError) throw new Error(linksError.message);

    const sellerCodes = [...new Set((links ?? []).map((link: any) => link.seller_erp_code as string))];
    if (sellerCodes.length === 0) {
      return {
        month: data.month,
        sellerCodes: [],
        totals: { sold: 0, commission: 0, orders: 0, items: 0, averageRate: 0, pendingCommission: 0 },
        recentOrders: [],
      };
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, number, customer_name, seller_erp_code, seller_name, total, commission_total, status, created_at, order_items(id)")
      .in("seller_erp_code", sellerCodes)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (orders ?? []) as any[];
    const soldRows = rows.filter((order) => SOLD_STATUSES.includes(order.status));
    const sold = soldRows.reduce((acc, order) => acc + Number(order.total ?? 0), 0);
    const commission = soldRows.reduce((acc, order) => acc + Number(order.commission_total ?? 0), 0);
    const items = soldRows.reduce((acc, order) => acc + (order.order_items?.length ?? 0), 0);
    const pendingCommission = rows
      .filter((order) => order.status === "pending_approval")
      .reduce((acc, order) => acc + Number(order.commission_total ?? 0), 0);

    return {
      month: data.month,
      sellerCodes,
      totals: {
        sold,
        commission,
        orders: soldRows.length,
        items,
        averageRate: sold > 0 ? (commission / sold) * 100 : 0,
        pendingCommission,
      },
      recentOrders: rows.slice(0, 12).map((order) => ({
        id: order.id,
        number: order.number,
        customerName: order.customer_name,
        sellerErpCode: order.seller_erp_code,
        sellerName: order.seller_name,
        total: Number(order.total ?? 0),
        commissionTotal: Number(order.commission_total ?? 0),
        status: order.status,
        createdAt: order.created_at,
      })),
    };
  });
