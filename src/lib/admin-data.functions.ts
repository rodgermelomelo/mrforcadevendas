import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

function normalizeAdminSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\-/\s]/g, "");
}

/** Todas as funções abaixo exigem papel de administrador. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "administrador",
  });
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}

/** Registro sanitizado de auditoria (nunca grava CNPJ, endereço ou financeiro bruto). */
async function audit(
  context: { supabase: any; userId: string },
  entity: string,
  entityId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  await context.supabase.from("audit_logs" as any).insert({
    actor_id: context.userId,
    entity,
    entity_id: entityId,
    action,
    detail: JSON.parse(JSON.stringify(detail)),
  });
}

/* ============================ TABELAS DE PREÇO ============================ */

export interface AdminPriceTable {
  code: string;
  name: string;
  mappedLevel: number | null;
  levelLabel: string | null;
  customerCount: number;
  productCount: number;
  samples: { erpCode: string; name: string; values: number[] }[];
}

export const listPriceTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPriceTable[]> => {
    await assertAdmin(context);
    const [tablesRes, customersRes, pricesRes, productsRes] = await Promise.all([
      context.supabase.from("price_tables").select("*").order("code"),
      fetchAllRows(context.supabase, "customer_seller_links", "price_table_code", (q) => q.eq("active", true)),
      fetchAllRows(context.supabase, "product_prices", "*", (q) => q.order("product_erp_code").order("price_table_code")),
      context.supabase.from("products").select("erp_code, name"),
    ]);

    const custCount = new Map<string, number>();
    for (const c of customersRes.data ?? []) {
      custCount.set(c.price_table_code, (custCount.get(c.price_table_code) ?? 0) + 1);
    }
    const productName = new Map((productsRes.data ?? []).map((p: any) => [p.erp_code, p.name]));

    const byTable = new Map<string, any[]>();
    for (const row of pricesRes.data ?? []) {
      const list = byTable.get(row.price_table_code) ?? [];
      if (list.length < 400) list.push(row);
      byTable.set(row.price_table_code, list);
    }
    const totalByTable = new Map<string, number>();
    for (const row of pricesRes.data ?? []) {
      totalByTable.set(row.price_table_code, (totalByTable.get(row.price_table_code) ?? 0) + 1);
    }

    return (tablesRes.data ?? []).map((t: any) => ({
      code: t.code,
      name: t.name,
      mappedLevel: t.mapped_level,
      levelLabel: t.level_label,
      customerCount: custCount.get(t.code) ?? 0,
      productCount: totalByTable.get(t.code) ?? 0,
      samples: (byTable.get(t.code) ?? [])
        .filter((r: any) => Number(r.value_1) > 0)
        .slice(0, 3)
        .map((r: any) => ({
          erpCode: r.product_erp_code,
          name: productName.get(r.product_erp_code) ?? r.product_erp_code,
          values: [r.value_1, r.value_2, r.value_3, r.value_4, r.value_5, r.value_6].map(Number),
        })),
    }));
  });

export const setPriceTableLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; level: number | null }) => {
    if (!input?.code) throw new Error("Tabela inválida.");
    if (input.level !== null && (input.level < 0 || input.level > 5)) throw new Error("Nível inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("price_tables")
      .update({
        mapped_level: data.level,
        level_label: data.level === null ? null : `Valor ${data.level + 1}`,
        updated_at: new Date().toISOString(),
      })
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    await audit(context, "price_tables", data.code, "set_level", { level: data.level });
    return { ok: true };
  });

/* ============================== REPRESENTANTES ============================ */

export interface AdminSeller {
  erpCode: string;
  name: string;
  active: boolean;
  customerCount: number;
  users: { userId: string; label: string }[];
  monthlyGoal?: number;
}

export const listSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSeller[]> => {
    await assertAdmin(context);
    const [sellersRes, customerLinksRes, linksRes, profilesRes, goalsRes] = await Promise.all([
      context.supabase.from("erp_sellers").select("*").order("erp_code"),
      fetchAllRows(context.supabase, "customer_seller_links", "seller_erp_code", (q) => q.eq("active", true)),
      context.supabase.from("user_erp_seller_links").select("*"),
      context.supabase.from("profiles").select("id, full_name, email"),
      context.supabase.from("seller_goals" as any).select("*").eq("month", new Date().toISOString().slice(0, 7) + "-01"),
    ]);
    const goals = new Map((goalsRes.data ?? []).map((g: any) => [g.seller_erp_code, Number(g.target_value)]));
    const count = new Map<string, number>();
    for (const c of customerLinksRes.data ?? []) {
      count.set(c.seller_erp_code, (count.get(c.seller_erp_code) ?? 0) + 1);
    }
    const profileLabel = new Map(
      (profilesRes.data ?? []).map((p: any) => [p.id, p.full_name || p.email || p.id.slice(0, 8)]),
    );
    const linksBySeller = new Map<string, { userId: string; label: string }[]>();
    for (const l of linksRes.data ?? []) {
      const list = linksBySeller.get(l.seller_erp_code) ?? [];
      list.push({ userId: l.user_id, label: String(profileLabel.get(l.user_id) ?? l.user_id.slice(0, 8)) });
      linksBySeller.set(l.seller_erp_code, list);
    }
    return (sellersRes.data ?? []).map((s: any) => ({
      erpCode: s.erp_code,
      name: s.name,
      active: s.active,
      customerCount: count.get(s.erp_code) ?? 0,
      users: linksBySeller.get(s.erp_code) ?? [],
      monthlyGoal: goals.get(s.erp_code) ?? 0,
    }));
  });

export interface SellerGoal {
  id: string;
  sellerErpCode: string;
  month: string;
  targetValue: number;
}

/** Metas podem ser geridas por administradores, gerentes comerciais e supervisores. */
async function canManageGoals(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_approver", { _user_id: context.userId });
  return data === true;
}

async function assertGoalManager(context: { supabase: any; userId: string }) {
  if (!(await canManageGoals(context))) {
    throw new Error("Seu perfil não permite editar metas.");
  }
}

export const getGoalPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ canManage: boolean }> => ({
    canManage: await canManageGoals(context),
  }));

export const listSellerGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month?: string; sellerErpCode?: string }) => input ?? {})
  .handler(async ({ data, context }): Promise<SellerGoal[]> => {
    let query = context.supabase.from("seller_goals" as any).select("*");
    if (data.month) query = query.eq("month", data.month);
    if (data.sellerErpCode) query = query.eq("seller_erp_code", data.sellerErpCode);
    const { data: rows, error } = await query.order("month", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      sellerErpCode: r.seller_erp_code,
      month: r.month,
      targetValue: Number(r.target_value),
    }));
  });

