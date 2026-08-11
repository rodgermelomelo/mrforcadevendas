import { createFileRoute, Link } from "@tanstack/react-router";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { integrationLabel, statusLabel, statusTone } from "@/lib/orders/status";
import { authorityLabel } from "@/lib/orders/validation";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId")({
  head: () => ({
    meta: [
      { title: "Detalhe do pedido — MR Força de Vendas" },
      {
        name: "description",
        content: "Snapshot do pedido: itens, exceções comerciais, aprovação e histórico.",
      },
      { property: "og:title", content: "Detalhe do pedido — MR Força de Vendas" },
      { property: "og:description", content: "Histórico e snapshot imutável do pedido." },
    ],
  }),
  component: DetalhePedido,
});

function DetalhePedido() {
  const { orderId } = Route.useParams();
  const { orders, hydrated } = useSales();
  const order = orders.find((o) => o.id === orderId);

  if (!hydrated) {
    return <div className="mx-auto h-64 w-full max-w-3xl animate-pulse rounded-xl bg-muted" />;
  }

  if (!order) {
    return (
      <div className="mx-auto w-full max-w-xl surface-card p-10 text-center">
        <h1 className="text-2xl font-bold">Pedido não encontrado</h1>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/pedidos">Voltar para meus pedidos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{order.number}</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {order.customerName} · {formatDateTimeBR(order.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium ${statusTone(order.status)}`}>
          {statusLabel[order.status]}
        </span>
      </header>

      <section className="surface-card grid gap-3 p-5 text-sm sm:grid-cols-2">
        <Info label="Vendedor" value={order.sellerName} />
        <Info label="Tabela / nível" value={`${order.priceTableCode} · ${order.priceLevelLabel}`} />
        <Info label="Condição" value={order.paymentTerm} />
        <Info label="Integração" value={integrationLabel[order.integrationStatus]} />
        <Info label="Bonificação" value={order.isBonus ? "Sim" : "Não"} />
        <Info label="Hash do conteúdo" value={order.contentHash} />
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-semibold">Itens</h2>
        <ul className="mt-3 divide-y divide-border">
          {order.items.map((i) => (
            <li key={i.productId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm">{i.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.erpCode} · {i.quantity} un. × {formatBRL(i.unitPrice)}
                  {i.discountPercent > 0 ? ` · -${i.discountPercent}%` : ""}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold">{formatBRL(i.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatBRL(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Descontos</dt>
            <dd className="text-destructive">-{formatBRL(order.discountTotal)}</dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd>{formatBRL(order.total)}</dd>
          </div>
        </dl>
      </section>

      {order.exceptions.length > 0 && (
        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">Exceções comerciais</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Autoridade responsável:{" "}
            {authorityLabel[order.requiredAuthority ?? "gerente_comercial"]}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {order.exceptions.map((e, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <p className="font-medium">{e.label}</p>
                <p className="text-xs text-muted-foreground">{e.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.notes && (
        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">Observações</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p>
        </section>
      )}

      <section className="surface-card p-5">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <ol className="mt-3 space-y-3">
          {order.history.map((h, i) => (
            <li key={i} className="border-l-2 border-primary/40 pl-3">
              <p className="text-sm font-medium">{h.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTimeBR(h.at)}
                {h.detail ? ` · ${h.detail}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
