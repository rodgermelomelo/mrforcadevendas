import { PageHeader } from "@/components/shared/page-header";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Search,
  Plus,
  ShoppingCart,
  Sparkles,
  UserPlus,
  ChevronDown,
  LayoutGrid,
  FolderOpen,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useSales } from "@/lib/state/sales-store";
import { Button } from "@/components/ui/button";
import { useCustomerPicker } from "@/components/customer-picker";
import type { Product } from "@/lib/domain/types";
import { ProductDetailDialog } from "@/features/catalog/product-detail-dialog";
import { VirtualizedProductGrid } from "@/features/catalog/virtualized-product-grid";
import { ProductCardSkeleton } from "@/features/catalog/product-card-skeleton";
import { CatalogFilterBar } from "@/features/catalog/catalog-filter-bar";
import { useCatalogFilters } from "@/features/catalog/use-catalog-filters";
import { canViewPriceTableDetails } from "@/lib/domain/roles";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductCard } from "@/features/catalog/product-card";
import { useBrandHierarchy, type BrandGroup } from "@/features/catalog/use-brand-hierarchy";
import { prefetchBrandFolder, prefetchBrandFolders } from "@/features/catalog/prefetch-brand-folder";

export const Route = createFileRoute("/_authenticated/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo comercial — MR Força de Vendas" },
      {
        name: "description",
        content:
          "Catálogo premium MR Cosméticos com preço da tabela do cliente, estoque e atalhos de quantidade 6, 12 e 30.",
      },
      { property: "og:title", content: "Catálogo comercial — MR Força de Vendas" },
      { property: "og:description", content: "Produtos, estoque e preços por tabela do cliente." },
    ],
  }),
  component: Catalogo,
});

