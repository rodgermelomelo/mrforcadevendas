import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  PackageSearch,
  ShoppingCart,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Plus,
  LayoutGrid,
  User,
  UsersRound,
  BadgePercent,
  Target,
  Map as MapIcon,
  CalendarCheck2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin } from "@/lib/admin.functions";
import { useSales } from "@/lib/state/sales-store";
import { formatDateTimeBR } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CustomerPickerProvider, useCustomerPicker } from "@/components/customer-picker";
import { useIsAdmin } from "@/components/admin/admin-page";
import { useIsApprover } from "@/components/use-is-approver";

const nav = [
  { to: "/", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/carteira", label: "Carteira", icon: Users, exact: false },
  { to: "/mapa-clientes", label: "Mapa", icon: MapIcon, exact: false },
  { to: "/catalogo", label: "Catálogo", icon: PackageSearch, exact: false },
  { to: "/carrinho", label: "Carrinho", icon: ShoppingCart, exact: false },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList, exact: false },
  { to: "/visitas", label: "Visitas", icon: CalendarCheck2, exact: false },
  { to: "/metas", label: "Metas", icon: Target, exact: false },
  { to: "/perfil", label: "Perfil", icon: User, exact: false },
] as const;

const adminNav = [
  { to: "/admin", label: "Visão geral" },
  { to: "/admin/tabelas-preco", label: "Tabelas de preço" },
  { to: "/admin/representantes", label: "Representantes" },
  { to: "/admin/estoque", label: "Estoque e Produtos" },
  { to: "/admin/clientes", label: "Clientes" },
  { to: "/admin/usuarios", label: "Usuários, papéis e provisionamento" },
  { to: "/admin/cadastros", label: "Cadastros gerais" },
  { to: "/admin/regras", label: "Regras comerciais" },
  { to: "/admin/comissoes", label: "Comissões" },
  { to: "/admin/diagnostico", label: "Diagnóstico do catálogo" },
  { to: "/admin/importacoes", label: "Importações" },
  { to: "/admin/auditoria", label: "Auditoria" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CustomerPickerProvider>
      <AppShellInner>{children}</AppShellInner>
    </CustomerPickerProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const { openCustomerPicker } = useCustomerPicker();
  const { itemCount, customer, erpLastUpdate, sellerName } = useSales();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();
  const { data: isApprover } = useIsApprover();

  const signOut = async () => {
    await queryClient.cancelQueries();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
    queryClient.clear();
  };

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-sm font-black text-primary-foreground">
            MR
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Força de Vendas</span>
            <span className="block truncate text-xs text-muted-foreground">MR Cosméticos</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => openCustomerPicker({ startNewOrder: true })}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-opacity hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> Novo pedido
        </button>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(item.to, item.exact)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.to === "/carrinho" && itemCount > 0 && (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
          ))}
          {isApprover && (
            <Link
              to="/equipe"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive("/equipe", false)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <UsersRound className="h-4 w-4 shrink-0" />
              <span className="truncate">Equipe</span>
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive("/admin", false)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              <span className="truncate">Administração</span>
            </Link>
          )}
        </nav>
        {isAdmin && pathname.startsWith("/admin") && (
          <div className="mt-6 border-t border-sidebar-border pt-4">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Menu Admin
            </p>
            {adminNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.to, true)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                {item.to === "/admin/comissoes" ? (
                  <BadgePercent className="h-4 w-4 shrink-0" />
                ) : (
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-3 px-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {sellerName}
            <br />
            Dados atualizados em {erpLastUpdate ? formatDateTimeBR(erpLastUpdate) : "—"}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-xs font-black text-primary-foreground">
                MR
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">Força de Vendas</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {customer ? customer.tradeName : "Nenhum cliente selecionado"}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => openCustomerPicker({ startNewOrder: true })}
                className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground"
                aria-label="Novo pedido"
              >
                <Plus className="h-4 w-4" />
              </button>
              <Link
                to="/carrinho"
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card"
                aria-label="Abrir carrinho"
              >
                <ShoppingCart className="h-4 w-4" />
                {itemCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                    {itemCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around overflow-x-auto border-t border-border/70 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {nav.map((item) => {
            const isCarrinho = item.to === "/carrinho";
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {isCarrinho && itemCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {itemCount}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
          {isApprover && (
            <Link
              to="/equipe"
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive("/equipe", false) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <UsersRound className="h-5 w-5" />
              Equipe
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive("/admin", false) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-5 w-5" />
              Admin
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
