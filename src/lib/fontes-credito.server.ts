// CRUD genérico das fontes de crédito por cliente: NFD, Sell Out, Selos e
// Conta Corrente. Cada fonte é uma tabela com forma parecida (cliente + valor).
// Escrita: admin ou gerente_comercial (via pode_gerir_descontos).

type Ctx = { supabase: any; userId: string };

export type FonteTipo = "nfd" | "sellout" | "selos" | "conta_corrente";

const TABELA: Record<FonteTipo, string> = {
  nfd: "nfd_creditos",
  sellout: "sellout_creditos",
  selos: "selos_creditos",
  conta_corrente: "conta_corrente_saldos",
};

export interface FonteRegistro {
  id: string;
  clienteCodigo: string;
  clienteNome: string;
  numero: string; // só NFD usa
  valor: number | null; // valor (crédito) ou saldo (conta corrente)
  status: string; // conta corrente não usa
  data: string | null; // só NFD usa
}

const text = (row: any, key: string, fallback = "") => {
  const v = row?.[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
};

async function assertPodeGerir(context: Ctx) {
  const { data } = await context.supabase.rpc("pode_gerir_descontos", { _user_id: context.userId });
  if (data !== true) throw new Error("Acesso restrito a administradores e gestores.");
}

export async function loadFonte(context: Ctx, tipo: FonteTipo): Promise<FonteRegistro[]> {
  const isCC = tipo === "conta_corrente";
  const res = await context.supabase
    .from(TABELA[tipo])
    .select("*")
    .order("cliente_nome")
    .range(0, 9999);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row: any): FonteRegistro => ({
    id: text(row, "id"),
    clienteCodigo: text(row, "cliente_codigo"),
    clienteNome: text(row, "cliente_nome"),
    numero: text(row, "numero"),
    valor: isCC
      ? (row?.saldo === null || row?.saldo === undefined ? null : Number(row.saldo))
      : (row?.valor === null || row?.valor === undefined ? null : Number(row.valor)),
    status: text(row, "status", isCC ? "" : "PENDENTE"),
    data: row?.data ?? null,
  }));
}

export async function persistFonte(
  context: Ctx,
  tipo: FonteTipo,
  input: {
    id?: string;
    clienteCodigo: string;
    clienteNome: string;
    numero: string;
    valor: number | null;
    status: string;
    data: string | null;
  },
): Promise<void> {
  await assertPodeGerir(context);
  const clienteCodigo = input.clienteCodigo.trim();
  if (!clienteCodigo) throw new Error("Informe o código do cliente.");
  const isCC = tipo === "conta_corrente";

  const payload: Record<string, unknown> = {
    cliente_codigo: clienteCodigo,
    cliente_nome: input.clienteNome.trim(),
  };
  if (isCC) {
    payload["saldo"] = input.valor ?? 0;
  } else {
    payload["valor"] = input.valor;
    payload["status"] = input.status || "PENDENTE";
    if (tipo === "nfd") {
      payload["numero"] = input.numero.trim();
      payload["data"] = input.data || null;
    }
  }

  const table = context.supabase.from(TABELA[tipo]);
  const res = input.id
    ? await table.update(payload).eq("id", input.id)
    : await table.insert({ ...payload, created_by: context.userId });
  if (res.error) throw new Error(res.error.message);
}

export async function removeFonte(context: Ctx, tipo: FonteTipo, id: string): Promise<void> {
  await assertPodeGerir(context);
  const res = await context.supabase.from(TABELA[tipo]).delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}
