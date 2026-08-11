import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Search } from "lucide-react";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { listProductPrices } from "@/lib/admin-data.functions";
import { formatBRL } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/precos")({
  component: PricesPage,
  head: () => ({
    meta: [
      { title: "Preços por produto · MR Força de Vendas" },
      { name: "description", content: "Os 6 valores de cada produto por tabela e qual deles é o preço aplicável." },
      { property: "og:title", content: "Preços por produto · MR Força de Vendas" },
      { property: "og:description", content: "Confira produto a produto o preço que o vendedor enxerga." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 40;

function PricesPage() {
  const load = useServerFn(listProductPrices);
  const [term, setTerm] = useState("");
  const [table, setTable] = useState("todas");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["admin", "prices", term, table, page],
    queryFn: () => load({ data: { page, term, table } }),
  });

  return (
    <AdminPage
      title="Preços por produto"
      description="Cada produto tem 6 valores por tabela. O valor aplicável é definido pelo nível mapeado em Tabelas de preço."
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
        <select
          value={table}
          onChange={(e) => {
            setTable(e.target.value);
            setPage(0);
          }}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          <option value="todas">Todas as tabelas</option>
          {(query.data?.tables ?? []).map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} · {t.name}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (query.data?.rows ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum preço encontrado. Os preços chegam pela Central de Importações (registro tipo 28).
        </p>
      ) : (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((row) => (
            <div
              key={`${row.erpCode}-${row.priceTableCode}`}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate font-semibold">
                  {row.erpCode} {row.name ? `· ${row.name}` : ""}
                </p>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  Tabela {row.priceTableCode}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                {row.values.map((value, index) => {
                  const isApplicable = row.mappedLevel === index + 1;
                  return (
                    <div
                      key={index}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        isApplicable ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border"
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor {index + 1}</p>
                      {formatBRL(value)}
                    </div>
                  );
                })}
              </div>
              {row.mappedLevel === null && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Tabela sem nível mapeado — nenhum preço é exibido ao vendedor.{" "}
                  <Link to="/admin/tabelas-preco" className="underline">
                    Configurar
                  </Link>
                </p>
              )}
            </div>
          ))}
          <Pager page={page} total={query.data?.total ?? 0} size={SIZE} onChange={setPage} />
        </div>
      )}
    </AdminPage>
  );
}
