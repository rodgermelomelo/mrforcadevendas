import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, ShoppingCart, Sparkles, UserPlus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useSales } from "@/lib/state/sales-store";
import { Button } from "@/components/ui/button";
import { useCustomerPicker } from "@/components/customer-picker";
import type { Product } from "@/lib/domain/types";
import { ProductDetailDialog } from "@/features/catalog/product-detail-dialog";
import { ProductCard } from "@/features/catalog/product-card";
import { ProductCardSkeleton } from "@/features/catalog/product-card-skeleton";
import { CatalogFilterBar } from "@/features/catalog/catalog-filter-bar";
import { useCatalogFilters } from "@/features/catalog/use-catalog-filters";

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
  const { customer, table, addItem, itemCount, products, role, brandMetadata } = useSales();
  const { openCustomerPicker } = useCustomerPicker();
  const isAdmin = role === "administrador";

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filters = useCatalogFilters({ products, brandMetadata, table });

  const inStockCount = useMemo(() => products.filter((p) => p.stock > 0).length, [products]);
  const tableBlocked = Boolean(customer) && (!table || table.mappedLevel === null);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold sm:text-4xl">Catálogo</h1>
          {customer ? (
            <p className="mt-2 truncate text-sm text-muted-foreground">
              Comprando para: <strong className="text-foreground">{customer.tradeName}</strong> ·{" "}
              Rep. {customer.sellerErpCode ?? "—"} ·{" "}
              {table ? `${table.code} ${table.name}` : "sem tabela"} ·{" "}
              {table?.levelLabel ?? "nível pendente"} · {customer.paymentTerm}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {products.length.toLocaleString("pt-BR")} produtos ·{" "}
              {inStockCount.toLocaleString("pt-BR")} com estoque. Selecione um cliente para ver
              preços e montar um pedido.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {customer ? (
            <Button
              onClick={() => openCustomerPicker({ startNewOrder: true })}
              className="rounded-xl bg-brand-gradient shadow-lift"
            >
              <Plus className="mr-1 h-4 w-4" /> Novo pedido
            </Button>
          ) : (
            <Button
              onClick={() => openCustomerPicker()}
              className="rounded-xl bg-brand-gradient shadow-lift"
            >
              <UserPlus className="mr-1 h-4 w-4" /> Selecionar cliente
            </Button>
          )}
          <Button asChild variant="outline" className="shrink-0 rounded-xl">
            <Link to="/carrinho">
              <ShoppingCart className="mr-1 h-4 w-4" /> {itemCount}
            </Link>
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="outline"
              className="shrink-0 rounded-xl border-primary/20 text-primary"
            >
              <Link to="/admin/produtos">Admin</Link>
            </Button>
          )}
        </div>
      </header>

      {tableBlocked && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Configuração de preço pendente: a tabela {customer?.priceTableCode} não tem nível de preço
          mapeado. Nenhum preço é exibido e o pedido fica bloqueado até a configuração
          administrativa.
        </div>
      )}

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

      {filters.filtered.length === 0 ? (
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
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filters.pagedItems.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                hasCustomer={Boolean(customer)}
                onAdd={(qty) => {
                  addItem(p.id, qty);
                  toast.success(`${qty} un. de ${p.name} no carrinho`);
                }}
                onOpenDetail={() => setSelectedProduct(p)}
              />
            ))}

            {filters.loading &&
              Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={`skeleton-${i}`} />)}
          </div>

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
