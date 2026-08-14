import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  PackageSearch,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { Button } from "@/components/ui/button";
import { useDashboardMetrics } from "@/features/dashboard/use-dashboard-metrics";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel comercial · MR Força de Vendas" },
      {
        name: "description",
        content:
          "Acompanhe meta do mês, pedidos em análise, clientes em atenção e atividade recente da sua carteira.",
      },
      { property: "og:title", content: "Painel comercial · MR Força de Vendas" },
      {
        property: "og:description",
        content: "Meta, pedidos e clientes em atenção da sua carteira em uma única tela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { orders, customers, sellerName } = useSales();
  const { goal, goalProgress, totalSold, counts, attention } = useDashboardMetrics();

  const recentOrders = [...orders]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Painel comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sellerName ? `Olá, ${sellerName}. ` : ""}Resumo da sua operação no mês.
          </p>
        </div>
        <Button asChild>
          <Link to="/catalogo">
            <PackageSearch className="mr-2 h-4 w-4" /> Novo pedido
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total vendido"
          value={formatBRL(totalSold)}
          hint={goal > 0 ? `Meta ${formatBRL(goal)}` : "Meta não definida"}
          progress={goal > 0 ? Math.min(100, goalProgress) : undefined}
        />
        <MetricCard
          icon={<Target className="h-4 w-4" />}
          label="Pedidos em análise"
          value={String(counts.analise)}
          hint="Aguardando aprovação comercial"
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Pedidos aprovados"
          value={String(counts.aprovados)}
          hint={`${counts.correcao} em correção`}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Clientes na carteira"
          value={customers.length.toLocaleString("pt-BR")}
          hint={`${attention.length} em atenção`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="surface-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" /> Pedidos recentes
            </h2>
            <Link to="/pedidos" className="text-xs font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={ClipboardList}
              title="Nenhum pedido ainda"
              description="Comece um atendimento pelo catálogo para gerar seu primeiro pedido."
            />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to="/pedidos/$orderId"
                      params={{ orderId: order.id }}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {order.number}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{order.customerName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatBRL(order.total)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Clientes em atenção
          </h2>
          {attention.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum cliente com restrição ou crédito comprometido.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {attention.slice(0, 6).map((customer) => (
                <li key={customer.id} className="rounded-xl border border-border px-3 py-2">
                  <p className="truncate text-sm font-medium">
                    {customer.tradeName || customer.legalName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {customer.restricted
                      ? (customer.restrictionReason ?? "Cliente restrito")
                      : `Saldo em aberto ${formatBRL(customer.openBalance)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
