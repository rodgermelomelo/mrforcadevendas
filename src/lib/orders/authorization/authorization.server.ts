// Liga o motor de classificação (engine.ts) aos dados reais do Supabase.
// Carrega as fontes (acordos, campanhas, NFD, sell out, selos, conta corrente)
// e avalia um pedido -> status por fonte + overall (para logística/aprovação).

import {
  classificarPedido,
  norm,
  type Campanha,
  type DadosDescontos,
  type RegistroCredito,
  type ResultadoAutorizacao,
} from "@/lib/orders/authorization/engine";

type Ctx = { supabase: any; userId: string };

const text = (row: any, key: string, fallback = "") => {
  const v = row?.[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
};

/** Carrega todas as fontes de desconto do Supabase no formato do motor. */
export async function loadDadosDescontos(context: Ctx): Promise<DadosDescontos> {
  const [acRes, campRes, regrasRes, nfdRes, soRes, selRes, ccRes] = await Promise.all([
    context.supabase.from("acordos_comerciais").select("cliente_codigo,percentual,forma,status").range(0, 9999),
    context.supabase.from("campanhas").select("*").range(0, 999),
    context.supabase.from("campanha_regras").select("*").range(0, 9999),
    context.supabase.from("nfd_creditos").select("cliente_codigo,numero,valor,status").range(0, 99999),
    context.supabase.from("sellout_creditos").select("cliente_codigo,valor,status").range(0, 9999),
    context.supabase.from("selos_creditos").select("cliente_codigo,valor,status").range(0, 9999),
    context.supabase.from("conta_corrente_saldos").select("cliente_codigo,saldo").range(0, 9999),
  ]);

  const acordo: Record<string, string> = {};
  for (const row of acRes.data ?? []) {
    if ((text(row, "status", "ATIVO")).toUpperCase() !== "ATIVO") continue;
    const cod = text(row, "cliente_codigo");
    const forma = text(row, "forma") || (row?.percentual != null ? `${row.percentual}%` : "");
    if (cod) acordo[cod] = forma;
  }

  // campanhas: cada REGRA vira uma entrada do motor (herda período/estado da campanha-mãe)
  const campById = new Map<string, any>();
  for (const c of campRes.data ?? []) campById.set(text(c, "id"), c);
  const campanhas: Campanha[] = [];
  for (const r of regrasRes.data ?? []) {
    const mae = campById.get(text(r, "campanha_id"));
    const maeAtiva = !mae || (text(mae, "status", "ATIVA").toUpperCase() === "ATIVA");
    const regraAtiva = text(r, "status", "ATIVA").toUpperCase() === "ATIVA";
    campanhas.push({
      nome: text(r, "nome"),
      valor: r?.percentual == null ? null : Number(r.percentual),
      cat: norm(text(r, "categoria")),
      status: maeAtiva && regraAtiva ? "ATIVA" : "",
      de: r?.de ?? mae?.periodo_de ?? null,
      ate: r?.ate ?? mae?.periodo_ate ?? null,
      kw: (Array.isArray(r?.palavras_chave) ? r.palavras_chave : []).map((k: string) => norm(k)).filter(Boolean),
    });
  }

  const nfdPorCod: Record<string, RegistroCredito[]> = {};
  const nfdPorNum: Record<string, Array<RegistroCredito & { cod: string }>> = {};
  for (const row of nfdRes.data ?? []) {
    const cod = text(row, "cliente_codigo");
    const rec: RegistroCredito = {
      num: text(row, "numero"),
      valor: row?.valor == null ? null : Number(row.valor),
      status: text(row, "status", "PENDENTE").toUpperCase(),
    };
    (nfdPorCod[cod] ??= []).push(rec);
    if (rec.num) (nfdPorNum[rec.num] ??= []).push({ ...rec, cod });
  }

  const porCod = (rows: any[]): Record<string, RegistroCredito[]> => {
    const out: Record<string, RegistroCredito[]> = {};
    for (const row of rows ?? []) {
      const cod = text(row, "cliente_codigo");
      (out[cod] ??= []).push({
        num: "",
        valor: row?.valor == null ? null : Number(row.valor),
        status: text(row, "status", "PENDENTE").toUpperCase(),
      });
    }
    return out;
  };

  const ccSaldo: Record<string, number | null> = {};
  for (const row of ccRes.data ?? []) {
    const cod = text(row, "cliente_codigo");
    if (cod) ccSaldo[cod] = row?.saldo == null ? null : Number(row.saldo);
  }

  return {
    acordo,
    campanhas,
    nfdPorCod,
    nfdPorNum,
    sellOutPorCod: porCod(soRes.data ?? []),
    selosPorCod: porCod(selRes.data ?? []),
    ccSaldo,
  };
}

export interface PedidoParaAvaliar {
  clienteCodigo: string;
  observacao: string;
  total: number;
  bonus: boolean;
  data: string | null; // ISO YYYY-MM-DD
}

/** Status geral do pedido para roteamento (logística x aprovação). */
export type SituacaoGeral = "OK" | "APROVACAO" | "SEM_PENDENCIA";

export interface AvaliacaoPedido extends ResultadoAutorizacao {
  situacao: SituacaoGeral;
  motivos: string[];
}

/** Roda o motor num pedido e decide se vai pra logística (OK) ou aprovação. */
export function avaliarComDados(dados: DadosDescontos, pedido: PedidoParaAvaliar): AvaliacaoPedido {
  const res = classificarPedido(
    {
      obs: pedido.observacao,
      cod: pedido.clienteCodigo,
      cfop: pedido.bonus ? 5911 : null,
      total: pedido.total,
      data: pedido.data,
    },
    dados,
  );

  const motivos: string[] = [];
  for (const [mod, r] of Object.entries(res.fontes)) {
    if (!r) continue;
    if (r.status === "DIVERGENCIA") motivos.push(`${mod}: divergência (${r.texto})`);
    else if (r.status === "VERIFICAR") motivos.push(`${mod}: verificar (${r.texto})`);
  }
  if (res.aprovacao) motivos.push(`Aprovação: ${res.aprovacao}`);

  const situacao: SituacaoGeral = motivos.length ? "APROVACAO" : "OK";
  return { ...res, situacao, motivos };
}

export async function avaliarPedido(context: Ctx, pedido: PedidoParaAvaliar): Promise<AvaliacaoPedido> {
  const dados = await loadDadosDescontos(context);
  return avaliarComDados(dados, pedido);
}

/** Avalia um pedido pelo id (carrega o pedido + as fontes). */
export async function avaliarPedidoPorId(context: Ctx, orderId: string): Promise<AvaliacaoPedido | null> {
  const res = await context.supabase
    .from("orders")
    .select("customer_erp_code,notes,total,is_bonus,created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  const o = res.data;
  if (!o) return null;
  return avaliarPedido(context, {
    clienteCodigo: String(o.customer_erp_code ?? ""),
    observacao: String(o.notes ?? ""),
    total: Number(o.total ?? 0),
    bonus: o.is_bonus === true,
    data: o.created_at ? String(o.created_at).slice(0, 10) : null,
  });
}