export const updateSellerGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sellerErpCode: string; month: string; targetValue: number }) => {
    if (!input?.sellerErpCode) throw new Error("Representante inválido.");
    if (!/^\d{4}-\d{2}-01$/.test(input?.month ?? "")) throw new Error("Mês inválido.");
    if (!Number.isFinite(input.targetValue) || input.targetValue < 0) throw new Error("Valor de meta inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertGoalManager(context);
    const { error } = await context.supabase.from("seller_goals" as any).upsert(
      {
        seller_erp_code: data.sellerErpCode,
        month: data.month,
        target_value: data.targetValue,
      },
      { onConflict: "seller_erp_code, month" },
    );
    if (error) throw new Error(error.message);
    await audit(context, "seller_goals", data.sellerErpCode, "update_goal", {
      month: data.month,
      target: data.targetValue,
    });
    return { ok: true };
  });

export const deleteSellerGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Meta inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertGoalManager(context);
    const { error } = await context.supabase.from("seller_goals" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "seller_goals", data.id, "delete_goal", {});
    return { ok: true };
  });


export const updateSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { erpCode: string; name?: string; active?: boolean }) => {
    if (!input?.erpCode) throw new Error("Representante inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.active !== undefined) patch["active"] = data.active;
    const { error } = await context.supabase.from("erp_sellers").update(patch as never).eq("erp_code", data.erpCode);
    if (error) throw new Error(error.message);
    await audit(context, "erp_sellers", data.erpCode, "update", patch);
    return { ok: true };
  });

export const setSellerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sellerErpCode: string; userId: string; linked: boolean }) => {
    if (!input?.sellerErpCode || !input?.userId) throw new Error("Dados incompletos.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.linked) {
      const { error } = await context.supabase
        .from("user_erp_seller_links")
        .insert({ user_id: data.userId, seller_erp_code: data.sellerErpCode });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("user_erp_seller_links")
        .delete()
        .eq("user_id", data.userId)
        .eq("seller_erp_code", data.sellerErpCode);
      if (error) throw new Error(error.message);
    }
    await audit(context, "user_erp_seller_links", data.sellerErpCode, data.linked ? "link" : "unlink", {
      userId: data.userId,
    });
    return { ok: true };
  });

/* =========================== DETALHE DO VENDEDOR ========================== */

export interface SellerDetail {
  seller: AdminSeller;
  customers: {
    erpCode: string;
    tradeName: string;
    city: string;
    uf: string;
    restricted: boolean;
    active: boolean;
  }[];
  recentOrders: {
    id: string;
    number: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
  stats: {
    totalCustomers: number;
    totalOrders: number;
    totalValue: number;
    pendingApprovals: number;
  };
}

export const getSellerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { erpCode: string }) => {
    if (!input?.erpCode) throw new Error("Representante inválido.");
    return input;
  })
  .handler(async ({ data, context }): Promise<SellerDetail> => {
    await assertAdmin(context);
    const code = data.erpCode;

    const [sellersRes, customerLinksRes, ordersRes, linksRes, profilesRes] = await Promise.all([
      context.supabase.from("erp_sellers").select("*").eq("erp_code", code).maybeSingle(),
      context.supabase
        .from("customer_seller_links" as any)
        .select("customer_erp_code")
        .eq("seller_erp_code", code)
        .eq("active", true),
      context.supabase.from("orders").select("id, number, customer_name, total, status, created_at").eq("seller_erp_code", code).order("created_at", { ascending: false }).limit(20),
      context.supabase.from("user_erp_seller_links").select("user_id").eq("seller_erp_code", code),
      context.supabase.from("profiles").select("id, full_name, email"),
    ]);

    const s = sellersRes.data;
    if (!s) throw new Error("Representante não encontrado.");
    const customerCodes = [...new Set((customerLinksRes.data ?? []).map((l: any) => l.customer_erp_code))];
    const customersRes =
      customerCodes.length > 0
        ? await context.supabase
            .from("customers")
            .select("erp_code, trade_name, city, uf, restricted, active")
            .in("erp_code", customerCodes)
            .order("trade_name")
        : { data: [], error: null };
    if (customersRes.error) throw new Error(customersRes.error.message);

    const profileLabel = new Map(
      (profilesRes.data ?? []).map((p: any) => [p.id, p.full_name || p.email || p.id.slice(0, 8)]),
    );

    const seller: AdminSeller = {
      erpCode: s.erp_code,
      name: s.name,
      active: s.active,
      customerCount: customersRes.data?.length ?? 0,
      users: (linksRes.data ?? []).map((l: any) => ({
        userId: l.user_id,
        label: String(profileLabel.get(l.user_id) ?? l.user_id.slice(0, 8)),
      })),
    };

    const orders = ordersRes.data ?? [];
    const stats = {
      totalCustomers: seller.customerCount,
      totalOrders: orders.length,
      totalValue: orders.reduce((acc: number, o: any) => acc + Number(o.total), 0),
      pendingApprovals: orders.filter((o: any) => o.status === "pending_approval").length,
    };

    return {
      seller,
      customers: (customersRes.data ?? []).map((c: any) => ({
        erpCode: c.erp_code,
        tradeName: c.trade_name,
        city: c.city,
        uf: c.uf,
        restricted: c.restricted,
        active: c.active,
      })),
      recentOrders: orders.map((o: any) => ({
        id: o.id,
        number: o.number,
        customerName: o.customer_name,
        total: Number(o.total),
        status: o.status,
        createdAt: o.created_at,
      })),
      stats,
    };
  });

/* ================================= CLIENTES =============================== */

