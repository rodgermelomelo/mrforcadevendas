import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { listPriceTables, setPriceTableLevel, type AdminPriceTable } from "@/lib/admin-data.functions";
import { formatBRL } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/tabelas-preco")({
  component: PriceTablesPage,
  head: () => ({
    meta: [
      { title: "Tabelas de preço · MR Força de Vendas" },
      { name: "description", content: "Mapeie qual dos seis valores do ERP é o preço aplicável em cada tabela de preço." },
      { property: "og:title", content: "Tabelas de preço · MR Força de Vendas" },
      { property: "og:description", content: "Configuração de nível de preço por tabela comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PriceTablesPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listPriceTables);
  const save = useServerFn(setPriceTableLevel);
  const query = useQuery({ queryKey: ["admin", "price-tables"], queryFn: () => load() });

  const mutation = useMutation({
    mutationFn: (input: { code: string; level: number | null }) => save({ data: input }),
    onSuccess: async () => {
      toast.success("Nível de preço atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unmapped = (query.data ?? []).filter((t) => t.mappedLevel === null).length;

  return (
    <AdminPage
      title="Tabelas de preço"
      description="Cada produto tem 6 valores por tabela. Escolha aqui qual valor é o preço aplicável — sem esse mapeamento nenhum preço é exibido e o pedido é bloqueado."
    >
      {unmapped > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {unmapped} tabela(s) sem nível mapeado. Os clientes dessas tabelas não conseguem montar pedidos.
          </p>
        </div>
      )}

      {query.isLoading && (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <div className="grid gap-4">
        {(query.data ?? []).map((table) => (
          <TableCard
            key={table.code}
            table={table}
            saving={mutation.isPending}
            onSave={(level) => mutation.mutate({ code: table.code, level })}
          />
        ))}
      </div>
    </AdminPage>
  );
}

function TableCard({
  table,
  saving,
  onSave,
}: {
  table: AdminPriceTable;
  saving: boolean;
  onSave: (level: number | null) => void;
}) {
  const [level, setLevel] = useState<number | null>(table.mappedLevel);
  const dirty = level !== table.mappedLevel;

  return (
    <section
      className={`rounded-2xl border bg-card p-5 shadow-sm ${
        table.mappedLevel === null ? "border-destructive/40" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {table.code} · {table.name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {table.customerCount.toLocaleString("pt-BR")} clientes ·{" "}
            {table.productCount.toLocaleString("pt-BR")} produtos com preço
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            table.mappedLevel === null
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          {table.mappedLevel === null ? "Sem nível" : `Valor ${table.mappedLevel + 1}`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLevel(option)}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
              level === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            Valor {option + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLevel(null)}
          className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
            level === null ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-muted"
          }`}
        >
          Nenhum
        </button>
      </div>

      {table.samples.length > 0 && (
        <div className="mt-4 space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Prévia com o nível selecionado
          </p>
          {table.samples.map((sample) => (
            <div key={sample.erpCode} className="flex items-center justify-between gap-3">
              <span className="truncate text-muted-foreground">
                {sample.erpCode} · {sample.name}
              </span>
              <span className="shrink-0 font-semibold">
                {level === null ? "—" : formatBRL(sample.values[level] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {dirty && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(level)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar nível
        </button>
      )}
    </section>
  );
}
