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
    queryFn: () => fetchOverview({ data: { month } }),
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
                  <TeamSellerCard
                    key={s.erpCode}
                    seller={s}
                    canManageGoals={data.canManageGoals}
                    onOpenGoals={setGoalSeller}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="aprovacoes">
              <TeamOrderList
                orders={data.pendingOrders}
                emptyTitle="Nenhum pedido em análise"
                emptyDescription="Todos os pedidos da equipe estão resolvidos neste período."
              />
            </TabsContent>

            <TabsContent value="pedidos">
              <TeamOrderList
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