export interface AdminCustomer {
  erpCode: string;
  legalName: string;
  tradeName: string;
  city: string;
  uf: string;
  sellerErpCode: string;
  priceTableCode: string;
  paymentTerm: string;
  segmentCode: string | null;
  restricted: boolean;
  restrictionReason: string | null;
  creditLimit: number;
  minOrderValue: number;
  active: boolean;
}

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { term?: string | undefined; page?: number; sellerErpCode?: string | undefined; restricted?: boolean | undefined; active?: boolean | undefined }) => input ?? {})
  .handler(async ({ data, context }): Promise<{ rows: AdminCustomer[]; total: number }> => {
    await assertAdmin(context);
    const page = Math.max(0, data.page ?? 0);
    const size = 25;
    const [linksRes, customersRes] = await Promise.all([
      fetchAllRows(
        context.supabase,
        "customer_seller_links",
        "customer_erp_code, seller_erp_code, price_table_code, payment_term, segment_code, active",
        (q) => q.order("seller_erp_code").order("customer_erp_code"),
      ),
      fetchAllRows(
        context.supabase,
        "customers",
        "erp_code, legal_name, trade_name, city, uf, seller_erp_code, price_table_code, payment_term, segment_code, restricted, restriction_reason, credit_limit, min_order_value, active",
        (q) => q.order("trade_name"),
      ),
    ]);
    if (linksRes.error) throw new Error(linksRes.error.message);
    if (customersRes.error) throw new Error(customersRes.error.message);

    const customerByCode = new Map((customersRes.data ?? []).map((c: any) => [c.erp_code, c]));
    const rows = (linksRes.data ?? [])
      .map((link: any) => ({ link, customer: customerByCode.get(link.customer_erp_code) }))
      .filter((ctx: any) => Boolean(ctx.customer))
      .map(({ link, customer: c }: any): AdminCustomer => ({
        erpCode: link.customer_erp_code,
        legalName: c.legal_name,
        tradeName: c.trade_name,
        city: c.city,
        uf: c.uf,
        sellerErpCode: link.seller_erp_code,
        priceTableCode: link.price_table_code,
        paymentTerm: link.payment_term,
        segmentCode: link.segment_code,
        restricted: c.restricted,
        restrictionReason: c.restriction_reason,
        creditLimit: Number(c.credit_limit),
        minOrderValue: Number(c.min_order_value),
        active: Boolean(link.active && c.active),
      }))
      .filter((row) => {
        if (data.sellerErpCode && row.sellerErpCode !== data.sellerErpCode) return false;
        if (data.restricted !== undefined && row.restricted !== data.restricted) return false;
        if (data.active !== undefined && row.active !== data.active) return false;
        const q = normalizeAdminSearch((data.term ?? "").trim());
        if (!q) return true;
        return normalizeAdminSearch(
          [row.erpCode, row.legalName, row.tradeName, row.city, row.uf, row.sellerErpCode, row.segmentCode ?? ""].join(" "),
        ).includes(q);
      })
      .sort(
        (a, b) =>
          a.tradeName.localeCompare(b.tradeName, "pt-BR") ||
          a.sellerErpCode.localeCompare(b.sellerErpCode),
      );
    const total = rows.length;
    const pagedRows = rows.slice(page * size, page * size + size);
    return {
      total,
      rows: pagedRows,
    };
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      erpCode: string;
      priceTableCode?: string;
      paymentTerm?: string;
      segmentCode?: string | null;
      sellerErpCode?: string;
      restricted?: boolean;
      restrictionReason?: string | null;
      creditLimit?: number;
      minOrderValue?: number;
      active?: boolean;
    }) => {
      if (!input?.erpCode) throw new Error("Cliente inválido.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { erpCode, ...rest } = data;
    const customerPatch: Record<string, unknown> = {};
    if (rest.restricted !== undefined) customerPatch["restricted"] = rest.restricted;
    if (rest.restrictionReason !== undefined) customerPatch["restriction_reason"] = rest.restrictionReason || null;
    if (rest.creditLimit !== undefined) customerPatch["credit_limit"] = rest.creditLimit;
    if (rest.minOrderValue !== undefined) customerPatch["min_order_value"] = rest.minOrderValue;
    if (Object.keys(customerPatch).length > 0) customerPatch["updated_at"] = new Date().toISOString();

    const linkPatch: Record<string, unknown> = {};
    if (rest.priceTableCode !== undefined) linkPatch["price_table_code"] = rest.priceTableCode;
    if (rest.paymentTerm !== undefined) linkPatch["payment_term"] = rest.paymentTerm;
    if (rest.segmentCode !== undefined) linkPatch["segment_code"] = rest.segmentCode || null;
    if (rest.active !== undefined) linkPatch["active"] = rest.active;
    if (Object.keys(linkPatch).length > 0) linkPatch["updated_at"] = new Date().toISOString();

    if (Object.keys(customerPatch).length > 0) {
      const { error } = await context.supabase.from("customers").update(customerPatch as never).eq("erp_code", erpCode);
      if (error) throw new Error(error.message);
    }
    if (Object.keys(linkPatch).length > 0 && rest.sellerErpCode) {
      const { error } = await context.supabase
        .from("customer_seller_links" as any)
        .update(linkPatch)
        .eq("customer_erp_code", erpCode)
        .eq("seller_erp_code", rest.sellerErpCode);
      if (error) throw new Error(error.message);
    }
    // Auditoria sanitizada: só os campos comerciais alterados, sem PII.
    await audit(context, "customers", erpCode, "update", {
      sellerErpCode: rest.sellerErpCode,
      fields: [...Object.keys(customerPatch), ...Object.keys(linkPatch)],
    });
    return { ok: true };
  });

/* ================================= PRODUTOS =============================== */

export interface AdminProduct {
  erpCode: string;
  name: string;
  displayName: string | null;
  imageUrl: string | null;
  groupCode: string | null;
  brand: string | null;
  category: string | null;
  erpBrandSuggestion: string | null;
  erpCategorySuggestion: string | null;
  unit: string;
  isLaunch: boolean;
  released: boolean;
  active: boolean;
  stock: number;
  priceTables: number;
  hasPrice: boolean;
  hasUnmappedTable: boolean;
}

export interface ProductListInput {
  term?: string;
  page?: number;
  stockFilter?: string;
  priceFilter?: string;
  catalogFilter?: string;
  groupCode?: string;
  sort?: string;
}

const PRODUCT_PAGE_SIZE = 25;

