import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { deleteAcordo, listAcordos, saveAcordo } from "@/lib/acordos.functions";
import { deleteFonte, listFonte, saveFonte, type FonteTipo } from "@/lib/fontes-credito.functions";
import {
  deleteCampanha,
  deleteRegra,
  listCampanhas,
  saveCampanha,
  saveRegra,
} from "@/lib/campanhas.functions";

export const Route = createFileRoute("/_authenticated/admin/descontos")({
  component: DescontosPage,
  head: () => ({
    meta: [
      { title: "Descontos & Acordos · MR Força de Vendas" },
      {
        name: "description",
        content:
          "Cadastro das fontes que o motor de autorização usa: acordos comerciais, campanhas, NFD, sell out, selos e conta corrente.",
      },
    ],
  }),
});

const inputCls = "rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const btnPrimary = "rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60";

type TabKey = "acordos" | "campanhas" | "nfd" | "sellout" | "selos" | "conta_corrente";
const TABS: { key: TabKey; label: string }[] = [
  { key: "acordos", label: "Acordos" },
  { key: "campanhas", label: "Campanhas" },
  { key: "nfd", label: "NFD" },
  { key: "sellout", label: "Sell Out" },
  { key: "selos", label: "Selos" },
  { key: "conta_corrente", label: "Conta Corrente" },
];

function DescontosPage() {
  const [tab, setTab] = useState<TabKey>("acordos");
  return (
    <AdminPage
      title="Descontos & Acordos"
      description="Fontes que o motor de autorização usa para conferir os descontos dos pedidos. Cadastro restrito a administradores e gestores."
    >
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "acordos" && <AcordosTab />}
      {tab === "campanhas" && <CampanhasTab />}
      {tab === "nfd" && <FonteTab tipo="nfd" titulo="NFD" temNumero />}
      {tab === "sellout" && <FonteTab tipo="sellout" titulo="Sell Out" />}
      {tab === "selos" && <FonteTab tipo="selos" titulo="Selos" />}
      {tab === "conta_corrente" && <FonteTab tipo="conta_corrente" titulo="Conta Corrente" isSaldo />}
    </AdminPage>
  );
}

