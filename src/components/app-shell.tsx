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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";


const nav = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard, exact: false },
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
  { to: "/admin/transportadoras", label: "Transportadoras" },
  { to: "/admin/regras", label: "Regras comerciais" },
  { to: "/admin/descontos", label: "Descontos & Acordos" },
  { to: "/admin/comissoes", label: "Comissões" },
  { to: "/admin/diagnostico", label: "Diagnóstico do catálogo" },
  { to: "/admin/importacoes", label: "Importações" },
  { to: "/admin/auditoria-segmentos", label: "Auditoria de segmentos" },
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
          <div className="mt-4 hidden lg:flex px-2 group-data-[collapsible=icon]:px-0">
            <SidebarTrigger className="bg-background/80 backdrop-blur shadow-sm border border-border/50 hover:bg-background h-10 w-full group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:p-0 flex justify-center items-center [&>svg]:h-5 [&>svg]:w-5" />
          </div>
          <div className="mt-4 px-2 group-data-[collapsible=icon]:px-0">
            <button
              type="button"
              onClick={() => openCustomerPicker({ startNewOrder: true })}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-all hover:opacity-95",
                "group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:p-0"
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Novo pedido</span>
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
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.to, item.exact)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                  {item.to === "/carrinho" && itemCount > 0 && (
                    <span
                      aria-label={`${itemCount} itens no carrinho`}
                      className={cn(
                        "ml-auto min-w-5 rounded-full bg-primary px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-primary-foreground",
                        "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-right-0.5 group-data-[collapsible=icon]:-top-0.5 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:grid group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:place-items-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-[10px] group-data-[collapsible=icon]:border-2 group-data-[collapsible=icon]:border-sidebar"
                      )}
                    >
                      {itemCount > 99 ? "99+" : itemCount}
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
            <div className="mt-4 border-t border-sidebar-border pt-3 group-data-[collapsible=icon]:hidden">
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

        <SidebarFooter className="p-2 bg-sidebar-accent/20 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:bg-transparent">
          <div className="space-y-2">
            <div className="px-2 group-data-[collapsible=icon]:hidden">
              <p className="text-[10px] leading-tight text-muted-foreground font-medium">
                <span className="text-foreground block font-semibold truncate">{sellerName}</span>
                <span className="block truncate opacity-80">
                  {erpLastUpdate ? formatDateTimeBR(erpLastUpdate) : "—"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground",
                "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden font-medium truncate">Sair</span>
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col relative">
        {/* Barra superior mobile: altura real, sem sobrepor o conteúdo */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
            <Link to="/" className="flex min-w-0 flex-1 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-[10px] font-black text-primary-foreground shadow-sm">
                MR
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">Força de Vendas</span>
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                  MR Cosméticos
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => openCustomerPicker({ startNewOrder: true })}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-lift"
              aria-label="Novo pedido"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
            <Link
              to="/carrinho"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart className="h-4.5 w-4.5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
          </div>

          {customer && (
            <div className="flex items-center gap-2 border-t border-border/50 bg-muted/40 px-4 py-1.5 text-[11px]">
              <Users className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate font-medium text-foreground">{customer.tradeName}</span>
              <span className="shrink-0 text-muted-foreground">({customer.erpCode})</span>
            </div>
          )}
        </header>

        {/* Cliente ativo no desktop */}
        {customer && (
          <div className="sticky top-0 z-30 hidden items-center justify-end gap-2 border-b border-border/50 bg-background/85 px-6 py-2 text-xs backdrop-blur-md lg:flex">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-foreground">{customer.tradeName}</span>
            <span className="text-muted-foreground">({customer.erpCode})</span>
          </div>
        )}

        <main className="flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-10 lg:pb-12 lg:pt-6">
          {children}
        </main>

        <MobileTabBar
          isActive={isActive}
          isAdmin={Boolean(isAdmin)}
          isApprover={Boolean(isApprover)}
        />
      </div>
    </div>
  );
}

const primaryTabs = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard, exact: false },
  { to: "/carteira", label: "Carteira", icon: Users, exact: false },
  { to: "/catalogo", label: "Catálogo", icon: PackageSearch, exact: false },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList, exact: false },
] as const;

function MobileTabBar({
  isActive,
  isAdmin,
  isApprover,
}: {
  isActive: (to: string, exact: boolean) => boolean;
  isAdmin: boolean;
  isApprover: boolean;
}) {
  const [open, setOpen] = useState(false);

  const moreItems = [
    { to: "/visitas", label: "Visitas", icon: CalendarCheck2, show: true },
    { to: "/metas", label: "Metas", icon: Target, show: true },
    { to: "/perfil", label: "Perfil", icon: User, show: true },
    { to: "/mapa-clientes", label: "Mapa", icon: MapIcon, show: isApprover },
    { to: "/equipe", label: "Equipe", icon: UsersRound, show: isApprover },
    { to: "/admin", label: "Administração", icon: LayoutGrid, show: isAdmin },
  ].filter((item) => item.show);

  const moreActive = moreItems.some((item) => isActive(item.to, false));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {primaryTabs.map((item) => {
        const active = isActive(item.to, item.exact);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className={cn("h-5.5 w-5.5", active && "drop-shadow-sm")} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Menu className="h-5.5 w-5.5" />
            <span>Mais</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl border-none pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">Mais opções</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {moreItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card px-2 py-3 text-center text-[11px] font-medium transition-colors",
                  isActive(item.to, false)
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="leading-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