/** Coleta códigos (limitado) para filtros que dependem de outras tabelas. */
async function codesFrom(builder: any): Promise<Set<string>> {
  const { data } = await builder.limit(40000);
  return new Set((data ?? []).map((r: any) => r.product_erp_code as string));
}

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProductListInput) => input ?? {})
  .handler(async ({ data, context }): Promise<{ rows: AdminProduct[]; total: number }> => {
    await assertAdmin(context);
    const page = Math.max(0, data.page ?? 0);
    const size = PRODUCT_PAGE_SIZE;
    const term = (data.term ?? "").trim();
    const stockFilter = data.stockFilter ?? "todos";
    const priceFilter = data.priceFilter ?? "todos";
    const catalogFilter = data.catalogFilter ?? "todos";
    const sort = data.sort ?? "codigo";

    // Tabelas de preço sem nível mapeado (bloqueiam exibição de preço).
    const { data: tables } = await context.supabase.from("price_tables").select("code, mapped_level");
    const unmapped = new Set(
      (tables ?? []).filter((t: any) => t.mapped_level === null).map((t: any) => t.code as string),
    );

    // Restrição por códigos, quando o filtro depende de estoque/preço.
    let restrict: Set<string> | null = null;
    const intersect = (next: Set<string>) => {
      restrict = restrict === null ? next : new Set([...restrict].filter((c) => next.has(c)));
    };

    if (stockFilter !== "todos") {
      let q = context.supabase.from("inventory_snapshots").select("product_erp_code");
      if (stockFilter === "com_estoque") q = q.gt("quantity", 0);
      if (stockFilter === "sem_estoque") q = q.lte("quantity", 0);
      if (stockFilter === "negativo") q = q.lt("quantity", 0);
      intersect(await codesFrom(q));
    }

    if (priceFilter === "com_preco" || priceFilter === "sem_preco") {
      const withPrice = await codesFrom(context.supabase.from("product_prices").select("product_erp_code"));
      if (priceFilter === "com_preco") intersect(withPrice);
      else {
        const { data: all } = await context.supabase.from("products").select("erp_code").limit(20000);
        intersect(new Set((all ?? []).map((p: any) => p.erp_code).filter((c: string) => !withPrice.has(c))));
      }
    }
    if (priceFilter === "sem_nivel") {
      const codes =
        unmapped.size === 0
          ? new Set<string>()
          : await codesFrom(
              context.supabase
                .from("product_prices")
                .select("product_erp_code")
                .in("price_table_code", [...unmapped]),
            );
      intersect(codes);
    }

    const applyBase = (q: any) => {
      let out = q;
      if (term) {
        // Se o termo for exatamente uma marca ou categoria, filtramos direto
        out = out.or(`erp_code.ilike.%${term}%,name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`);
      }
      if (data.groupCode) out = out.eq("group_code", data.groupCode);
      if (catalogFilter === "liberado") out = out.eq("released", true).eq("active", true);
      if (catalogFilter === "fora") out = out.eq("released", false);
      if (catalogFilter === "inativo") out = out.eq("active", false);
      if (catalogFilter === "lancamento") out = out.eq("is_launch", true);
      if (restrict !== null) out = out.in("erp_code", restrict.size > 0 ? [...restrict] : ["__none__"]);
      return out;
    };

    let rows: any[] = [];
    let total = 0;

    if (sort === "estoque_desc" || sort === "estoque_asc") {
      // Ordenação por estoque exige o conjunto completo de códigos filtrados.
      const { data: codesRows } = await applyBase(context.supabase.from("products").select("erp_code")).limit(40000);
      const codes: string[] = (codesRows ?? []).map((p: any) => p.erp_code as string);
      const stockAll = new Map<string, number>();
      if (codes.length > 0) {
        const { data: inv } = await context.supabase
          .from("inventory_snapshots")
          .select("product_erp_code, quantity")
          .in("product_erp_code", codes);
        for (const i of inv ?? []) stockAll.set(i.product_erp_code, Number(i.quantity));
      }
      codes.sort((a: string, b: string) => {
        const diff = (stockAll.get(a) ?? 0) - (stockAll.get(b) ?? 0);
        return sort === "estoque_asc" ? diff : -diff;
      });
      total = codes.length;
      const pageCodes: string[] = codes.slice(page * size, page * size + size);
      if (pageCodes.length > 0) {
        const { data: pageRows } = await context.supabase.from("products").select("*").in("erp_code", pageCodes);
        const byCode = new Map((pageRows ?? []).map((p: any) => [p.erp_code, p]));
        rows = pageCodes.map((c: string) => byCode.get(c)).filter(Boolean);
      }

    } else {
      const orderCol = sort === "nome" ? "name" : "erp_code";
      const {
        data: pageRows,
        count,
        error,
      } = await applyBase(context.supabase.from("products").select("*", { count: "exact" }))
        .order(orderCol)
        .range(page * size, page * size + size - 1);
      if (error) throw new Error(error.message);
      rows = pageRows ?? [];
      total = count ?? 0;
    }

    const codes = rows.map((p: any) => p.erp_code);
    const [invRes, priceRes, enrichRes] = await Promise.all([
      context.supabase.from("inventory_snapshots").select("product_erp_code, quantity").in("product_erp_code", codes),
      context.supabase.from("product_prices").select("product_erp_code, price_table_code").in("product_erp_code", codes),
      context.supabase.from("product_enrichments").select("*").in("product_erp_code", codes),
    ]);
    const stock = new Map((invRes.data ?? []).map((i: any) => [i.product_erp_code, Number(i.quantity)]));
    const priceCount = new Map<string, number>();
    const unmappedByCode = new Map<string, boolean>();
    for (const p of priceRes.data ?? []) {
      priceCount.set(p.product_erp_code, (priceCount.get(p.product_erp_code) ?? 0) + 1);
      if (unmapped.has(p.price_table_code)) unmappedByCode.set(p.product_erp_code, true);
    }
    const enrich = new Map((enrichRes.data ?? []).map((e: any) => [e.product_erp_code, e]));

    return {
      total,
      rows: rows.map((p: any) => ({
        erpCode: p.erp_code,
        name: p.name,
        displayName: enrich.get(p.erp_code)?.display_name ?? null,
        imageUrl: enrich.get(p.erp_code)?.image_url ?? null,
        groupCode: p.group_code,
        brand: p.brand ?? null,
        category: p.category ?? null,
        erpBrandSuggestion: p.erp_brand_suggestion ?? null,
        erpCategorySuggestion: p.erp_category_suggestion ?? null,
        unit: p.unit,
        isLaunch: p.is_launch,
        released: p.released,
        active: p.active,
        stock: stock.get(p.erp_code) ?? 0,
        priceTables: priceCount.get(p.erp_code) ?? 0,
        hasPrice: (priceCount.get(p.erp_code) ?? 0) > 0,
        hasUnmappedTable: unmappedByCode.get(p.erp_code) ?? false,
      })),
    };
  });

/* ------------------------- DETALHE DO PRODUTO (modal) --------------------- */

export interface ProductDetail {
  product: AdminProduct;
  description: string | null;
  updatedAt: string | null;
  missingSince: string | null;
  stockCapturedAt: string | null;
  eans: string[];
  prices: {
    priceTableCode: string;
    priceTableName: string;
    values: number[];
    mappedLevel: number | null;
    levelLabel: string | null;
    applicable: number | null;
  }[];
}

export const getProductDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { erpCode: string }) => {
    if (!input?.erpCode) throw new Error("Produto inválido.");
    return input;
  })
  .handler(async ({ data, context }): Promise<ProductDetail> => {
    await assertAdmin(context);
    const code = data.erpCode;

    const [prodRes, enrichRes, invRes, priceRes, tableRes, eanRes] = await Promise.all([
      context.supabase.from("products").select("*").eq("erp_code", code).maybeSingle(),
      context.supabase.from("product_enrichments").select("*").eq("product_erp_code", code).maybeSingle(),
      context.supabase.from("inventory_snapshots").select("*").eq("product_erp_code", code).maybeSingle(),
      context.supabase.from("product_prices").select("*").eq("product_erp_code", code),
      context.supabase.from("price_tables").select("code, name, mapped_level, level_label"),
      context.supabase.from("product_eans").select("ean").eq("product_erp_code", code),
    ]);

    const p: any = prodRes.data;
    if (!p) throw new Error("Produto não encontrado.");
    const e: any = enrichRes.data;
    const tableByCode = new Map((tableRes.data ?? []).map((t: any) => [t.code, t]));

    const prices = (priceRes.data ?? [])
      .map((r: any) => {
        const t: any = tableByCode.get(r.price_table_code);
        const values = [r.value_1, r.value_2, r.value_3, r.value_4, r.value_5, r.value_6].map(Number);
        const level = (t?.mapped_level ?? null) as number | null;
        return {
          priceTableCode: r.price_table_code,
          priceTableName: (t?.name as string) ?? "Tabela desconhecida",
          values,
          mappedLevel: level,
          levelLabel: (t?.level_label as string) ?? null,
          applicable: level ? (values[level - 1] ?? null) : null,
        };
      })
      .sort((a, b) => a.priceTableCode.localeCompare(b.priceTableCode));

    return {
      product: {
        erpCode: p.erp_code,
        name: p.name,
        displayName: e?.display_name ?? null,
        imageUrl: e?.image_url ?? null,
        groupCode: p.group_code,
        brand: p.brand ?? null,
        category: p.category ?? null,
        erpBrandSuggestion: p.erp_brand_suggestion ?? null,
        erpCategorySuggestion: p.erp_category_suggestion ?? null,
        unit: p.unit,
        isLaunch: p.is_launch,
        released: p.released,
        active: p.active,
        stock: invRes.data ? Number((invRes.data as any).quantity) : 0,
        priceTables: prices.length,
        hasPrice: prices.length > 0,
        hasUnmappedTable: prices.some((x) => x.mappedLevel === null),
      },
      description: e?.description ?? null,
      updatedAt: p.updated_at ?? null,
      missingSince: p.missing_since ?? null,
      stockCapturedAt: invRes.data ? ((invRes.data as any).captured_at ?? null) : null,
      eans: (eanRes.data ?? []).map((x: any) => x.ean),
      prices,
    };
  });


