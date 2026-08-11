import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { listInventory } from "@/lib/admin-data.functions";
import { formatDateTimeBR } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "Estoque · MR Força de Vendas" },
      { name: "description", content: "Posição de estoque por produto recebida do ERP, com filtros por disponibilidade." },
      { property: "og:title", content: "Estoque · MR Força de Vendas" },
      { property: "og:description", content: "Quantidades por código, data da captura e situação no catálogo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 40;

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "com_estoque", label: "Com estoque" },
  { key: "sem_estoque", label: "Sem estoque" },
  { key: "negativo", label: "Negativo" },
] as const;

function InventoryPage() {
  const load = useServerFn(listInventory);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<string>("todos");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["admin", "inventory", term, filter, page],
    queryFn: () => load({ data: { page, term, filter } }),
  });

  return (
    <AdminPage
      title="Estoque"
      description="Posição enviada pelo ERP (registro tipo 27). Representa a quantidade disponível para venda de cada produto. O estoque é somente leitura: qualquer ajuste vem de uma nova importação."
      actions={
        query.data?.capturedAt ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            Capturado em {formatDateTimeBR(query.data.capturedAt)}
          </span>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por código do produto"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setFilter(f.key);
              setPage(0);
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (query.data?.rows ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum registro de estoque encontrado. O estoque é preenchido pela Central de Importações.
        </p>
      ) : (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((row) => (
            <div
              key={`${row.erpCode}-${row.capturedAt}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {row.erpCode} {row.name ? `· ${row.name}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.inCatalog ? "No catálogo comercial" : "Fora do catálogo (código histórico)"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                  row.quantity < 0
                    ? "bg-destructive/10 text-destructive"
                    : row.quantity === 0
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                }`}
              >
                {row.quantity.toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
          <Pager page={page} total={query.data?.total ?? 0} size={SIZE} onChange={setPage} />
        </div>
      )}
      {query.isFetching && !query.isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…
        </p>
      )}
    </AdminPage>
  );
}
