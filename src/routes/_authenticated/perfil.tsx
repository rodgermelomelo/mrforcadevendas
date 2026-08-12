import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { User, Shield, TrendingUp, Target, LogOut, Package, BadgePercent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SellerGoalsHistory } from "@/components/admin/seller-goals-history";
import { getGoalPermissions } from "@/lib/admin-data.functions";
import { getMyCommissionSummary } from "@/lib/commissions.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil · MR Força de Vendas" },
      { name: "description", content: "Gerencie suas informações e acompanhe suas metas comerciais." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { sellerName, role, orders, sellers } = useSales();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Encontra o seller vinculado ao usuário atual se houver
  const seller = sellers.find(s => s.name === sellerName);
  
  const fetchPerms = useServerFn(getGoalPermissions);
  const fetchCommissions = useServerFn(getMyCommissionSummary);
  const permsQuery = useQuery({
    queryKey: ["goal-permissions"],
    queryFn: () => fetchPerms(),
  });
  const commissionQuery = useQuery({
    queryKey: ["my-commissions", currentMonth],
    queryFn: () => fetchCommissions({ data: { month: currentMonth } }),
  });
  const canManageGoals = permsQuery.data?.canManage ?? false;

  const goal = seller?.monthlyGoal ?? 0;

  const totalSold = orders
    .filter((o) => o.status === "confirmed" || o.status === "auto_approved")
    .reduce((acc, o) => acc + o.total, 0);

  const progress = goal > 0 ? (totalSold / goal) * 100 : 0;

  const signOut = async () => {
    await queryClient.cancelQueries();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
    queryClient.clear();
  };

  const getRoleLabel = (r: string | null) => {
    switch (r) {
      case "vendedor_externo": return "Vendedor Externo";
      case "vendedor_interno": return "Vendedor Interno";
      case "supervisor": return "Supervisor";
      case "gerente_comercial": return "Gerente Comercial";
      case "administrador": return "Administrador";
      default: return "Colaborador";
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Meu <span className="text-brand-gradient">Perfil</span></h1>
        <p className="text-muted-foreground">Gerencie sua conta e acompanhe seu desempenho.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <aside className="space-y-6">
          <div className="surface-card p-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-10 w-10" />
            </div>
            <h2 className="mt-4 text-xl font-bold">{sellerName}</h2>
            <p className="text-sm text-muted-foreground">{getRoleLabel(role)}</p>
            
            <div className="mt-6 border-t pt-6">
              <Button variant="outline" className="w-full rounded-xl gap-2" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sair da conta
              </Button>
            </div>
          </div>

          <div className="surface-card p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Informações</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span>Perfil {getRoleLabel(role)}</span>
              </div>
              {seller && (
                <div className="flex items-center gap-3 text-sm">
                  <Package className="h-4 w-4 text-primary" />
                  <span>Cód. ERP: {seller.code}</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="surface-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">Meta do Mês</h3>
              </div>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full uppercase tracking-wider">
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {goal > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Vendido</p>
                    <p className="text-2xl font-bold">{formatBRL(totalSold)}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Meta</p>
                    <p className="text-2xl font-bold">{formatBRL(goal)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{progress.toFixed(1)}% atingido</span>
                    <span className="text-muted-foreground">{formatBRL(Math.max(0, goal - totalSold))} restante</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-brand-gradient transition-all duration-1000" 
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed rounded-xl">
                <p className="text-sm text-muted-foreground">
                  Nenhuma meta definida para este mês.<br/>
                  Consulte seu supervisor comercial.
                </p>
              </div>
            )}
          </section>

          <section className="surface-card p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BadgePercent className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">Comissões do Mês</h3>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </span>
            </div>

            {commissionQuery.isLoading ? (
              <div className="grid h-32 place-items-center rounded-xl bg-muted text-sm text-muted-foreground">
                Carregando comissões...
              </div>
            ) : commissionQuery.data?.sellerCodes.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sua conta ainda não tem representante vinculado para apurar comissão.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Comissão</p>
                    <p className="text-2xl font-bold">{formatBRL(commissionQuery.data?.totals.commission ?? 0)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Vendas comissionadas</p>
                    <p className="text-2xl font-bold">{formatBRL(commissionQuery.data?.totals.sold ?? 0)}</p>
                  </div>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <InfoStat label="Pedidos" value={(commissionQuery.data?.totals.orders ?? 0).toLocaleString("pt-BR")} />
                  <InfoStat label="Itens" value={(commissionQuery.data?.totals.items ?? 0).toLocaleString("pt-BR")} />
                  <InfoStat
                    label="Taxa média"
                    value={`${(commissionQuery.data?.totals.averageRate ?? 0).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}%`}
                  />
                </dl>
                {(commissionQuery.data?.totals.pendingCommission ?? 0) > 0 && (
                  <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {formatBRL(commissionQuery.data?.totals.pendingCommission ?? 0)} em pedidos aguardando aprovação.
                  </p>
                )}
                {(commissionQuery.data?.recentOrders ?? []).length > 0 && (
                  <ul className="divide-y divide-border border-t border-border text-sm">
                    {(commissionQuery.data?.recentOrders ?? []).slice(0, 4).map((order) => (
                      <li key={order.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
                        <Link to="/pedidos/$orderId" params={{ orderId: order.id }} className="min-w-0">
                          <span className="block truncate font-medium">{order.customerName}</span>
                          <span className="block text-xs text-muted-foreground">{order.number}</span>
                        </Link>
                        <span className="text-sm font-semibold">{formatBRL(order.commissionTotal)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="surface-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Histórico de Metas</h3>
            </div>

            {seller ? (
              <SellerGoalsHistory erpCode={seller.code} canManage={canManageGoals} />
            ) : (
              <div className="h-40 flex items-center justify-center border border-dashed rounded-xl">
                <p className="text-sm text-muted-foreground text-center px-4">
                  Sua conta ainda não está vinculada a um representante do ERP.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
