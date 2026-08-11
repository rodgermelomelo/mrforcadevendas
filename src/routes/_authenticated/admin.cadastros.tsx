import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { listRegistries, updateRegistry, type CodeLabelRow } from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_authenticated/admin/cadastros")({
  component: RegistriesPage,
  head: () => ({
    meta: [
      { title: "Cadastros gerais · MR Força de Vendas" },
      { name: "description", content: "Grupos de produto, segmentos, formas de cobrança e condições de pagamento." },
      { property: "og:title", content: "Cadastros gerais · MR Força de Vendas" },
      { property: "og:description", content: "Renomeie cadastros auxiliares e marque a condição padrão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Kind = "groups" | "segments" | "billingMethods" | "paymentTerms" | "brands";

const TABS: { key: Kind; label: string }[] = [
  { key: "groups", label: "Grupos de produto" },
  { key: "segments", label: "Segmentos" },
  { key: "billingMethods", label: "Formas de cobrança" },
  { key: "paymentTerms", label: "Condições de pagamento" },
  { key: "brands", label: "Marcas" },
];

function RegistriesPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listRegistries);
  const save = useServerFn(updateRegistry);
  const [tab, setTab] = useState<Kind>("groups");
  const [term, setTerm] = useState("");

  const query = useQuery({ queryKey: ["admin", "registries"], queryFn: () => load() });

  const mutation = useMutation({
    mutationFn: (input: { kind: Kind; code: string; label: string; isStandard?: boolean; active?: boolean }) => save({ data: input }),
    onSuccess: async () => {
      toast.success("Cadastro atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "registries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows: CodeLabelRow[] = query.data?.[tab] ?? [];
  const filtered = rows
    .filter((r) => `${r.code} ${r.label}`.toLowerCase().includes(term.trim().toLowerCase()))
    .slice(0, 100);

  return (
    <AdminPage
      title="Cadastros gerais"
      description="Cadastros auxiliares recebidos do ERP. É possível ajustar a descrição de exibição e definir a condição de pagamento padrão."
    >
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
            }`}
          >
            {t.label} {query.data ? `(${query.data[t.key].length})` : ""}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar cadastro"
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <RegistryRow
              key={`${tab}-${row.code}`}
              kind={tab}
              row={row}
              saving={mutation.isPending}
              onSave={(label, isStandard, active) =>
                mutation.mutate({
                  kind: tab,
                  code: row.code,
                  label,
                    isStandard: isStandard ?? false,
                    active: active ?? true,
                })
              }
            />
          ))}
          {filtered.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum cadastro encontrado.
            </p>
          )}
        </div>
      )}
    </AdminPage>
  );
}

function RegistryRow({
  kind,
  row,
  saving,
  onSave,
}: {
  kind: Kind;
  row: CodeLabelRow;
  saving: boolean;
  onSave: (label: string, isStandard?: boolean, active?: boolean) => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [isStandard, setIsStandard] = useState(Boolean(row.extra));
  const [active, setActive] = useState(row.active ?? true);
  const dirty = label !== row.label || isStandard !== Boolean(row.extra) || active !== (row.active ?? true);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <span className="w-20 shrink-0 text-xs font-semibold text-muted-foreground">
        {kind === "brands" ? "MARCA" : row.code}
      </span>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {kind === "paymentTerms" && (
        <label className="flex shrink-0 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isStandard}
            onChange={(e) => setIsStandard(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Padrão
        </label>
      )}
      {kind === "brands" && (
        <label className="flex shrink-0 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Ativa
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => onSave(label, kind === "paymentTerms" ? isStandard : undefined, kind === "brands" ? active : undefined)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
        </button>
      </div>
    </div>
  );
}
