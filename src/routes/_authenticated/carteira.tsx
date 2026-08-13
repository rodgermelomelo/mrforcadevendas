import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  ShieldAlert,
  MapPin,
  Plus,
  ShoppingCart,
  PackageSearch,
  X,
  Users,
  Info,
  LayoutGrid,
  FolderOpen,
} from "lucide-react";
import { maskTaxId } from "@/lib/pricing";
import { useSales } from "@/lib/state/sales-store";
import { Input } from "@/components/ui/input";
import { cn, normalizeSearchText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomerPicker } from "@/components/customer-picker";
import { NewCustomerDialog } from "@/components/new-customer-dialog";
import { CustomerDetailDialog } from "@/components/admin/customer-detail-dialog";
import { Customer } from "@/lib/domain/types";
import { canViewPriceTableDetails } from "@/lib/domain/roles";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Minha carteira — MR Força de Vendas" },
      {
        name: "description",
        content:
          "Busque clientes da sua carteira por código, razão social, nome fantasia, CNPJ ou cidade e inicie um pedido.",
      },
      { property: "og:title", content: "Minha carteira — MR Força de Vendas" },
      { property: "og:description", content: "Clientes da sua carteira comercial MR Cosméticos." },
    ],
  }),
  component: Carteira,
});

function Carteira() {
  const [term, setTerm] = useState("");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "city">("city");
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const { customer, customers, priceTables, sellers, itemCount, clearCustomer, role } = useSales();
  const { openCustomerPicker, startWithCustomer } = useCustomerPicker();
  const showPriceTableDetails = canViewPriceTableDetails(role);

  const results = useMemo(() => {
    const q = normalizeSearchText(term.trim());
    return customers.filter((c) => {
      if (sellerFilter !== "all" && c.sellerErpCode !== sellerFilter) return false;
      if (!q) return true;
      return normalizeSearchText(
        [c.erpCode, c.legalName, c.tradeName, c.taxId, c.city, c.uf, c.sellerErpCode].join(" "),
      ).includes(q);
    });
  }, [term, customers, sellerFilter]);

  const groupedByCity = useMemo(() => {
    const groups: Record<string, Customer[]> = {};
    results.forEach((c) => {
      const city = c.city || "Outras Cidades";
      if (!groups[city]) groups[city] = [];
      groups[city].push(c);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([city, items]) => ({
        city,
        items: items.sort((a, b) => a.tradeName.localeCompare(b.tradeName)),
      }));
  }, [results]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Minha carteira</h1>
          <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground sm:mt-2 sm:line-clamp-none sm:text-sm">
            Selecionar um cliente é o ponto de partida do pedido — os preços são calculados pelo
            cadastro comercial dele.
          </p>
        </div>
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:shrink-0 sm:flex-wrap sm:items-start sm:overflow-visible sm:px-0 [&>*]:shrink-0">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/mapa-clientes">
              <MapPin className="mr-1 h-4 w-4" /> Ver mapa
            </Link>
          </Button>
          <NewCustomerDialog onCreated={(id) => startWithCustomer(id)} />
          <Button
            onClick={() => openCustomerPicker({ startNewOrder: true })}
            className="rounded-xl bg-brand-gradient shadow-lift"
          >
            <Plus className="mr-1 h-4 w-4" /> Novo pedido
          </Button>
        </div>
      </header>

      {customer && (
        <div className="surface-card flex flex-wrap items-center gap-3 border-primary/30 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Em atendimento
            </p>
            <p className="truncate text-sm font-semibold">
              {customer.tradeName} · {customer.erpCode}
              {itemCount > 0 && (
                <span className="ml-2 text-xs font-medium text-muted-foreground">
                  {itemCount} {itemCount === 1 ? "item" : "itens"} no carrinho
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/catalogo">
                <PackageSearch className="mr-1 h-4 w-4" /> Ir para o catálogo
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/carrinho">
                <ShoppingCart className="mr-1 h-4 w-4" /> Ver carrinho
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={clearCustomer}>
              <X className="mr-1 h-4 w-4" /> Encerrar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Código, razão social, nome fantasia, CNPJ ou cidade"
            className="h-12 rounded-xl bg-card pl-11 text-base"
          />
        </div>
        {sellers.length > 1 && (
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-card sm:w-72">
              <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Todos os representantes" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">Todos os representantes ({customers.length})</SelectItem>
              {sellers.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.code} · {s.name} ({s.customerCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {results.length.toLocaleString("pt-BR")} de {customers.length.toLocaleString("pt-BR")}{" "}
        clientes
        {sellerFilter !== "all" && ` · representante ${sellerFilter}`}
      </p>

      {results.length === 0 ? (
        <div className="surface-card flex min-h-[40vh] flex-col items-center justify-center p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Search className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Nenhum cliente encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhum cliente da sua carteira corresponde a “{term}”.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-info/10 px-4 py-2 text-xs text-info border border-info/20 max-w-sm mx-auto">
            <ShieldAlert className="h-3 w-3" />
            <span>
              Nota: Clientes inativos ou desativados administrativamente não são exibidos na
              carteira comercial.
            </span>
          </div>
          <Button variant="outline" onClick={() => setTerm("")} className="mt-6 rounded-xl">
            Limpar busca
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((c) => {
            const table = priceTables.find((t) => t.code === c.priceTableCode);
            const selected = customer?.id === c.id;
            const hasOtherCart = itemCount > 0 && Boolean(customer) && !selected;
            return (
              <article
                key={c.id}
                className={cn(
                  "surface-card flex flex-col p-5 transition-shadow hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "border-primary/50 ring-1 ring-primary/30",
                )}
              >
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 cursor-pointer"
                  onClick={() => startWithCustomer(c.id)}
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{c.tradeName}</h2>
                    <p className="truncate text-xs text-muted-foreground">{c.legalName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      {c.erpCode}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailCustomer(c);
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div
                  className="mt-4 space-y-1.5 text-xs text-muted-foreground cursor-pointer"
                  onClick={() => startWithCustomer(c.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {c.city}/{c.uf}
                    </span>
                  </div>
                  <div className="truncate">CNPJ {maskTaxId(c.taxId)}</div>
                  <div className="truncate">
                    Rep. {c.sellerErpCode ?? "—"} · Segmento {c.segment} · Condição {c.paymentTerm}
                  </div>
                </div>

                <div
                  className="mt-4 flex flex-wrap gap-2 cursor-pointer"
                  onClick={() => startWithCustomer(c.id)}
                >
                  {showPriceTableDetails && (
                    <span className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium">
                      {table ? `${table.code} · ${table.name}` : "Sem tabela"}
                    </span>
                  )}
                  {table?.mappedLevel === null && (
                    <span className="rounded-lg border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning">
                      Preço pendente de configuração
                    </span>
                  )}
                  {c.restricted && (
                    <span className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                      <ShieldAlert className="h-3 w-3" /> Restrição
                    </span>
                  )}
                </div>

                <div className="mt-5 grid gap-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      startWithCustomer(c.id);
                    }}
                    className="w-full rounded-xl"
                    variant={selected ? "outline" : "default"}
                  >
                    {selected
                      ? itemCount > 0
                        ? `Continuar atendimento (${itemCount})`
                        : "Continuar atendimento"
                      : hasOtherCart
                        ? "Trocar cliente"
                        : "Atender este cliente"}
                  </Button>
                  {selected && itemCount > 0 && (
                    <Button
                      asChild
                      variant="ghost"
                      className="w-full rounded-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link to="/carrinho">Ver carrinho</Link>
                    </Button>
                  )}
                  {!selected && hasOtherCart && (
                    <p className="text-[11px] text-muted-foreground">
                      O carrinho atual de {customer?.tradeName} será descartado.
                    </p>
                  )}
                  {table?.mappedLevel === null && (
                    <p className="text-[11px] text-warning">
                      Preço pendente de configuração — o pedido ficará bloqueado.
                    </p>
                  )}
                  {c.restricted && (
                    <p className="text-[11px] text-muted-foreground">
                      Cliente com restrição — o pedido irá para aprovação.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CustomerDetailDialog
        customer={detailCustomer}
        open={!!detailCustomer}
        onOpenChange={(open) => !open && setDetailCustomer(null)}
      />
    </div>
  );
}