export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      erpCode: string;
      released?: boolean;
      isLaunch?: boolean;
      active?: boolean;
      groupCode?: string | null;
      unit?: string;
      displayName?: string | null;
      imageUrl?: string | null;
      brand?: string | null;
      category?: string | null;
    }) => {
      if (!input?.erpCode) throw new Error("Produto inválido.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = {};
    if (data.released !== undefined) patch["released"] = data.released;
    if (data.isLaunch !== undefined) patch["is_launch"] = data.isLaunch;
    if (data.active !== undefined) patch["active"] = data.active;
    if (data.groupCode !== undefined) patch["group_code"] = data.groupCode || null;
    if (data.unit !== undefined) patch["unit"] = data.unit;
    if (data.brand !== undefined) patch["brand"] = data.brand || null;
    if (data.category !== undefined) patch["category"] = data.category || null;
    if (Object.keys(patch).length > 0) {
      patch["updated_at"] = new Date().toISOString();
      const { error } = await context.supabase.from("products").update(patch as never).eq("erp_code", data.erpCode);
      if (error) throw new Error(error.message);
    }

    // Enriquecimento nunca é apagado pela importação do ERP.
    if (data.displayName !== undefined || data.imageUrl !== undefined) {
      const enrichPatch: Record<string, unknown> = { product_erp_code: data.erpCode, updated_at: new Date().toISOString() };
      if (data.displayName !== undefined) enrichPatch["display_name"] = data.displayName || null;
      if (data.imageUrl !== undefined) enrichPatch["image_url"] = data.imageUrl || null;
      const { error } = await context.supabase
        .from("product_enrichments")
        .upsert(enrichPatch as never, { onConflict: "product_erp_code" });
      if (error) throw new Error(error.message);
    }
    await audit(context, "products", data.erpCode, "update", { fields: Object.keys(data) });
    return { ok: true };
  });

export const bulkUpdateProductBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      erpCodes: string[];
      brand: string | null;
    }) => {
      if (!Array.isArray(input?.erpCodes) || input.erpCodes.length === 0) {
        throw new Error("Nenhum produto selecionado.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("products")
      .update({
        brand: data.brand || null,
        updated_at: new Date().toISOString(),
      } as never)
      .in("erp_code", data.erpCodes);

    if (error) throw new Error(error.message);

    await audit(context, "products", "bulk", "bulk_update_brand", {
      count: data.erpCodes.length,
      brand: data.brand,
      codes: data.erpCodes.slice(0, 10), // Apenas os 10 primeiros para o log não ficar gigante
    });

    return { ok: true };
  });


/* ============================= USUÁRIOS E PAPÉIS ========================== */

export type AppRole =
  | "vendedor_externo"
  | "vendedor_interno"
  | "supervisor"
  | "gerente_comercial"
  | "administrador"
  | "operador_integracao";

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  roles: AppRole[];
  sellerCodes: string[];
  visibilityCodes: string[];
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context);
    const [profilesRes, rolesRes, linksRes, visRes] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email").order("full_name"),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("user_erp_seller_links").select("user_id, seller_erp_code"),
      context.supabase.from("team_visibility").select("user_id, seller_erp_code"),
    ]);
    const group = <T,>(rows: any[], key: string, pick: (r: any) => T) => {
      const map = new Map<string, T[]>();
      for (const r of rows) {
        const list = map.get(r[key]) ?? [];
        list.push(pick(r));
        map.set(r[key], list);
      }
      return map;
    };
    const roles = group(rolesRes.data ?? [], "user_id", (r) => r.role as AppRole);
    const links = group(linksRes.data ?? [], "user_id", (r) => r.seller_erp_code as string);
    const vis = group(visRes.data ?? [], "user_id", (r) => r.seller_erp_code as string);
    return (profilesRes.data ?? []).map((p: any) => ({
      id: p.id,
      name: p.full_name || p.email || p.id.slice(0, 8),
      email: p.email,
      roles: roles.get(p.id) ?? [],
      sellerCodes: links.get(p.id) ?? [],
      visibilityCodes: vis.get(p.id) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: AppRole }) => {
    if (!input?.userId || !input?.role) throw new Error("Dados incompletos.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Você não pode alterar o seu próprio papel.");
    }
    const { error: delErr } = await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    await audit(context, "user_roles", data.userId, "set_role", { role: data.role });
    return { ok: true };
  });

export const setUserVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; sellerCodes: string[] }) => {
    if (!input?.userId || !Array.isArray(input.sellerCodes)) throw new Error("Dados incompletos.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error: delErr } = await context.supabase.from("team_visibility").delete().eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.sellerCodes.length > 0) {
      const { error } = await context.supabase
        .from("team_visibility")
        .insert(data.sellerCodes.map((code) => ({ user_id: data.userId, seller_erp_code: code })));
      if (error) throw new Error(error.message);
    }
    await audit(context, "team_visibility", data.userId, "set_visibility", { count: data.sellerCodes.length });
    return { ok: true };
  });