// ------------------------------- Acordos -------------------------------------
function AcordosTab() {
  const qc = useQueryClient();
  const load = useServerFn(listAcordos);
  const upsert = useServerFn(saveAcordo);
  const drop = useServerFn(deleteAcordo);
  const [term, setTerm] = useState("");
  const [f, setF] = useState({ clienteCodigo: "", clienteNome: "", percentual: "", forma: "" });

  const q = useQuery({ queryKey: ["admin", "acordos"], queryFn: () => load() });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin", "acordos"] });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof upsert>[0]["data"]) => upsert({ data: input }),
    onSuccess: async () => { toast.success("Acordo salvo."); setF({ clienteCodigo: "", clienteNome: "", percentual: "", forma: "" }); await inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => drop({ data: { id } }),
    onSuccess: async () => { toast.success("Removido."); await inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = q.data ?? [];
    return t ? list.filter((a) => a.clienteCodigo.toLowerCase().includes(t) || a.clienteNome.toLowerCase().includes(t)) : list;
  }, [q.data, term]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); const p = f.percentual.replace(",", ".").trim();
          save.mutate({ clienteCodigo: f.clienteCodigo, clienteNome: f.clienteNome, percentual: p ? Number(p) : null, forma: f.forma || (p ? `${p}%` : ""), vigenciaDe: null, vigenciaAte: null, status: "ATIVO" }); }}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input className={inputCls} placeholder="Código cliente" value={f.clienteCodigo} onChange={(e) => setF({ ...f, clienteCodigo: e.target.value })} required />
        <input className={inputCls} placeholder="Nome" value={f.clienteNome} onChange={(e) => setF({ ...f, clienteNome: e.target.value })} />
        <input className={inputCls} placeholder="%" inputMode="decimal" value={f.percentual} onChange={(e) => setF({ ...f, percentual: e.target.value })} />
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1`} placeholder="Forma (5% + 3%)" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })} />
          <button type="submit" disabled={save.isPending} className={btnPrimary}><Plus className="h-4 w-4" /></button>
        </div>
      </form>
      <SearchBar value={term} onChange={setTerm} placeholder="Buscar cliente" />
      <SimpleTable loading={q.isLoading} empty={rows.length === 0}
        head={["Cliente", "%", "Forma", ""]}
        rows={rows.map((a) => [
          <ClienteCell key="c" nome={a.clienteNome} cod={a.clienteCodigo} />,
          a.percentual != null ? `${a.percentual}%` : "—",
          a.forma || "—",
          <DelBtn key="d" onClick={() => del.mutate(a.id)} />,
        ])}
      />
    </div>
  );
}

// ---------------------- Fontes de crédito (genérico) -------------------------
function FonteTab({ tipo, titulo, temNumero, isSaldo }: { tipo: FonteTipo; titulo: string; temNumero?: boolean; isSaldo?: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(listFonte);
  const upsert = useServerFn(saveFonte);
  const drop = useServerFn(deleteFonte);
  const [term, setTerm] = useState("");
  const [f, setF] = useState({ clienteCodigo: "", clienteNome: "", numero: "", valor: "" });

  const q = useQuery({ queryKey: ["admin", "fonte", tipo], queryFn: () => load({ data: { tipo } }) });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin", "fonte", tipo] });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof upsert>[0]["data"]) => upsert({ data: input }),
    onSuccess: async () => { toast.success(`${titulo} salvo.`); setF({ clienteCodigo: "", clienteNome: "", numero: "", valor: "" }); await inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => drop({ data: { tipo, id } }),
    onSuccess: async () => { toast.success("Removido."); await inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = q.data ?? [];
    return t ? list.filter((r) => r.clienteCodigo.toLowerCase().includes(t) || r.clienteNome.toLowerCase().includes(t)) : list;
  }, [q.data, term]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); const v = f.valor.replace(",", ".").trim();
          save.mutate({ tipo, clienteCodigo: f.clienteCodigo, clienteNome: f.clienteNome, numero: f.numero, valor: v ? Number(v) : null, status: "PENDENTE", data: null }); }}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input className={inputCls} placeholder="Código cliente" value={f.clienteCodigo} onChange={(e) => setF({ ...f, clienteCodigo: e.target.value })} required />
        <input className={inputCls} placeholder="Nome" value={f.clienteNome} onChange={(e) => setF({ ...f, clienteNome: e.target.value })} />
        {temNumero && <input className={inputCls} placeholder="Número" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />}
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1`} placeholder={isSaldo ? "Saldo (R$)" : "Valor (R$)"} inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
          <button type="submit" disabled={save.isPending} className={btnPrimary}><Plus className="h-4 w-4" /></button>
        </div>
      </form>
      <SearchBar value={term} onChange={setTerm} placeholder="Buscar cliente" />
      <SimpleTable loading={q.isLoading} empty={rows.length === 0}
        head={["Cliente", temNumero ? "Número" : "", isSaldo ? "Saldo" : "Valor", isSaldo ? "" : "Status", ""].filter((h, i) => !(i === 1 && !temNumero))}
        rows={rows.map((r) => [
          <ClienteCell key="c" nome={r.clienteNome} cod={r.clienteCodigo} />,
          ...(temNumero ? [r.numero || "—"] : []),
          r.valor != null ? `R$ ${r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—",
          ...(isSaldo ? [] : [r.status || "—"]),
          <DelBtn key="d" onClick={() => del.mutate(r.id)} />,
        ])}
      />
    </div>
  );
}

// ------------------------------ Campanhas ------------------------------------
function CampanhasTab() {
  const qc = useQueryClient();
  const load = useServerFn(listCampanhas);
  const upCampanha = useServerFn(saveCampanha);
  const delCampanha = useServerFn(deleteCampanha);
  const upRegra = useServerFn(saveRegra);
  const delRegra = useServerFn(deleteRegra);
  const [nome, setNome] = useState("");
  const [expand, setExpand] = useState<string | null>(null);
  const [regra, setRegra] = useState({ nome: "", percentual: "", categoria: "", kw: "" });

  const q = useQuery({ queryKey: ["admin", "campanhas"], queryFn: () => load() });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin", "campanhas"] });
  const on = { onSuccess: async () => { await inv(); }, onError: (e: Error) => toast.error(e.message) };

  const criaCampanha = useMutation({ mutationFn: (n: string) => upCampanha({ data: { nome: n, periodoDe: null, periodoAte: null, status: "ATIVA" } }), onSuccess: async () => { toast.success("Campanha criada."); setNome(""); await inv(); }, onError: (e: Error) => toast.error(e.message) });
  const removeCampanha = useMutation({ mutationFn: (id: string) => delCampanha({ data: { id } }), ...on });
  const criaRegra = useMutation({
    mutationFn: (input: Parameters<typeof upRegra>[0]["data"]) => upRegra({ data: input }),
    onSuccess: async () => { toast.success("Regra adicionada."); setRegra({ nome: "", percentual: "", categoria: "", kw: "" }); await inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeRegra = useMutation({ mutationFn: (id: string) => delRegra({ data: { id } }), ...on });

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (nome.trim()) criaCampanha.mutate(nome); }}
        className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4">
        <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder='Nova campanha (ex.: "Setembro 2026")' value={nome} onChange={(e) => setNome(e.target.value)} />
        <button type="submit" disabled={criaCampanha.isPending} className={btnPrimary}><Plus className="mr-1 inline h-4 w-4" /> Nova campanha</button>
      </form>

      {q.isLoading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma campanha cadastrada.</div>
      ) : (
        (q.data ?? []).map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between p-4">
              <button type="button" className="text-left" onClick={() => setExpand(expand === c.id ? null : c.id)}>
                <div className="font-semibold">{c.nome}</div>
                <div className="text-xs text-muted-foreground">{c.regras.length} regra(s) · {c.status}</div>
              </button>
              <DelBtn onClick={() => removeCampanha.mutate(c.id)} />
            </div>
            {expand === c.id && (
              <div className="space-y-3 border-t border-border/60 p-4">
                {c.regras.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 text-sm">
                    <span><b>{r.nome}</b> · {r.percentual != null ? `${r.percentual}%` : "—"} {r.palavrasChave.length ? `· gatilhos: ${r.palavrasChave.join(", ")}` : ""}</span>
                    <DelBtn onClick={() => removeRegra.mutate(r.id)} />
                  </div>
                ))}
                <form
                  onSubmit={(e) => { e.preventDefault(); const p = regra.percentual.replace(",", ".").trim();
                    criaRegra.mutate({ campanhaId: c.id, nome: regra.nome, percentual: p ? Number(p) : null, categoria: regra.categoria, palavrasChave: regra.kw.split(/[;,]/).map((x) => x.trim()).filter(Boolean), de: null, ate: null, status: "ATIVA" }); }}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
                >
                  <input className={inputCls} placeholder="Regra (ex.: MAKE 10%)" value={regra.nome} onChange={(e) => setRegra({ ...regra, nome: e.target.value })} required />
                  <input className={inputCls} placeholder="%" inputMode="decimal" value={regra.percentual} onChange={(e) => setRegra({ ...regra, percentual: e.target.value })} />
                  <input className={inputCls} placeholder="Categoria" value={regra.categoria} onChange={(e) => setRegra({ ...regra, categoria: e.target.value })} />
                  <input className={inputCls} placeholder="Palavras-chave (; )" value={regra.kw} onChange={(e) => setRegra({ ...regra, kw: e.target.value })} />
                  <button type="submit" disabled={criaRegra.isPending} className={btnPrimary}>Adicionar regra</button>
                </form>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ------------------------------- helpers UI ----------------------------------
function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary" />
    </div>
  );
}
function ClienteCell({ nome, cod }: { nome: string; cod: string }) {
  return (<div><div className="font-medium">{nome || "—"}</div><div className="text-xs text-muted-foreground">cód. {cod}</div></div>);
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
      <Trash2 className="h-3.5 w-3.5" /> Remover
    </button>
  );
}
function SimpleTable({ loading, empty, head, rows }: { loading: boolean; empty: boolean; head: React.ReactNode[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : empty ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Nada cadastrado ainda.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{head.map((h, i) => <th key={i} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60 hover:bg-muted/20">
                {r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
