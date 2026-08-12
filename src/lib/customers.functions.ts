import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cadastro de cliente na Força de Vendas (Fase A do fluxo do pedido).
 * Vendedores podem cadastrar para a PRÓPRIA carteira; admin para qualquer.
 * A tabela de preço precisa existir e ter nível mapeado (senão o catálogo fica
 * indisponível para o cliente).
 */

export interface NewCustomerInput {
  tradeName: string;
  legalName: string;
  taxId: string;
  city: string;
  uf: string;
  sellerErpCode: string;
  priceTableCode: string;
  paymentTerm: string;
  segmentCode?: string | null;
}

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function normalize(input: unknown): NewCustomerInput {
  const i = input as Partial<NewCustomerInput>;
  return {
    tradeName: clean(i.tradeName),
    legalName: clean(i.legalName),
    taxId: clean(i.taxId).replace(/[^\dXx]/g, ""),
    city: clean(i.city),
    uf: clean(i.uf).toUpperCase().slice(0, 2),
    sellerErpCode: clean(i.sellerErpCode),
    priceTableCode: clean(i.priceTableCode),
    paymentTerm: clean(i.paymentTerm),
    segmentCode: i.segmentCode ? clean(i.segmentCode) : null,
  };
}

/** Códigos de representante que o usuário pode usar (própria carteira). */
async function visibleSellerCodes(context: { supabase: any; userId: string }): Promise<Set<string>> {
  const [links, team] = await Promise.all([
    context.supabase.from("user_erp_seller_links").select("seller_erp_code").eq("user_id", context.userId),
    context.supabase.from("team_visibility").select("seller_erp_code").eq("user_id", context.userId),
  ]);
  const set = new Set<string>();
  for (const r of links.data ?? []) set.add(r.seller_erp_code);
  for (const r of team.data ?? []) set.add(r.seller_erp_code);
  return set;
}

function genLocalCode(): string {
  const n = Math.floor(100000 + Math.random() * 899999);
  return `L${n}`;
}

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NewCustomerInput) => {
    const c = normalize(input);
    if (!c.tradeName && !c.legalName) throw new Error("Informe o nome fantasia ou a razão social.");
    if (!c.sellerErpCode) throw new Error("Selecione o representante (carteira).");
    if (!c.priceTableCode) throw new Error("Selecione a tabela de preço.");
    if (c.taxId && !(c.taxId.length === 14 || c.taxId.length === 11))
      throw new Error("CNPJ/CPF deve ter 14 ou 11 dígitos (ou deixe em branco).");
    if (c.uf && c.uf.length !== 2) throw new Error("UF inválida.");
    return c;
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Papel + carteira permitida
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "administrador" });
    if (isAdmin !== true) {
      const allowed = await visibleSellerCodes(context);
      if (!allowed.has(data.sellerErpCode)) {
        throw new Error("Você só pode cadastrar clientes da sua própria carteira.");
      }
    }

    // Representante precisa existir
    const { data: seller } = await supabase
      .from("erp_sellers")
      .select("erp_code")
      .eq("erp_code", data.sellerErpCode)
      .maybeSingle();
    if (!seller) throw new Error("Representante inexistente.");

    // Tabela precisa existir e ter nível mapeado
    const { data: table } = await supabase
      .from("price_tables")
      .select("code, mapped_level")
      .eq("code", data.priceTableCode)
      .maybeSingle();
    if (!table) throw new Error("Tabela de preço inválida.");
    if (table.mapped_level === null || table.mapped_level === undefined) {
      throw new Error("A tabela selecionada não tem nível de preço configurado. Configure o nível antes.");
    }

    // Insere com código local único (não colide com códigos do ERP). Bypass RLS
    // via service role, mas já validado acima.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = {
      legal_name: data.legalName || data.tradeName,
      trade_name: data.tradeName || data.legalName,
      tax_id: data.taxId,
      city: data.city,
      uf: data.uf,
      seller_erp_code: data.sellerErpCode,
      price_table_code: data.priceTableCode,
      payment_term: data.paymentTerm,
      segment_code: data.segmentCode,
      restricted: false,
      credit_limit: 0,
      open_balance: 0,
      min_order_value: 0,
      active: true,
    };

    let created: { id: string; erp_code: string } | null = null;
    let lastErr = "";
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      const erp_code = genLocalCode();
      const { data: row, error } = await supabaseAdmin
        .from("customers")
        .insert({ ...base, erp_code } as never)
        .select("id, erp_code")
        .single();
      if (!error && row) {
        created = row as { id: string; erp_code: string };
        break;
      }
      lastErr = error?.message ?? "";
      if (!lastErr.toLowerCase().includes("duplicate")) break; // erro que não é colisão de código
    }
    if (!created) throw new Error(lastErr || "Não foi possível cadastrar o cliente.");

    const { error: linkError } = await (supabaseAdmin as any)
      .from("customer_seller_links")
      .upsert(
        {
          customer_erp_code: created.erp_code,
          seller_erp_code: data.sellerErpCode,
          price_table_code: data.priceTableCode,
          payment_term: data.paymentTerm,
          segment_code: data.segmentCode,
          active: true,
          source: "manual",
        },
        { onConflict: "customer_erp_code,seller_erp_code" },
      );
    if (
      linkError &&
      !String(linkError.message ?? "")
        .toLowerCase()
        .includes("customer_seller_links")
    ) {
      throw new Error(linkError.message);
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      entity: "customers",
      entity_id: created.erp_code,
      action: "create",
      detail: { sellerErpCode: data.sellerErpCode, priceTableCode: data.priceTableCode },
    });

    return { ok: true, id: `${created.id}:${data.sellerErpCode}`, erpCode: created.erp_code };
  });