export const createUserWithRoleAndSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; name: string; role: AppRole; sellerCode?: string }) => {
    if (!input.email || !input.name || !input.role) throw new Error("Dados incompletos.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Senha temporária
    const rand = Math.random().toString(36).slice(2, 10);
    const tempPassword = `Mr${rand}!7`;

    // 1. Criar no Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.name },
    });

    if (authErr || !authData.user) throw new Error(authErr?.message || "Erro ao criar usuário no Auth.");

    const userId = authData.user.id;

    // 2. Papel
    // O trigger handle_new_user pode ter criado 'vendedor_externo'
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleErr) throw new Error(`Usuário criado, mas falha ao atribuir papel: ${roleErr.message}`);

    // 3. Vínculo com representante (opcional)
    if (data.sellerCode) {
      const { error: linkErr } = await supabaseAdmin.from("user_erp_seller_links").insert({
        user_id: userId,
        seller_erp_code: data.sellerCode,
      });
      if (linkErr) throw new Error(`Usuário criado, mas falha ao vincular representante: ${linkErr.message}`);
    }

    await audit(context, "users", userId, "create_user", {
      email: data.email,
      role: data.role,
      sellerCode: data.sellerCode,
    });

    return { ok: true, tempPassword };
  });

/* ============================== CADASTROS GERAIS ========================== */

export interface CodeLabelRow {
  code: string;
  label: string;
  extra?: boolean;
  active?: boolean;
  productCount?: number;
  metadata?: {
    isCategory?: boolean;
    parentBrand?: string | null;
  };
}

export interface RegistriesData {
  groups: CodeLabelRow[];
  segments: CodeLabelRow[];
  billingMethods: CodeLabelRow[];
  paymentTerms: CodeLabelRow[];
  brands: CodeLabelRow[];
}

export const listRegistries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegistriesData> => {
    await assertAdmin(context);
    const [groups, segments, billing, terms, products, brands] = await Promise.all([
      context.supabase.from("product_groups").select("*").order("code"),
      context.supabase.from("segments").select("*").order("code"),
      context.supabase.from("billing_methods").select("*").order("code"),
      context.supabase.from("payment_terms").select("*").order("code"),
      context.supabase.from("products").select("brand, erp_code"),
      context.supabase.from("brands").select("*"),
    ]);

    const productCounts = new Map<string, number>();
    for (const p of products.data ?? []) {
      if (p.brand) {
        const brandKey = p.brand.toUpperCase();
        productCounts.set(brandKey, (productCounts.get(brandKey) ?? 0) + 1);
      }
    }

    const brandsTableData = brands.data ?? [];
    const brandsTableNames = new Set(brandsTableData.map((b: any) => b.name));
    
    // Unificar marcas da tabela com marcas encontradas nos produtos (normalizando para maiúsculas)
    const allBrandNames = new Set([
      ...Array.from(brandsTableNames).map((n: any) => n.toUpperCase()),
      ...Array.from(productCounts.keys()).map((k: any) => k.toUpperCase())
    ]);

    const finalBrands = [...allBrandNames]
      .sort((a, b) => a.localeCompare(b))
      .map(name => {
        const tableRow = brandsTableData.find((b: any) => b.name.toUpperCase() === name);
        return {
          code: name,
          label: name,
          productCount: productCounts.get(name) ?? 0,
          active: tableRow?.active ?? true,
          metadata: tableRow?.metadata || {},
        };
      });

    return {
      groups: (groups.data ?? []).map((r: any) => ({ code: r.code, label: r.name })),
      segments: (segments.data ?? []).map((r: any) => ({ code: r.code, label: r.name })),
      billingMethods: (billing.data ?? []).map((r: any) => ({ code: r.code, label: r.description })),
      paymentTerms: (terms.data ?? []).map((r: any) => ({
        code: r.code,
        label: r.description,
        extra: r.is_standard,
      })),
      brands: finalBrands as CodeLabelRow[],
    };
  });

export const updateRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: "groups" | "segments" | "billingMethods" | "paymentTerms" | "brands";
      code: string;
      label: string;
      isStandard?: boolean;
      active?: boolean;
      metadata?: any;
    }) => {
      if (!input?.code || !input?.kind) throw new Error("Dados incompletos.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const map = {
      groups: { table: "product_groups", field: "name", key: "code" },
      segments: { table: "segments", field: "name", key: "code" },
      billingMethods: { table: "billing_methods", field: "description", key: "code" },
      paymentTerms: { table: "payment_terms", field: "description", key: "code" },
      brands: { table: "brands", field: "name", key: "name" },
    } as const;
    const target = map[data.kind];
    const patch: Record<string, unknown> = { [target.field]: data.label };
    if (data.kind === "paymentTerms" && data.isStandard !== undefined) patch["is_standard"] = data.isStandard;
    if (data.kind === "brands" && data.active !== undefined) patch["active"] = data.active;
    if (data.kind === "brands" && data.metadata !== undefined) patch["metadata"] = data.metadata;
    
    const { error } = await context.supabase.from(target.table).update(patch as never).eq(target.key as any, data.code);
    if (error) throw new Error(error.message);
    await audit(context, target.table, data.code, "update", patch);
    return { ok: true };
  });

/* ============================= REGRAS COMERCIAIS ========================== */

export interface ApprovalRuleRow {
  id: string;
  exceptionType: string;
  minPercent: number | null;
  maxPercent: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  segmentCode: string | null;
  priceTableCode: string | null;
  authority: AppRole;
  validFrom: string;
  validTo: string | null;
  active: boolean;
}

export const listApprovalRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApprovalRuleRow[]> => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("approval_rules")
      .select("*")
      .order("exception_type")
      .order("min_percent", { nullsFirst: true });
    return (data ?? []).map((r: any) => ({
      id: r.id,
      exceptionType: r.exception_type,
      minPercent: r.min_percent === null ? null : Number(r.min_percent),
      maxPercent: r.max_percent === null ? null : Number(r.max_percent),
      minAmount: r.min_amount === null ? null : Number(r.min_amount),
      maxAmount: r.max_amount === null ? null : Number(r.max_amount),
      segmentCode: r.segment_code,
      priceTableCode: r.price_table_code,
      authority: r.authority,
      validFrom: r.valid_from,
      validTo: r.valid_to,
      active: r.active,
    }));
  });

export const saveApprovalRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      exceptionType: string;
      minPercent: number | null;
      maxPercent: number | null;
      minAmount: number | null;
      maxAmount: number | null;
      authority: AppRole;
      validFrom: string;
      validTo: string | null;
      active: boolean;
    }) => {
      if (!input?.exceptionType || !input?.authority) throw new Error("Dados incompletos.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      exception_type: data.exceptionType,
      min_percent: data.minPercent,
      max_percent: data.maxPercent,
      min_amount: data.minAmount,
      max_amount: data.maxAmount,
      authority: data.authority,
      valid_from: data.validFrom,
      valid_to: data.validTo,
      active: data.active,
    };
    if (data.id) {
      const { error } = await context.supabase.from("approval_rules").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("approval_rules").insert(row);
      if (error) throw new Error(error.message);
    }
    await audit(context, "approval_rules", data.id ?? "novo", "save", { exception: data.exceptionType });
    return { ok: true };
  });

export const deleteApprovalRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Regra inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("approval_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "approval_rules", data.id, "delete", {});
    return { ok: true };
  });

/* =========================== DIAGNÓSTICO DO CATÁLOGO ====================== */

