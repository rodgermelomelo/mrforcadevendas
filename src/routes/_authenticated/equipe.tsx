import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SellerGoalsHistory } from "@/components/admin/seller-goals-history";
import { useIsApprover } from "@/components/use-is-approver";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { TeamSellerCard } from "@/features/team/team-seller-card";
import { TeamOrderList } from "@/features/team/team-order-list";
import { getTeamOverview } from "@/lib/team.functions";
import { formatBRL } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe comercial — MR Força de Vendas" },
      {
        name: "description",
        content:
          "Acompanhe metas, pedidos e progresso de cada representante da sua equipe por período.",
      },
      { property: "og:title", content: "Equipe comercial — MR Força de Vendas" },
      {
        property: "og:description",
        content: "Painel de gestão da equipe comercial da MR Cosméticos: metas, pedidos e progresso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function monthLabel(month: string) {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function TeamPage() {
  const { data: isApprover, isLoading: checkingRole } = useIsApprover();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [goalSeller, setGoalSeller] = useState<{ code: string; name: string } | null>(null);
  const fetchOverview = useServerFn(getTeamOverview);

  const overviewQuery = useQuery({
    queryKey: ["team-overview", month],
    enabled: isApprover === true,
    queryFn: () => fetchOverview({ data: { month } }) as Promise<TeamOverview>,
  });

  if (checkingRole) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!isApprover) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A página Equipe é exclusiva para supervisores, gerentes e gestores comerciais.
        </p>
      </div>
    );
  }

  const data = overviewQuery.data;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Equipe</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Acompanhe metas, pedidos e progresso dos representantes sob sua gestão.
            {data?.scope === "visible" && " A visibilidade segue as carteiras liberadas para o seu perfil."}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="period" className="text-xs">
            Período
          </Label>
          <Input
            id="period"
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="w-44 rounded-xl"
          />
        </div>
      </header>

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
          <p className="mt-2 text-sm text-destructive">
            {(overviewQuery.error as Error).message}
          </p>
        </div>
      ) : data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Total vendido"
              value={formatBRL(data.totals.sold)}
              hint={`${data.totals.orderCount.toLocaleString("pt-BR")} pedidos em ${monthLabel(data.month)}`}
            />
            <MetricCard
              icon={<Target className="h-4 w-4" />}
              label="Meta da equipe"
              value={formatBRL(data.totals.goal)}
              hint={data.totals.goal > 0 ? `${data.totals.progress}% atingido` : "Sem metas definidas"}
              progress={data.totals.goal > 0 ? Math.min(100, data.totals.progress) : undefined}
            />
            <MetricCard
              icon={<ClipboardList className="h-4 w-4" />}
              label="Em análise"
              value={String(data.totals.pendingCount)}
              hint={formatBRL(data.totals.pendingValue)}
            />
            <MetricCard
              icon={<Users className="h-4 w-4" />}
              label="Representantes"
              value={`${data.totals.activeSellers}/${data.totals.sellers}`}
              hint="Com pedidos no período"
            />
          </section>

          <Tabs defaultValue="representantes" className="space-y-4">
            <TabsList className="rounded-xl">
              <TabsTrigger value="representantes" className="rounded-lg">
                Representantes
              </TabsTrigger>
              <TabsTrigger value="aprovacoes" className="rounded-lg">
                Em análise ({data.pendingOrders.length})
              </TabsTrigger>
              <TabsTrigger value="pedidos" className="rounded-lg">
                Pedidos do período
              </TabsTrigger>
            </TabsList>

            <TabsContent value="representantes" className="space-y-3">
              {data.sellers.length === 0 ? (
                <EmptyState
                  title="Nenhum representante visível"
                  description="Seu perfil ainda não tem carteiras liberadas. Solicite a liberação de visibilidade ao administrador."
                />
              ) : (
                data.sellers.map((s) => (
                  <article key={s.erpCode} className="surface-card space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.erpCode} · {s.customerCount.toLocaleString("pt-BR")} clientes ativos
                          {s.users.length > 0 && ` · ${s.users.join(", ")}`}
                          {!s.active && " · inativo"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => setGoalSeller({ code: s.erpCode, name: s.name })}
                        >
                          <Target className="mr-1.5 h-4 w-4" />
                          {data.canManageGoals ? "Metas" : "Ver metas"}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-end justify-between gap-3 text-sm">
                        <span className="font-semibold tabular-nums">{formatBRL(s.sold)}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.goal > 0 ? `Meta ${formatBRL(s.goal)} · ${s.progress}%` : "Meta não definida"}
                        </span>
                      </div>
                      <Progress value={s.goal > 0 ? Math.min(100, s.progress) : 0} className="mt-2 h-2" />
                    </div>

                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="Pedidos" value={s.orderCount.toLocaleString("pt-BR")} />
                      <Stat
                        label="Em análise"
                        value={s.pendingCount.toLocaleString("pt-BR")}
                        tone={s.pendingCount > 0 ? "warning" : undefined}
                      />
                      <Stat label="Ticket médio" value={formatBRL(s.averageTicket)} />
                      <Stat
                        label="Último pedido"
                        value={s.lastOrderAt ? formatDateTimeBR(s.lastOrderAt) : "—"}
                      />
                    </dl>
                  </article>
                ))
              )}
            </TabsContent>

            <TabsContent value="aprovacoes">
              <OrderList
                orders={data.pendingOrders}
                emptyTitle="Nenhum pedido em análise"
                emptyDescription="Todos os pedidos da equipe estão resolvidos neste período."
              />
            </TabsContent>

            <TabsContent value="pedidos">
              <OrderList
                orders={data.recentOrders}
                emptyTitle="Nenhum pedido no período"
                emptyDescription="A equipe ainda não registrou pedidos no mês selecionado."
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <Dialog open={!!goalSeller} onOpenChange={(open) => !open && setGoalSeller(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Metas · {goalSeller?.name}</DialogTitle>
            <DialogDescription>
              Histórico de metas mensais do representante {goalSeller?.code}.
            </DialogDescription>
          </DialogHeader>
          {goalSeller && (
            <SellerGoalsHistory erpCode={goalSeller.code} canManage={data?.canManageGoals ?? false} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string | undefined;
  progress?: number | undefined;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {progress !== undefined && <Progress value={progress} className="mt-3 h-1.5" />}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-semibold tabular-nums", tone === "warning" && "text-warning")}>
        {value}
      </dd>
    </div>
  );
}

function OrderList({
  orders,
  emptyTitle,
  emptyDescription,
}: {
  orders: TeamOrderRow[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (orders.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            to="/pedidos/$orderId"
            params={{ orderId: o.id }}
            className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{o.customerName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {o.number} · {o.sellerName} · {formatDateTimeBR(o.createdAt)}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                statusTone(o.status as CommercialStatus),
              )}
            >
              {statusLabel[o.status as CommercialStatus] ?? o.status}
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatBRL(o.total)}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-12 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