function Catalogo() {
  const { customer, table, addItem, itemCount, products, role, brandMetadata, taxonomyOverrides, loading } =
    useSales();
  
  const isAdmin = useMemo(() => role === "administrador", [role]);
  const showPriceTableDetails = useMemo(() => canViewPriceTableDetails(role), [role]);
  
  const { openCustomerPicker } = useCustomerPicker();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "brand">("brand");
  const [isPending, startTransition] = useTransition();

  const handleViewModeChange = (mode: "list" | "brand") => {
    startTransition(() => {
      setViewMode(mode);
    });
  };

  const filters = useCatalogFilters({ products, brandMetadata, table });

  const inStockCount = useMemo(() => products.filter((p) => p.stock > 0).length, [products]);
  const tableBlocked = Boolean(customer) && (!table || table.mappedLevel === null);
  const catalogLoading = loading && products.length === 0;

  // Hierarquia (marca > produtos) memoizada em cache: a troca lista <-> pastas
  // e o retorno à rota reaproveitam o agrupamento já calculado.
  const groupedByBrand = useBrandHierarchy(filters.filtered, taxonomyOverrides, filters.cacheKey ?? "");


  const activeAccordionValues = useMemo(() => {
    if (filters.term) {
      return groupedByBrand.map((g) => g.brand);
    }
    return groupedByBrand.length === 1 ? [groupedByBrand[0]?.brand ?? ""] : [];
  }, [filters.term, groupedByBrand]);

  // Aquece as pastas já abertas (busca ou marca única) e a primeira da lista.
  useEffect(() => {
    if (viewMode !== "brand" || groupedByBrand.length === 0) return;
    const targets = activeAccordionValues.filter(Boolean);
    prefetchBrandFolders(groupedByBrand, targets.length ? targets : [groupedByBrand[0]!.brand]);
  }, [viewMode, groupedByBrand, activeAccordionValues]);


  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 sm:space-y-6">
      <PageHeader
        title="Catálogo"
        description={
          customer ? (
            <>
              Comprando para: <strong className="text-foreground">{customer.tradeName}</strong> ·{" "}
              Rep. {customer.sellerErpCode ?? "—"} ·{" "}
              {showPriceTableDetails && (
                <>
                  {table ? `${table.code} ${table.name}` : "sem tabela"} ·{" "}
                  {table?.levelLabel ?? "nível pendente"} ·{" "}
                </>
              )}
              {customer.paymentTerm}
            </>
          ) : catalogLoading ? (
            "Carregando produtos, preços e estoque..."
          ) : (
            `${products.length.toLocaleString("pt-BR")} produtos · ${inStockCount.toLocaleString("pt-BR")} com estoque. Selecione um cliente para ver preços.`
          )
        }
        actions={
          <>
            {customer ? (
              <Button
                onClick={() => openCustomerPicker({ startNewOrder: true })}
                className="h-11 rounded-xl bg-brand-gradient shadow-lift"
              >
                <Plus className="mr-1 h-4 w-4" /> Novo pedido
              </Button>
            ) : (
              <Button
                onClick={() => openCustomerPicker()}
                className="h-11 rounded-xl bg-brand-gradient shadow-lift"
              >
                <UserPlus className="mr-1 h-4 w-4" /> Selecionar cliente
              </Button>
            )}
            <Button asChild variant="outline" className="hidden h-11 rounded-xl lg:inline-flex">
              <Link to="/carrinho">
                <ShoppingCart className="mr-1 h-4 w-4" /> {itemCount}
              </Link>
            </Button>
            {isAdmin && (
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl border-primary/20 text-primary"
              >
                <Link to="/admin/produtos">Admin</Link>
              </Button>
            )}
          </>
        }
      />

      {tableBlocked && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {showPriceTableDetails
            ? `Configuração de preço pendente: a tabela ${customer?.priceTableCode} não tem nível de preço mapeado.`
            : "Configuração de preço pendente para este cliente."}{" "}
          Nenhum preço é exibido e o pedido fica bloqueado até a configuração administrativa.
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CatalogFilterBar
          term={filters.term}
          onTermChange={filters.setTerm}
          sortBy={filters.sortBy}
          onSortChange={filters.setSortBy}
          onlyInStock={filters.onlyInStock}
          onToggleInStock={() => filters.setOnlyInStock((v) => !v)}
          onlyLaunch={filters.onlyLaunch}
          onToggleLaunch={() => filters.setOnlyLaunch((v) => !v)}
          brands={filters.brands}
          groups={filters.groups}
          selectedBrands={filters.selectedBrands}
          selectedGroups={filters.selectedGroups}
          onToggleBrand={filters.toggleBrand}
          onToggleGroup={filters.toggleGroup}
          hasActiveFilters={filters.hasActiveFilters}
          onClearFilters={filters.clearFilters}
          resultCount={filters.filtered.length}
        />

        <div className="flex w-full shrink-0 rounded-lg border bg-muted p-0.5 sm:w-auto">
          <button
            onClick={() => handleViewModeChange("brand")}
            disabled={isPending}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-xs font-medium transition-all sm:flex-initial",
              viewMode === "brand"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" /> Por Marcas
          </button>
          <button
            onClick={() => handleViewModeChange("list")}
            disabled={isPending}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-xs font-medium transition-all sm:flex-initial",
              viewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Todos
          </button>
        </div>
      </div>

      {catalogLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-group-${i}`} className="surface-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <ProductCardSkeleton key={`skeleton-prod-${i}-${j}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filters.filtered.length === 0 ? (
        <div className="surface-card flex min-h-[40vh] flex-col items-center justify-center p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Search className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Nenhum produto encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tente ajustar os filtros ou o termo de busca.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-info/20 bg-info/10 px-4 py-2 text-xs text-info">
            <Sparkles className="h-3 w-3" />
            <span>
              Nota: O catálogo oculta automaticamente produtos de marcas que foram desativadas
              administrativamente.
            </span>
          </div>
          <Button variant="outline" onClick={filters.clearFilters} className="mt-6 rounded-xl">
            Limpar todos os filtros
          </Button>
        </div>
      ) : viewMode === "brand" ? (
        <Accordion
          type="multiple"
          defaultValue={activeAccordionValues}
          onValueChange={(values) => prefetchBrandFolders(groupedByBrand, values)}
          className="space-y-3"
        >
          {groupedByBrand.map(({ brand, items }) => (
            <AccordionItem key={brand} value={brand} className="surface-card border-none px-0">
              <AccordionTrigger
                className="px-5 py-4 hover:no-underline"
                onMouseEnter={() => prefetchBrandFolder(groupedByBrand, brand)}
                onFocus={() => prefetchBrandFolder(groupedByBrand, brand)}
                onTouchStart={() => prefetchBrandFolder(groupedByBrand, brand)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold text-foreground leading-tight">{brand}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {items.length} {items.length === 1 ? "produto" : "produtos"}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      hasCustomer={Boolean(customer)}
                      onAdd={(qty) => {
                        const result = addItem(p.id, qty);
                        if (!result.ok) {
                          toast.error(result.message);
                          return;
                        }
                        toast.success(`${qty} un. de ${p.name} no carrinho`);
                      }}
                      onOpenDetail={() => setSelectedProduct(p)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <>
          <VirtualizedProductGrid
            products={filters.pagedItems}
            hasCustomer={Boolean(customer)}
            loadingMore={filters.loading}
            onEndReached={filters.loadMore}
            onOpenDetail={(p) => setSelectedProduct(p)}
            onAdd={(p, qty) => {
              const result = addItem(p.id, qty);
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(`${qty} un. de ${p.name} no carrinho`);
            }}
          />

          {filters.hasMore && !filters.loading && (
            <div className="flex justify-center pt-8">
              <Button
                variant="outline"
                onClick={filters.loadMore}
                className="h-11 rounded-xl border-primary/20 px-8 text-primary hover:bg-primary/5"
              >
                Carregar mais produtos <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Exibindo {filters.pagedItems.length.toLocaleString("pt-BR")} de{" "}
            {filters.filtered.length.toLocaleString("pt-BR")} produtos
          </p>
        </>
      )}

      <ProductDetailDialog
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onOpenChange={(open: boolean) => !open && setSelectedProduct(null)}
      />
    </div>
  );
}