export interface DiagnosisRow {
  erpCode: string;
  classification: string;
  detail: string | null;
  inCatalog: boolean;
  released: boolean;
  name: string | null;
}

export const listDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { classification?: string; page?: number }) => input ?? {})
  .handler(
    async ({
      data,
      context,
    }): Promise<{ rows: DiagnosisRow[]; total: number; summary: { classification: string; count: number }[] }> => {
      await assertAdmin(context);
      const page = Math.max(0, data.page ?? 0);
      const size = 30;

      const { data: all } = await context.supabase.from("catalog_review").select("classification");
      const summaryMap = new Map<string, number>();
      for (const r of all ?? []) summaryMap.set(r.classification, (summaryMap.get(r.classification) ?? 0) + 1);

      let query = context.supabase.from("catalog_review").select("*", { count: "exact" });
      if (data.classification && data.classification !== "todos") {
        query = query.eq("classification", data.classification);
      }
      const { data: rows, count, error } = await query.order("erp_code").range(page * size, page * size + size - 1);
      if (error) throw new Error(error.message);

      const codes = (rows ?? []).map((r: any) => r.erp_code);
      const { data: prods } = await context.supabase
        .from("products")
        .select("erp_code, name, released")
        .in("erp_code", codes);
      const prodMap = new Map((prods ?? []).map((p: any) => [p.erp_code, p]));

      return {
        total: count ?? 0,
        summary: [...summaryMap.entries()].map(([classification, c]) => ({ classification, count: c })),
        rows: (rows ?? []).map((r: any) => ({
          erpCode: r.erp_code,
          classification: r.classification,
          detail: r.detail ?? null,
          inCatalog: prodMap.has(r.erp_code),
          released: prodMap.get(r.erp_code)?.released ?? false,
          name: prodMap.get(r.erp_code)?.name ?? null,
        })),
      };
    },
  );

/* ================================ AUDITORIA =============================== */

export interface AuditRow {
  id: string;
  createdAt: string;
  actorName: string;
  entity: string;
  entityId: string | null;
  action: string;
  detail: string;
}

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number }) => input ?? {})
  .handler(async ({ data, context }): Promise<{ rows: AuditRow[]; total: number }> => {
    await assertAdmin(context);
    const page = Math.max(0, data.page ?? 0);
    const size = 40;
    const { data: rows, count, error } = await context.supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * size, page * size + size - 1);
    if (error) throw new Error(error.message);
    const { data: profiles } = await context.supabase.from("profiles").select("id, full_name, email");
    const names = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email || "—"]));
    return {
      total: count ?? 0,
      rows: (rows ?? []).map((r: any) => ({
        id: r.id,
        createdAt: r.created_at,
        actorName: String(names.get(r.actor_id) ?? "Sistema"),
        entity: r.entity,
        entityId: r.entity_id,
        action: r.action,
        detail: JSON.stringify(r.detail ?? {}),
      })),
    };
  });

/* ================================= ESTOQUE ================================ */

export interface InventoryRow {
  erpCode: string;
  name: string | null;
  quantity: number;
  capturedAt: string;
  inCatalog: boolean;
}

export const listInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number; term?: string; filter?: string }) => input ?? {})
  .handler(
    async ({ data, context }): Promise<{ rows: InventoryRow[]; total: number; capturedAt: string | null }> => {
      await assertAdmin(context);
      const page = Math.max(0, data.page ?? 0);
      const size = 40;
      const term = (data.term ?? "").trim();
      const filter = data.filter ?? "todos";

      let query = context.supabase
        .from("inventory_snapshots")
        .select("*", { count: "exact" })
        .order("product_erp_code");

      if (term) query = query.ilike("product_erp_code", `%${term}%`);
      if (filter === "com_estoque") query = query.gt("quantity", 0);
      if (filter === "sem_estoque") query = query.eq("quantity", 0);
      if (filter === "negativo") query = query.lt("quantity", 0);

      const { data: rows, count, error } = await query.range(page * size, page * size + size - 1);
      if (error) throw new Error(error.message);

      const codes = (rows ?? []).map((r: any) => r.product_erp_code);
      const { data: products } = await context.supabase
        .from("products")
        .select("erp_code, name, released, active")
        .in("erp_code", codes.length > 0 ? codes : ["__none__"]);
      const byCode = new Map((products ?? []).map((p: any) => [p.erp_code, p]));

      const { data: latest } = await context.supabase
        .from("inventory_snapshots")
        .select("captured_at")
        .order("captured_at", { ascending: false })
        .limit(1);

      return {
        total: count ?? 0,
        capturedAt: latest?.[0]?.captured_at ?? null,
        rows: (rows ?? []).map((r: any) => {
          const p = byCode.get(r.product_erp_code);
          return {
            erpCode: r.product_erp_code,
            name: p?.name ?? null,
            quantity: Number(r.quantity),
            capturedAt: r.captured_at,
            inCatalog: Boolean(p?.released && p?.active),
          };
        }),
      };
    },
  );

/* ============================ PREÇOS POR PRODUTO ========================== */

export interface ProductPriceRow {
  erpCode: string;
  name: string | null;
  priceTableCode: string;
  values: number[];
  mappedLevel: number | null;
  applicable: number | null;
}

export const listProductPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number; term?: string; table?: string }) => input ?? {})
  .handler(
    async ({
      data,
      context,
    }): Promise<{ rows: ProductPriceRow[]; total: number; tables: { code: string; name: string }[] }> => {
      await assertAdmin(context);
      const page = Math.max(0, data.page ?? 0);
      const size = 40;
      const term = (data.term ?? "").trim();

      const { data: tables } = await context.supabase
        .from("price_tables")
        .select("code, name, mapped_level")
        .order("code");
      const levelByTable = new Map((tables ?? []).map((t: any) => [t.code, t.mapped_level]));

      let query = context.supabase
        .from("product_prices")
        .select("*", { count: "exact" })
        .order("product_erp_code");
      if (data.table && data.table !== "todas") query = query.eq("price_table_code", data.table);
      if (term) query = query.ilike("product_erp_code", `%${term}%`);

      const { data: rows, count, error } = await query.range(page * size, page * size + size - 1);
      if (error) throw new Error(error.message);

      const codes = (rows ?? []).map((r: any) => r.product_erp_code);
      const { data: products } = await context.supabase
        .from("products")
        .select("erp_code, name")
        .in("erp_code", codes.length > 0 ? codes : ["__none__"]);
      const nameByCode = new Map((products ?? []).map((p: any) => [p.erp_code, p.name]));

      return {
        total: count ?? 0,
        tables: (tables ?? []).map((t: any) => ({ code: t.code, name: t.name })),
        rows: (rows ?? []).map((r: any) => {
          const values = [r.value_1, r.value_2, r.value_3, r.value_4, r.value_5, r.value_6].map(Number);
          const level = (levelByTable.get(r.price_table_code) ?? null) as number | null;
          return {
            erpCode: r.product_erp_code,
            name: (nameByCode.get(r.product_erp_code) as string | undefined) ?? null,
            priceTableCode: r.price_table_code,
            values,
            mappedLevel: level,
            applicable: level ? (values[level - 1] ?? null) : null,
          };
        }),
      };
    },
  );

