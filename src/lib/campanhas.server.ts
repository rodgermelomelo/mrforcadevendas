// Campanhas (mãe) + regras. Ex.: campanha "Setembro 2026" com regras
// "MAKE 10%", "ACETONA 3%" (cada uma com palavras-chave que disparam na obs).
// Escrita: admin ou gerente_comercial.

type Ctx = { supabase: any; userId: string };

export interface CampanhaRegra {
  id: string;
  nome: string;
  percentual: number | null;
  categoria: string;
  palavrasChave: string[];
  de: string | null;
  ate: string | null;
  status: string;
}
export interface CampanhaRecord {
  id: string;
  nome: string;
  periodoDe: string | null;
  periodoAte: string | null;
  status: string;
  regras: CampanhaRegra[];
}

const text = (row: any, key: string, fallback = "") => {
  const v = row?.[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
};

async function assertPodeGerir(context: Ctx) {
  const { data } = await context.supabase.rpc("pode_gerir_descontos", { _user_id: context.userId });
  if (data !== true) throw new Error("Acesso restrito a administradores e gestores.");
}

export async function loadCampanhas(context: Ctx): Promise<CampanhaRecord[]> {
  const [campRes, regrasRes] = await Promise.all([
    context.supabase.from("campanhas").select("*").order("nome").range(0, 999),
    context.supabase.from("campanha_regras").select("*").order("nome").range(0, 9999),
  ]);
  if (campRes.error) throw new Error(campRes.error.message);
  if (regrasRes.error) throw new Error(regrasRes.error.message);

  const porCampanha = new Map<string, CampanhaRegra[]>();
  for (const row of regrasRes.data ?? []) {
    const cid = text(row, "campanha_id");
    const list = porCampanha.get(cid) ?? [];
    list.push({
      id: text(row, "id"),
      nome: text(row, "nome"),
      percentual: row?.percentual == null ? null : Number(row.percentual),
      categoria: text(row, "categoria"),
      palavrasChave: Array.isArray(row?.palavras_chave) ? row.palavras_chave : [],
      de: row?.de ?? null,
      ate: row?.ate ?? null,
      status: text(row, "status", "ATIVA"),
    });
    porCampanha.set(cid, list);
  }

  return (campRes.data ?? []).map((row: any): CampanhaRecord => {
    const id = text(row, "id");
    return {
      id,
      nome: text(row, "nome"),
      periodoDe: row?.periodo_de ?? null,
      periodoAte: row?.periodo_ate ?? null,
      status: text(row, "status", "ATIVA"),
      regras: porCampanha.get(id) ?? [],
    };
  });
}

export async function persistCampanha(
  context: Ctx,
  input: { id?: string; nome: string; periodoDe: string | null; periodoAte: string | null; status: string },
): Promise<void> {
  await assertPodeGerir(context);
  if (!input.nome.trim()) throw new Error("Informe o nome da campanha.");
  const payload = {
    nome: input.nome.trim(),
    periodo_de: input.periodoDe || null,
    periodo_ate: input.periodoAte || null,
    status: input.status || "ATIVA",
  };
  const res = input.id
    ? await context.supabase.from("campanhas").update(payload).eq("id", input.id)
    : await context.supabase.from("campanhas").insert({ ...payload, created_by: context.userId });
  if (res.error) throw new Error(res.error.message);
}

export async function removeCampanha(context: Ctx, id: string): Promise<void> {
  await assertPodeGerir(context);
  const res = await context.supabase.from("campanhas").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

export async function persistRegra(
  context: Ctx,
  input: {
    id?: string;
    campanhaId: string;
    nome: string;
    percentual: number | null;
    categoria: string;
    palavrasChave: string[];
    de: string | null;
    ate: string | null;
    status: string;
  },
): Promise<void> {
  await assertPodeGerir(context);
  if (!input.campanhaId) throw new Error("Campanha inválida.");
  if (!input.nome.trim()) throw new Error("Informe o nome da regra.");
  const payload = {
    campanha_id: input.campanhaId,
    nome: input.nome.trim(),
    percentual: input.percentual,
    categoria: input.categoria.trim(),
    palavras_chave: input.palavrasChave.map((k) => k.trim().toUpperCase()).filter(Boolean),
    de: input.de || null,
    ate: input.ate || null,
    status: input.status || "ATIVA",
  };
  const res = input.id
    ? await context.supabase.from("campanha_regras").update(payload).eq("id", input.id)
    : await context.supabase.from("campanha_regras").insert(payload);
  if (res.error) throw new Error(res.error.message);
}

export async function removeRegra(context: Ctx, id: string): Promise<void> {
  await assertPodeGerir(context);
  const res = await context.supabase.from("campanha_regras").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}
