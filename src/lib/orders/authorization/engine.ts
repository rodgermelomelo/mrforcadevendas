// =============================================================================
// Motor de autorização de pedidos (MR Força de Vendas)
// -----------------------------------------------------------------------------
// Porte FIEL da lógica do ERP interno (importar_v2.py: classifica() / aprovacao()).
// Dado um pedido (código do cliente, observação do vendedor, CFOP, total e data)
// e as fontes de desconto/acordo, devolve o status de cada fonte:
//   OK · VERIFICAR · DIVERGENCIA · SIM(bonificado)
// além da etapa de aprovação (Josi) derivada da observação.
//
// É PURO (sem I/O). As fontes vêm do Supabase (ver authorization/data.ts).
// A parte de crédito/limite (que no ERP consulta o Firebird direto) NÃO entra
// aqui — fica para uma fase posterior, com um caminho de dado próprio.
// =============================================================================

export type StatusFonte = "OK" | "VERIFICAR" | "DIVERGENCIA" | "SIM";

export type Modalidade =
  | "BONIFICADO"
  | "FUNCIONARIO"
  | "ACORDO"
  | "CAMPANHA"
  | "NFD"
  | "SELL OUT"
  | "SELOS"
  | "CONTA CORRENTE";

export interface ResultadoFonte {
  status: StatusFonte;
  /** Texto curto exibido (igual ao que a planilha mostra). */
  texto: string;
  /** Valor do desconto em R$, quando calculável; senão null. */
  valorDesconto: number | null;
}

/** Um crédito do cliente (NFD, Sell Out, Selos): número, valor e status. */
export interface RegistroCredito {
  num: string;
  valor: number | null;
  status: string; // ex.: "PENDENTE", "DESCONTADO"
}

export interface Campanha {
  nome: string;
  valor: number | null; // % da campanha
  cat: string;
  status: string; // "" ou "ATIVA"
  de: string | null; // ISO YYYY-MM-DD
  ate: string | null; // ISO YYYY-MM-DD
  kw: string[]; // palavras-chave normalizadas
}

/** Fontes de desconto/acordo já carregadas do Supabase. */
export interface DadosDescontos {
  /** cod -> forma do acordo (texto do cadastro, ex.: "5%"). */
  acordo: Record<string, string>;
  nfdPorCod: Record<string, RegistroCredito[]>;
  nfdPorNum: Record<string, Array<RegistroCredito & { cod: string }>>;
  sellOutPorCod: Record<string, RegistroCredito[]>;
  selosPorCod: Record<string, RegistroCredito[]>;
  ccSaldo: Record<string, number | null>;
  campanhas: Campanha[];
}

export interface PedidoInput {
  /** Observação do vendedor (texto livre). */
  obs: string;
  /** Código do cliente (mesmo do ERP). */
  cod: string;
  /** CFOP do pedido (5911/6911 = bonificação). */
  cfop: number | null;
  /** Valor total do pedido. */
  total: number;
  /** Data do pedido em ISO (YYYY-MM-DD), para vigência de campanha. */
  data?: string | null;
}

export interface ResultadoAutorizacao {
  fontes: Partial<Record<Modalidade, ResultadoFonte>>;
  bonif: boolean;
  /** Etapa de aprovação derivada da observação (vazio = sem trava). */
  aprovacao: string;
}

// ----------------------------- helpers ---------------------------------------

/** NFKD + remove acentos + MAIÚSCULO (igual norm() do Python). */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/** Remove linhas que são só "dd/mm/aaaa 123,45" (histórico) e junta o resto. */
export function limpaObs(o: unknown): string {
  const linhas = String(o ?? "").split("\n");
  const uteis = linhas.filter((l) => !/^\s*\d{2}\/\d{2}\/\d{4}\s+[\d.,]+\s*$/.test(l));
  return uteis.join(" ").trim();
}

/** Primeiro valor monetário "R$ 1.234,56" ou "12,34" -> número. */
function valRs(txt: string): number | null {
  const m = txt.match(/R?\$?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/);
  return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : null;
}

/** Primeiro "NN%" -> inteiro. */
function pctTxt(txt: string): number | null {
  const m = txt.match(/(\d{1,2})\s*%/);
  return m ? parseInt(m[1], 10) : null;
}

/** % mais próximo de uma palavra-chave (ex.: "5% MAKE + 3% ACETONA"). */
function pctNear(o: string, kws: string[]): number | null {
  const pcts: Array<[number, number]> = [];
  const re = /(\d{1,2})\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(o))) pcts.push([m.index, parseInt(m[1], 10)]);
  if (!pcts.length) return null;
  const kpos: number[] = [];
  for (const k of kws) {
    let i = o.indexOf(k);
    while (i >= 0) {
      kpos.push(i);
      i = o.indexOf(k, i + 1);
    }
  }
  if (!kpos.length) return pcts[0][1];
  let best = pcts[0];
  let bestD = Infinity;
  for (const pp of pcts) {
    const d = Math.min(...kpos.map((kp) => Math.abs(pp[0] - kp)));
    if (d < bestD) {
      bestD = d;
      best = pp;
    }
  }
  return best[1];
}