/* ============================== BASES / CONTAGENS ========================= */

export interface BaseCount {
  key: string;
  label: string;
  count: number;
}

export const listBaseCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ counts: BaseCount[]; lastImport: string | null }> => {
    await assertAdmin(context);
    const targets: { key: string; label: string }[] = [
      { key: "customers", label: "Clientes" },
      { key: "products", label: "Produtos" },
      { key: "product_prices", label: "Preços por tabela" },
      { key: "inventory_snapshots", label: "Registros de estoque" },
      { key: "price_tables", label: "Tabelas de preço" },
      { key: "product_groups", label: "Grupos de produto" },
      { key: "segments", label: "Segmentos" },
      { key: "billing_methods", label: "Formas de cobrança" },
      { key: "payment_terms", label: "Condições de pagamento" },
      { key: "erp_sellers", label: "Representantes" },
      { key: "customer_financial_snapshots", label: "Resumos financeiros" },
      { key: "receivables", label: "Títulos e parcelas" },
      { key: "orders", label: "Pedidos" },
    ];

    const counts = await Promise.all(
      targets.map(async (t) => {
        const { count } = await context.supabase.from(t.key as never).select("id", { count: "exact", head: true });
        return { key: t.key, label: t.label, count: count ?? 0 };
      }),
    );

    const { data: run } = await context.supabase
      .from("erp_import_runs")
      .select("finished_at, started_at")
      .eq("status", "published")
      .order("finished_at", { ascending: false })
      .limit(1);

    return { counts, lastImport: run?.[0]?.finished_at ?? run?.[0]?.started_at ?? null };
  });

/* ==================== AUDITORIA DO IMPORTADOR DE SEGMENTOS ================ */

export interface SegmentAuditRow {
  id: string;
  runId: string | null;
  customerErpCode: string;
  previousSegmentCode: string | null;
  newSegmentCode: string | null;
  status: string;
  reason: string;
  createdAt: string;
}

export interface SegmentAuditRunOption {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  entries: number;
}

export interface SegmentAuditPayload {
  runs: SegmentAuditRunOption[];
  selectedRunId: string | null;
  totals: Record<string, number>;
  segmentNames: { code: string; name: string }[];
  rows: SegmentAuditRow[];
  totalRows: number;
  page: number;
  pageSize: number;
}

const SEGMENT_AUDIT_PAGE = 50;

export const listSegmentImportAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { runId?: string | null; status?: string | null; search?: string | null; page?: number } | undefined) => ({
      runId: input?.runId ?? null,
      status: input?.status ?? null,
      search: (input?.search ?? "").trim(),
      page: Math.max(1, Number(input?.page ?? 1)),
    }),
  )
  .handler(async ({ data, context }): Promise<SegmentAuditPayload> => {
    await assertAdmin(context);
    const { supabase } = context;

    const { data: runRows } = await supabase
      .from("erp_import_runs")
      .select("id, started_at, finished_at, status")
      .order("started_at", { ascending: false })
      .limit(20);

    const runs: SegmentAuditRunOption[] = [];
    for (const run of runRows ?? []) {
      const { count } = await supabase
        .from("segment_import_audit")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id);
      if ((count ?? 0) === 0) continue;
      runs.push({
        id: run.id,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        status: run.status,
        entries: count ?? 0,
      });
    }

    const selectedRunId = data.runId ?? runs[0]?.id ?? null;

    const applyScope = (query: any) => {
      let q = query;
      if (selectedRunId) q = q.eq("run_id", selectedRunId);
      return q;
    };

    const statuses = ["updated", "unchanged", "skipped", "failed"];
    const totals: Record<string, number> = {};
    await Promise.all(
      statuses.map(async (status) => {
        const { count } = await applyScope(
          supabase.from("segment_import_audit").select("id", { count: "exact", head: true }),
        ).eq("status", status);
        totals[status] = count ?? 0;
      }),
    );

    let listQuery = applyScope(
      supabase
        .from("segment_import_audit")
        .select("id, run_id, customer_erp_code, previous_segment_code, new_segment_code, status, reason, created_at", {
          count: "exact",
        }),
    );
    if (data.status) listQuery = listQuery.eq("status", data.status);
    if (data.search) listQuery = listQuery.ilike("customer_erp_code", `%${data.search.replace(/[%_]/g, "")}%`);

    const from = (data.page - 1) * SEGMENT_AUDIT_PAGE;
    const { data: rows, count, error } = await listQuery
      .order("created_at", { ascending: false })
      .range(from, from + SEGMENT_AUDIT_PAGE - 1);
    if (error) throw new Error(error.message);

    const { data: segments } = await supabase.from("segments").select("code, name").order("code");

    return {
      runs,
      selectedRunId,
      totals,
      segmentNames: (segments ?? []).map((s: any) => ({ code: s.code, name: s.name })),
      rows: (rows ?? []).map((r: any) => ({
        id: r.id,
        runId: r.run_id,
        customerErpCode: r.customer_erp_code,
        previousSegmentCode: r.previous_segment_code,
        newSegmentCode: r.new_segment_code,
        status: r.status,
        reason: r.reason,
        createdAt: r.created_at,
      })),
      totalRows: count ?? 0,
      page: data.page,
      pageSize: SEGMENT_AUDIT_PAGE,
    };
  });

export const listSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ code: string; name: string }[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("segments")
      .select("code, name")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({ code: s.code, name: s.name }));
  });

/* ============================ TAXONOMIA DE MARCAS ========================= */

export interface TaxonomyOverride {
  id: string;
  categoryName: string;
  targetBrandName: string;
  createdAt: string;
}

export const listTaxonomyOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaxonomyOverride[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("brand_taxonomy_overrides")
      .select("*")
      .order("category_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      categoryName: r.category_name,
      targetBrandName: r.target_brand_name,
      createdAt: r.created_at,
    }));
  });

export const updateTaxonomyOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id?: string; categoryName: string; targetBrandName: string }) => {
      if (!input.categoryName || !input.targetBrandName) throw new Error("Dados incompletos.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("brand_taxonomy_overrides").upsert(
      {
        id: data.id,
        category_name: data.categoryName.toUpperCase(),
        target_brand_name: data.targetBrandName.toUpperCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "category_name" },
    );
    if (error) throw new Error(error.message);
    await audit(context, "brand_taxonomy_overrides", data.categoryName, "upsert", data);
    return { ok: true };
  });

export const deleteTaxonomyOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("ID inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("brand_taxonomy_overrides")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "brand_taxonomy_overrides", data.id, "delete", {});
    return { ok: true };
  });
