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
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSales } from "@/lib/state/sales-store";
import { formatDateTimeBR } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CustomerPickerProvider, useCustomerPicker } from "@/components/customer-picker";
import { useIsAdmin } from "@/components/admin/admin-page";
import { useIsApprover } from "@/components/use-is-approver";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";


const nav = [
  { to: "/", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/carteira", label: "Carteira", icon: Users, exact: false },
  
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
    <SidebarProvider defaultOpen={true}>
      <CustomerPickerProvider>
        <AppShellInner>{children}</AppShellInner>
      </CustomerPickerProvider>
    </SidebarProvider>
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
    <div className="flex min-h-svh w-full">
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="py-6 px-4">
          <Link to="/" className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-sm font-black text-primary-foreground shadow-sm">
              MR
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-semibold">Força de Vendas</span>
              <span className="block truncate text-xs text-muted-foreground">MR Cosméticos</span>
            </span>
          </Link>
          <div className="mt-6 group-data-[collapsible=icon]:px-0">
            <button
              type="button"
              onClick={() => openCustomerPicker({ startNewOrder: true })}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-all hover:opacity-95",
                "group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:p-0"
              )}
            >
              <Plus className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Novo pedido</span>
            </button>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3">
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.to, item.exact)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                  {item.to === "/carrinho" && itemCount > 0 && (
                    <span className={cn(
                      "ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground",
                      "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-[10px] group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center"
                    )}>
                      {itemCount}
                    </span>
                  )}
                </Link>
              </SidebarMenuItem>
            ))}
            {isApprover && (
              <SidebarMenuItem>
                <Link
                  to="/mapa-clientes"
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive("/mapa-clientes", false)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  )}
                >
                  <MapIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">Mapa</span>
                </Link>
              </SidebarMenuItem>
            )}

            {isApprover && (
              <SidebarMenuItem>
                <Link
                  to="/equipe"
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive("/equipe", false)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  )}
                >
                  <UsersRound className="h-4 w-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">Equipe</span>
                </Link>
              </SidebarMenuItem>
            )}

            {isAdmin && (
              <SidebarMenuItem>
                <Link
                  to="/admin"
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive("/admin", false)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  )}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">Administração</span>
                </Link>
              </SidebarMenuItem>
            )}
          </SidebarMenu>

          {isAdmin && pathname.startsWith("/admin") && (
            <div className="mt-6 border-t border-sidebar-border pt-4 group-data-[collapsible=icon]:hidden">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Menu Admin
              </p>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <Link
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
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          )}
        </SidebarContent>

        <SidebarFooter className="p-4 bg-sidebar-accent/20 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:bg-transparent">
          <div className="space-y-3">
            <div className="px-2 group-data-[collapsible=icon]:hidden">
              <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                <span className="text-foreground block font-semibold">{sellerName}</span>
                Atualizado: {erpLastUpdate ? formatDateTimeBR(erpLastUpdate) : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground",
                "group-data-[collapsible=icon]:justify-center"
              )}
            >
              <LogOut className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden font-medium">Sair</span>
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col relative">
        <header className="sticky top-0 z-30 h-16 border-b border-border/70 bg-background/85 backdrop-blur flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="hidden lg:flex" />
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-xs font-black text-primary-foreground shadow-sm">
                MR
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">Força de Vendas</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {customer ? customer.tradeName : "Nenhum cliente selecionado"}
                </span>
              </span>
            </div>
            {customer && (
              <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{customer.tradeName}</span>
                <span className="text-[10px] opacity-60">({customer.erpCode})</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openCustomerPicker({ startNewOrder: true })}
              className="lg:hidden grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-lift"
              aria-label="Novo pedido"
            >
              <Plus className="h-4 w-4" />
            </button>
            <Link
              to="/carrinho"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card shadow-sm hover:bg-muted/50 transition-colors"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart className="h-4 w-4" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground border-2 border-background">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8 overflow-y-auto">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around overflow-x-auto border-t border-border/70 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {nav.map((item) => {
            const isCarrinho = item.to === "/carrinho";
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors min-w-[64px]",
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
              to="/mapa-clientes"
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors min-w-[64px]",
                isActive("/mapa-clientes", false) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MapIcon className="h-5 w-5" />
              Mapa
            </Link>
          )}
          {isApprover && (
            <Link
              to="/equipe"
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors min-w-[64px]",
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
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors min-w-[64px]",
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
