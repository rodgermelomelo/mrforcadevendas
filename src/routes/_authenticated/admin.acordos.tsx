import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Handshake, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { deleteAcordo, listAcordos, saveAcordo } from "@/lib/acordos.functions";

export const Route = createFileRoute("/_authenticated/admin/acordos")({
  component: AcordosPage,
  head: () => ({
    meta: [
      { title: "Acordos Comerciais · MR Força de Vendas" },
      {
        name: "description",
        content:
          "Cadastro de acordos comerciais por cliente (percentual e vigência). O motor de autorização usa estes dados para conferir os descontos dos pedidos.",
      },
    ],
  }),
});

const inputCls =
  "rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function AcordosPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listAcordos);
  const upsert = useServerFn(saveAcordo);
  const drop = useServerFn(deleteAcordo);

  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    clienteCodigo: "",
    clienteNome: "",
    percentual: "",
    forma: "",
    vigenciaDe: "",
    vigenciaAte: "",
  });

  const acordosQuery = useQuery({
    queryKey: ["admin", "acordos"],
    queryFn: () => load(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "acordos"] });

  const saveMutation = useMutation({
    mutationFn: (input: Parameters<typeof upsert>[0]["data"]) => upsert({ data: input }),
    onSuccess: async () => {
      toast.success("Acordo salvo.");
      setCreating(false);
      setForm({ clienteCodigo: "", clienteNome: "", percentual: "", forma: "", vigenciaDe: "", vigenciaAte: "" });
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => drop({ data: { id } }),
    onSuccess: async () => {
      toast.success("Acordo removido.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const rows = acordosQuery.data ?? [];
    if (!t) return rows;
    return rows.filter(
      (a) => a.clienteCodigo.toLowerCase().includes(t) || a.clienteNome.toLowerCase().includes(t),
    );
  }, [acordosQuery.data, term]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const pctRaw = form.percentual.replace(",", ".").trim();
    saveMutation.mutate({
      clienteCodigo: form.clienteCodigo,
      clienteNome: form.clienteNome,
      percentual: pctRaw ? Number(pctRaw) : null,
      forma: form.forma || (pctRaw ? `${pctRaw}%` : ""),
      vigenciaDe: form.vigenciaDe || null,
      vigenciaAte: form.vigenciaAte || null,
      status: "ATIVO",
    });
  }

  return (
    <AdminPage
      title="Acordos Comerciais"
      description="Percentual de acordo por cliente. O motor de autorização compara este % com o citado na observação do pedido (OK · Divergência · Verificar)."
      actions={
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo acordo comercial
        </button>
      }
    >
      {creating && (
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <input className={inputCls} placeholder="Código do cliente" value={form.clienteCodigo}
            onChange={(e) => setForm({ ...form, clienteCodigo: e.target.value })} required />
          <input className={inputCls} placeholder="Nome do cliente" value={form.clienteNome}
            onChange={(e) => setForm({ ...form, clienteNome: e.target.value })} />
          <input className={inputCls} placeholder="Percentual (%)" inputMode="decimal" value={form.percentual}
            onChange={(e) => setForm({ ...form, percentual: e.target.value })} />
          <input className={`${inputCls} lg:col-span-3`} placeholder="Forma / observação (ex.: 5% + 3%)" value={form.forma}
            onChange={(e) => setForm({ ...form, forma: e.target.value })} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Vigência de
            <input className={inputCls} type="date" value={form.vigenciaDe}
              onChange={(e) => setForm({ ...form, vigenciaDe: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Vigência até
            <input className={inputCls} type="date" value={form.vigenciaAte}
              onChange={(e) => setForm({ ...form, vigenciaAte: e.target.value })} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={saveMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saveMutation.isPending ? "Salvando…" : "Salvar acordo"}
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por código ou nome do cliente"
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {acordosQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando acordos…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Handshake className="h-6 w-6" />
            Nenhum acordo cadastrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">%</th>
                <th className="px-4 py-3">Forma</th>
                <th className="px-4 py-3">Vigência</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-border/60 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.clienteNome || "—"}</div>
                    <div className="text-xs text-muted-foreground">cód. {a.clienteCodigo}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{a.percentual != null ? `${a.percentual}%` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.forma || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.vigenciaDe || a.vigenciaAte ? `${a.vigenciaDe ?? "…"} → ${a.vigenciaAte ?? "…"}` : "sem prazo"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => removeMutation.mutate(a.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminPage>
  );
}
