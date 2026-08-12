import { createFileRoute, Link } from "@tanstack/react-router";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { integrationLabel, statusLabel, statusTone } from "@/lib/orders/status";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — MR Força de Vendas" },
      {
        name: "description",
        content: "Acompanhe seus pedidos por status comercial e status de integração com o ERP.",
      },
      { property: "og:title", content: "Meus pedidos — MR Força de Vendas" },
      { property: "og:description", content: "Histórico de pedidos da sua carteira." },
    ],
  }),
  component: Pedidos,
});

function Pedidos() {
  const { orders, hydrated } = useSales();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Meus pedidos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Status comercial e status de integração são independentes.
        </p>
      </header>

      {!hydrated ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não gerou pedidos.</p>
          <Button asChild className="mt-5 rounded-xl bg-brand-gradient">
            <Link to="/carteira">Criar primeiro pedido</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to="/pedidos/$orderId"
                params={{ orderId: o.id }}
                className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition-shadow hover:shadow-lift"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.number} · {formatDateTimeBR(o.createdAt)} · {o.items.length} itens
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${statusTone(o.status)}`}>
                      {statusLabel[o.status]}
                    </span>
                    <span className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {integrationLabel[o.integrationStatus]}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-right text-sm">
                  <span className="block font-bold">{formatBRL(o.total)}</span>
                  {(o.commissionTotal ?? 0) > 0 && (
                    <span className="block text-xs font-semibold text-primary">
                      Comissão {formatBRL(o.commissionTotal)}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
