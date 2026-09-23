// Camada de dados dos ACORDOS COMERCIAIS (fonte do motor de autorização).
// Leitura: qualquer autenticado. Escrita: admin ou gerente_comercial (a gestora).

export interface AcordoRecord {
  id: string;
  clienteCodigo: string;
  clienteNome: string;
  percentual: number | null;
  forma: string;
  vigenciaDe: string | null;
  vigenciaAte: string | null;
  status: string;
}

type Ctx = { supabase: any; userId: string };

const text = (row: any, key: string, fallback = "") => {
  const value = row?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

/** Só administrador ou gerente_comercial podem cadastrar/editar. */
export async function assertPodeGerir(context: Ctx) {
  const { data } = await context.supabase.rpc("pode_gerir_descontos", {
    _user_id: context.userId,
  });
  if (data !== true) throw new Error("Acesso restrito a administradores e gestores.");
}

export async function loadAcordos(context: Ctx): Promise<AcordoRecord[]> {
  const res = await context.supabase
    .from("acordos_comerciais")
    .select("*")
    .order("cliente_nome")
    .range(0, 4999);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map(
    (row: any): AcordoRecord => ({
      id: text(row, "id"),
      clienteCodigo: text(row, "cliente_codigo"),
      clienteNome: text(row, "cliente_nome"),
      percentual: row?.percentual === null || row?.percentual === undefined ? null : Number(row.percentual),
      forma: text(row, "forma"),
      vigenciaDe: row?.vigencia_de ?? null,
      vigenciaAte: row?.vigencia_ate ?? null,
      status: text(row, "status", "ATIVO"),
    }),
  );
}

export async function persistAcordo(
  context: Ctx,
  input: {
    id?: string;
    clienteCodigo: string;
    clienteNome: string;
    percentual: number | null;
    forma: string;
    vigenciaDe: string | null;
    vigenciaAte: string | null;
    status: string;
  },
): Promise<void> {
  await assertPodeGerir(context);
  const clienteCodigo = input.clienteCodigo.trim();
  if (!clienteCodigo) throw new Error("Informe o código do cliente.");

  const payload = {
    cliente_codigo: clienteCodigo,
    cliente_nome: input.clienteNome.trim(),
    percentual: input.percentual,
    forma: input.forma.trim(),
    vigencia_de: input.vigenciaDe || null,
    vigencia_ate: input.vigenciaAte || null,
    status: input.status || "ATIVO",
  };

  const res = input.id
    ? await context.supabase.from("acordos_comerciais").update(payload).eq("id", input.id)
    : await context.supabase.from("acordos_comerciais").insert({ ...payload, created_by: context.userId });
  if (res.error) throw new Error(res.error.message);
}

export async function removeAcordo(context: Ctx, id: string): Promise<void> {
  await assertPodeGerir(context);
  const res = await context.supabase.from("acordos_comerciais").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}
