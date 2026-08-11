import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ShieldAlert, MapPin } from "lucide-react";
import { maskTaxId } from "@/lib/pricing";
import { useSales } from "@/lib/state/sales-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/carteira")({
  head: () => ({
    meta: [
      { title: "Minha carteira — MR Força de Vendas" },
      {
        name: "description",
        content:
          "Busque clientes da sua carteira por código, razão social, nome fantasia, CNPJ ou cidade e inicie um pedido.",
      },
      { property: "og:title", content: "Minha carteira — MR Força de Vendas" },
      { property: "og:description", content: "Clientes da sua carteira comercial MR Cosméticos." },
    ],
  }),
  component: Carteira,
});

function Carteira() {
  const [term, setTerm] = useState("");
  const { selectCustomer, customer, customers, priceTables, hydrated } = useSales();
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = term.trim().toLowerCase().replace(/[.\-/]/g, "");
    if (!q) return customers;
    return customers.filter((c) =>
      [c.erpCode, c.legalName, c.tradeName, c.taxId, c.city]
        .join(" ")
        .toLowerCase()
        .replace(/[.\-/]/g, "")
        .includes(q),
    );
  }, [term, customers]);

  const start = (id: string) => {
    selectCustomer(id);
    void navigate({ to: "/catalogo" });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Minha carteira</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Selecionar um cliente é o ponto de partida do pedido — os preços são calculados pela tabela
          dele.
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Código, razão social, nome fantasia, CNPJ ou cidade"
          className="h-12 rounded-xl bg-card pl-11 text-base"
        />
      </div>

      {results.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum cliente da sua carteira corresponde a “{term}”.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((c) => {
            const table = priceTables.find((t) => t.code === c.priceTableCode);
            const selected = customer?.id === c.id;
            return (
              <article
                key={c.id}
                className="surface-card flex flex-col p-5 transition-shadow hover:shadow-lift"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{c.tradeName}</h2>
                    <p className="truncate text-xs text-muted-foreground">{c.legalName}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {c.erpCode}
                  </span>
                </div>

                <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {c.city}/{c.uf}
                    </span>
                  </div>
                  <div className="truncate">CNPJ {maskTaxId(c.taxId)}</div>
                  <div className="truncate">
                    Segmento {c.segment} · Condição {c.paymentTerm}
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium">
                    {table ? `${table.code} · ${table.name}` : "Sem tabela"}
                  </span>
                  {table?.mappedLevel === null && (
                    <span className="rounded-lg border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning">
                      Preço pendente de configuração
                    </span>
                  )}
                  {c.restricted && (
                    <span className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                      <ShieldAlert className="h-3 w-3" /> Restrição
                    </span>
                  )}
                </div>

                <Button
                  onClick={() => start(c.id)}
                  className="mt-5 w-full rounded-xl"
                  variant={selected ? "outline" : "default"}
                >
                  {selected ? "Continuar atendimento" : "Atender este cliente"}
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