/** % do acordo: só quando há EXATAMENTE um percentual no texto do cadastro. */
function pctAcordo(forma: string | undefined): number | null {
  const a = [...String(forma ?? "").matchAll(/(\d+)\s*%/g)].map((x) => x[1]);
  return a.length === 1 ? parseInt(a[0], 10) : null;
}

/** Formata como o Python ":,.2f" (milhar com vírgula, decimal com ponto). */
function fmt(v: number): string {
  return Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const VOCAB: Record<"NFD" | "SELL OUT" | "SELOS" | "CONTA CORRENTE", RegExp[]> = {
  NFD: [/\bNFD\b/, /NOTA DE DEVOLU/, /N\.?F\.?D\b/, /TEM DEVOLU/, /\bDEVOLUCAO\b/],
  "SELL OUT": [/SELL\s*OUT/, /SELLOUT/],
  SELOS: [/\bSELOS?\b/],
  "CONTA CORRENTE": [/CONTA\s*CORRENTE/, /\bC\/?C\b/, /\bC\.C\b/],
};
const CAMPANHA_GERAL = [/CAMPANHA/, /PROMO/, /RELAMPAGO/, /\bFLASH\b/];
const BONIF = [/BONIFICAD/, /BONIFICAC/, /AMOSTRA/, /BRINDE/, /REMESSA DE AMOSTRA/];

// ----------------------------- aprovação -------------------------------------

/** Etapa de aprovação (Josi) derivada da observação normalizada. */
export function aprovacao(o: string): string {
  if (o.includes("AGUARDANDO")) return "AGUARDANDO";
  if (o.includes("MOSTRUARIO")) return "MOSTRUARIO SOLICITADO";
  if (o.includes("AUTORIZAC") && !o.includes("AUTORIZAD")) return "AGUARDANDO AUTORIZACAO";
  if (o.includes("APROVAC") && !o.includes("APROVAD")) return "AGUARDANDO APROVACAO";
  if (
    o.includes("PROVADOR") &&
    !["ENVIAD", "ENCAMINHAD", "JUNTO", "SEGUE", "ANEXAD", "EMBARCAD"].some((w) => o.includes(w))
  )
    return "PROVADOR PENDENTE";
  if (o.includes("AGUARDA") || o.includes("ACEITE")) return "AGUARDANDO ACEITE";
  return "";
}

// ----------------------------- classifica ------------------------------------

/**
 * Classifica um pedido contra as fontes de desconto/acordo.
 * Porte fiel de classifica() do importar_v2.py.
 */
export function classificarPedido(
  pedido: PedidoInput,
  dados: DadosDescontos,
): ResultadoAutorizacao {
  const { obs, cod, cfop, total, data } = pedido;
  const o = norm(limpaObs(obs));
  const r: Partial<Record<Modalidade, ResultadoFonte>> = {};

  const bonif = cfop === 5911 || cfop === 6911 || BONIF.some((p) => p.test(o));
  if (bonif) r["BONIFICADO"] = { status: "SIM", texto: "SIM", valorDesconto: null };

  // Desconto de funcionário (ad-hoc na observação) -> conferir
  if (o.includes("FUNCIONARIO")) {
    const pcs = [...new Set([...o.matchAll(/(\d{1,2})\s*%/g)].map((m) => m[1]))];
    const disp = pcs.length ? "func.: " + pcs.join("/") + "%" : "desc funcionário";
    r["FUNCIONARIO"] = { status: "VERIFICAR", texto: disp, valorDesconto: null };
  }

  // ACORDO: % do cadastro vs % citado na observação
  if (cod in dados.acordo) {
    const pc = pctAcordo(dados.acordo[cod]);
    const po = pctTxt(o);
    if (/ACORDO|\d+\s*%/.test(o)) {
      if (po && pc && po !== pc) {
        r["ACORDO"] = { status: "DIVERGENCIA", texto: `${pc}% (obs diz ${po}%)`, valorDesconto: null };
      } else if (pc) {
        r["ACORDO"] = { status: "OK", texto: `${pc}%`, valorDesconto: round2((total * pc) / 100) };
      } else {
        r["ACORDO"] = { status: "VERIFICAR", texto: dados.acordo[cod].slice(0, 18), valorDesconto: null };
      }
    }
  }

  // CAMPANHA: palavra-chave da campanha OU palavra genérica
  const vigentes = dados.campanhas.filter(
    (c) =>
      (!c.status || c.status === "ATIVA") &&
      (!(data && c.de && c.ate) || (c.de <= data! && data! <= c.ate!)),
  );
  const cand = vigentes.filter((c) => c.kw.some((k) => o.includes(k)));
  if (cand.length || CAMPANHA_GERAL.some((p) => p.test(o))) {
    const kwsCand = cand.flatMap((c) => c.kw);
    const po = kwsCand.length ? pctNear(o, kwsCand) : pctTxt(o);
    if (!cand.length) {
      r["CAMPANHA"] = { status: "VERIFICAR", texto: "campanha nao cadastrada", valorDesconto: null };
    } else {
      const nome0 = cand[0].nome.split(" - ")[0];
      if (po !== null && po !== undefined) {
        const bate = cand.filter((c) => typeof c.valor === "number" && Math.trunc(c.valor) === po);
        if (bate.length) {
          r["CAMPANHA"] = { status: "OK", texto: `${po}% ${nome0}`, valorDesconto: round2((total * po) / 100) };
        } else {
          const niveis = cand
            .filter((c) => typeof c.valor === "number")
            .map((c) => String(Math.trunc(c.valor as number)))
            .join("/");
          r["CAMPANHA"] = { status: "DIVERGENCIA", texto: `${po}% fora da escala (${niveis}%)`, valorDesconto: null };
        }
      } else {
        r["CAMPANHA"] = { status: "VERIFICAR", texto: `${nome0} - definir %`, valorDesconto: null };
      }
    }
  }

  // NFD / SELL OUT / SELOS / CONTA CORRENTE (disparam pelo vocabulário na obs)
  (Object.keys(VOCAB) as Array<keyof typeof VOCAB>).forEach((mod) => {
    if (!VOCAB[mod].some((p) => p.test(o))) return;

    if (mod === "NFD") {
      const m = o.match(/NFD[:\s\-]*?(\d{3,})/);
      const numObs = m ? m[1] : null;
      const recs = dados.nfdPorCod[cod] || [];
      const pend = recs.filter((x) => x.status.startsWith("PEND"));
      if (numObs) {
        const same = recs.filter((x) => x.num === numObs);
        const glob = dados.nfdPorNum[numObs] || [];
        if (same.length) {
          const x = same[0];
          if (x.status.startsWith("PEND"))
            r["NFD"] = { status: "OK", texto: `R$ ${fmt(Number(x.valor || 0))}`, valorDesconto: Number(x.valor || 0) };
          else r["NFD"] = { status: "VERIFICAR", texto: `NFD ${numObs} já descontada`, valorDesconto: null };
        } else if (glob.length) {
          r["NFD"] = { status: "VERIFICAR", texto: `NFD ${numObs} é de outro cliente (${glob[0].cod})`, valorDesconto: null };
        } else {
          r["NFD"] = { status: "VERIFICAR", texto: `NFD ${numObs} não encontrada`, valorDesconto: null };
        }
      } else if (pend.length === 1) {
        const x = pend[0];
        r["NFD"] = { status: "VERIFICAR", texto: `NFD ${x.num} pendente R$ ${fmt(Number(x.valor || 0))}? confirmar`, valorDesconto: null };
      } else if (pend.length) {
        r["NFD"] = { status: "VERIFICAR", texto: `${pend.length} NFDs pendentes — qual?`, valorDesconto: null };
      } else if (recs.length) {
        r["NFD"] = { status: "VERIFICAR", texto: "NFD não encontrada (nenhuma pendente p/ o cliente)", valorDesconto: null };
      } else {
        r["NFD"] = { status: "VERIFICAR", texto: "NFD não encontrada (cliente sem NFD cadastrada)", valorDesconto: null };
      }
    } else if (mod === "CONTA CORRENTE") {
      const saldo = dados.ccSaldo[cod];
      const disp = typeof saldo === "number" ? `saldo ${fmt(saldo)}` : "sem saldo cadastrado";
      r["CONTA CORRENTE"] = { status: "VERIFICAR", texto: disp, valorDesconto: null };
    } else {
      const recs = (mod === "SELL OUT" ? dados.sellOutPorCod : dados.selosPorCod)[cod] || [];
      const pend = recs.filter((x) => x.status.startsWith("PEND"));
      if (pend.length) {
        const vb = Number(pend[0].valor || 0);
        r[mod] = { status: "OK", texto: `R$ ${fmt(vb)}`, valorDesconto: vb };
      } else if (recs.length) {
        r[mod] = { status: "VERIFICAR", texto: "ja descontado", valorDesconto: null };
      } else {
        r[mod] = { status: "VERIFICAR", texto: "sem cadastro", valorDesconto: null };
      }
    }
  });

  return { fontes: r, bonif, aprovacao: aprovacao(o) };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
