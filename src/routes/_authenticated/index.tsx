import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle, TrendingUp, Wallet, PackageCheck } from "lucide-react";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { statusLabel } from "@/lib/orders/status";
import { Button } from "@/components/ui/button";
import { useCustomerPicker } from "@/components/customer-picker";
import { MetricCard } from "@/components/shared/metric-card";
import { useDashboardMetrics } from "@/features/dashboard/use-dashboard-metrics";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard do vendedor — MR Força de Vendas" },
      {
        name: "description",
        content:
          "Acompanhe metas, pedidos em análise, clientes que precisam de atenção e crie novos pedidos da sua carteira.",
      },
      { property: "og:title", content: "Dashboard do vendedor — MR Força de Vendas" },
      {
        property: "og:description",
        content: "Painel comercial da equipe MR Cosméticos: metas, pedidos e carteira.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { orders, hydrated, customer, customers, erpLastUpdate, sellerName, sellers } = useSales();
  const { openCustomerPicker, startWithCustomer } = useCustomerPicker();
  
  const seller = sellers.find(s => s.name === sellerName);
  const goal = seller?.monthlyGoal ?? 0;
  
  const recentCustomers = customers.filter(c => orders.some(o => o.customerId === c.erpCode)).slice(0, 3);

  const totalSold = orders
    .filter((o) => o.status === "confirmed" || o.status === "auto_approved")
    .reduce((acc, o) => acc + o.total, 0);
  const counts = {
    analise: orders.filter((o) => o.status === "pending_approval").length,
    aprovados: orders.filter((o) => o.status === "approved" || o.status === "auto_approved").length,
    correcao: orders.filter((o) => o.status === "changes_requested").length,
    erp: orders.filter((o) => o.integrationStatus === "awaiting_erp_integration").length,
  };
  const attention = customers.filter((c) => c.restricted || c.openBalance / c.creditLimit > 0.8);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Bem-vindo ao Modo Construção, {sellerName}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            Seu <span className="text-brand-gradient">painel comercial</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dados atualizados em {erpLastUpdate ? formatDateTimeBR(erpLastUpdate) : "—"}
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => openCustomerPicker({ startNewOrder: true })}
          className="shrink-0 rounded-xl bg-brand-gradient shadow-lift"
        >
          Novo pedido <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Meta do mês"
          value={hydrated ? (goal > 0 ? formatBRL(goal) : "Não definida") : "—"}
          hint={goal > 0 ? `${((totalSold / goal) * 100).toFixed(1)}% atingido` : "Contate seu supervisor"}
        />
        <MetricCard
          icon={<Wallet className="h-4 w-4" />}
          label="Total vendido"
          value={hydrated ? formatBRL(totalSold) : "—"}
          hint="Pedidos confirmados e auto-aprovados"
        />
        <MetricCard
          icon={<PackageCheck className="h-4 w-4" />}
          label="Pedidos em análise"
          value={hydrated ? String(counts.analise) : "—"}
          hint={`${counts.aprovados} aprovados · ${counts.correcao} em correção`}
        />
        <MetricCard
          icon={<ArrowRight className="h-4 w-4" />}
          label="Aguardando ERP"
          value={hydrated ? String(counts.erp) : "—"}
          hint="Somente pedidos confirmados são enviados"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface-card p-5">
          <h2 className="text-lg font-semibold">Últimos pedidos</h2>
          {!hydrated ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Você ainda não criou pedidos. Comece escolhendo um cliente da sua carteira.
              </p>
              <Button
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => openCustomerPicker({ startNewOrder: true })}
              >
                Escolher cliente e começar
              </Button>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link
                    to="/pedidos/$orderId"
                    params={{ orderId: o.id }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{o.customerName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.number} · {statusLabel[o.status]}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">{formatBRL(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" /> Clientes que precisam de atenção
          </h2>
          <ul className="mt-4 space-y-3">
            {attention.map((c) => (
              <li key={c.id} className="rounded-xl border border-border p-3">
                <p className="truncate text-sm font-medium">{c.tradeName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.restricted
                    ? (c.restrictionReason ?? "Cliente com restrição")
                    : "Saldo em aberto próximo do limite"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {customer ? (
        <div className="surface-card flex items-center justify-between border-primary/30 p-4">
          <p className="text-sm text-muted-foreground">
            Em atendimento: <strong className="text-foreground">{customer.tradeName}</strong>
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link to="/catalogo">Ir para o catálogo</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link to="/carrinho">Ver carrinho</Link>
            </Button>
          </div>
        </div>
      ) : recentCustomers.length > 0 && (
        <div className="surface-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Continuar atendimentos recentes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {recentCustomers.map(c => (
              <Button 
                key={c.id} 
                variant="outline" 
                className="h-auto flex-col items-start gap-1 rounded-2xl p-4 text-left"
                onClick={() => startWithCustomer(c.id)}
              >
                <span className="truncate text-sm font-bold">{c.tradeName}</span>
                <span className="text-xs text-muted-foreground">{c.erpCode} · {c.city}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
