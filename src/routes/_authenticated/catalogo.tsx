import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Search, Plus, Minus, ShoppingCart, Sparkles, PackageCheck, UserPlus, X, ArrowUpDown, ChevronDown, Building2, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL, resolvePrice } from "@/lib/pricing";
import { productImage } from "@/lib/product-images";
import { useSales } from "@/lib/state/sales-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCustomerPicker } from "@/components/customer-picker";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/domain/types";

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
  const { customer, table, addItem, itemCount, products, productGroups, role, brandMetadata } = useSales();
  const { openCustomerPicker } = useCustomerPicker();
  const [term, setTerm] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [onlyLaunch, setOnlyLaunch] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState<"relevance" | "code" | "price-asc" | "price-desc">("relevance");
  const isAdmin = role === "administrador";
  
  // Pagination & Loading state
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const ITEMS_PER_PAGE = 20;

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const result = products.filter((p) => {
      const pCategory = (p as any).category || p.group;
      
      // Filtro de marca e categoria vinculada
      if (selectedBrands.length > 0) {
        const brandName = p.brand;
        if (!brandName) return false;
        
        const metadata = brandMetadata[brandName];
        
        // Se a marca do produto é uma das marcas selecionadas
        const isExactBrandSelected = selectedBrands.includes(brandName);
        
        // Se a marca do produto é uma categoria e sua marca pai está selecionada
        const isParentBrandSelected = metadata?.isCategory && metadata?.parentBrand && selectedBrands.includes(metadata.parentBrand);
        
        if (!isExactBrandSelected && !isParentBrandSelected) return false;
      }
      
      // Se houver grupos (categorias) selecionados, o produto deve pertencer a um deles
      if (selectedGroups.length > 0 && !selectedGroups.includes(pCategory)) return false;

      if (onlyLaunch && !p.isLaunch) return false;
      if (onlyInStock && p.stock <= 0) return false;
      if (!q) return true;
      return `${p.name} ${p.erpCode} ${pCategory} ${p.brand || ""}`.toLowerCase().includes(q);
    });

    return result.sort((a, b) => {
      if (sortBy === "code") return a.erpCode.localeCompare(b.erpCode);
      if (sortBy.startsWith("price")) {
        const resA = resolvePrice(a, table);
        const resB = resolvePrice(b, table);
        const pA = resA.ok ? resA.value : 0;
        const pB = resB.ok ? resB.value : 0;
        return sortBy === "price-asc" ? pA - pB : pB - pA;
      }
      // relevância (padrão): produtos com estoque primeiro, depois lançamentos, depois código
      const availA = a.stock > 0 ? 1 : 0;
      const availB = b.stock > 0 ? 1 : 0;
      if (availA !== availB) return availB - availA;
      if (a.isLaunch !== b.isLaunch) return a.isLaunch ? -1 : 1;
      return a.erpCode.localeCompare(b.erpCode);
    });
  }, [term, selectedGroups, selectedBrands, onlyLaunch, onlyInStock, products, sortBy, table, brandMetadata]);

  const pagedItems = useMemo(() => {
    return filtered.slice(0, page * ITEMS_PER_PAGE);
  }, [filtered, page]);

  const hasMore = pagedItems.length < filtered.length;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [term, selectedGroups, selectedBrands, onlyLaunch, onlyInStock, sortBy]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    // Simulate short loading for feedback
    setTimeout(() => {
      setPage((prev) => prev + 1);
      setLoading(false);
    }, 400);
  }, [loading, hasMore]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      // Se o produto tem uma marca, e essa marca tem uma "parentBrand", a marca principal é a parentBrand
      const brandName = p.brand;
      if (!brandName) return;
      
      const metadata = brandMetadata[brandName];
      if (metadata?.isCategory && metadata?.parentBrand) {
        set.add(metadata.parentBrand);
      } else if (!metadata?.isCategory) {
        set.add(brandName);
      }
    });
    return Array.from(set).sort();
  }, [products, brandMetadata]);

  const groups = useMemo(() => {
    // Categorias são os itens que marcamos como isCategory: true vinculados às marcas selecionadas
    // OU as categorias do ERP (p.category) vinculadas às marcas selecionadas
    const availableGroups = new Set<string>();
    
    products.forEach(p => {
      const brandName = p.brand;
      if (!brandName) return;
      
      const metadata = brandMetadata[brandName];
      const parentBrand = metadata?.parentBrand;
      
      // Se não houver marcas selecionadas, ou se a marca/pai do produto estiver selecionada
      const isRelevant = selectedBrands.length === 0 || 
                        selectedBrands.includes(brandName) || 
                        (parentBrand && selectedBrands.includes(parentBrand));
      
      if (isRelevant) {
        // Se for uma categoria manual, mostramos ela mesma como opção de filtro fino
        if (metadata?.isCategory) {
          availableGroups.add(brandName);
        } else {
          // Se for uma marca principal, mostramos as categorias do ERP dela
          const pCategory = (p as any).category || p.group;
          if (pCategory) availableGroups.add(pCategory);
        }
      }
    });
    return Array.from(availableGroups).sort();
  }, [products, selectedBrands, brandMetadata]);

  const toggleBrand = (b: string) => {
    setSelectedBrands((prev) =>
      prev.includes(b) ? prev.filter((i) => i !== b) : [...prev, b]
    );
  };

  const toggleGroup = (g: string) => {
    setSelectedGroups((prev) =>
      prev.includes(g) ? prev.filter((i) => i !== g) : [...prev, g]
    );
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedGroups([]);
    setOnlyLaunch(false);
    setOnlyInStock(false);
    setTerm("");
  };

  const hasActiveFilters =
    selectedBrands.length > 0 ||
    selectedGroups.length > 0 ||
    onlyLaunch ||
    onlyInStock ||
    term !== "";

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
              {table ? `${table.code} ${table.name}` : "sem tabela"} ·{" "}
              {table?.levelLabel ?? "nível pendente"} · {customer.paymentTerm}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {products.length.toLocaleString("pt-BR")} produtos · {inStockCount.toLocaleString("pt-BR")} com estoque.
              Selecione um cliente para ver preços e montar um pedido.
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
            <Button asChild variant="outline" className="shrink-0 rounded-xl border-primary/20 text-primary">
              <Link to="/admin/produtos">Admin</Link>
            </Button>
          )}
        </div>
      </header>

      {tableBlocked && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Configuração de preço pendente: a tabela {customer?.priceTableCode} não tem nível de preço
          mapeado. Nenhum preço é exibido e o pedido fica bloqueado até a configuração administrativa.
        </div>
      )}

      <div className="sticky top-0 z-10 space-y-4 bg-background/80 pb-4 backdrop-blur-md sm:pb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nome, código, grupo ou empresa"
              className="h-12 rounded-xl bg-card pl-11 text-base"
            />
          </div>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-12 w-[160px] rounded-xl bg-card border-none shadow-none">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Ordenar" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevância</SelectItem>
              <SelectItem value="code">Código</SelectItem>
              <SelectItem value="price-asc">Menor Preço</SelectItem>
              <SelectItem value="price-desc">Maior Preço</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-4">
          {/* Quick Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setOnlyInStock((v) => !v)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                onlyInStock
                  ? "border-transparent bg-success text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <PackageCheck className="h-3 w-3" /> Com estoque
            </button>
            <button
              onClick={() => setOnlyLaunch((v) => !v)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                onlyLaunch
                  ? "border-transparent bg-brand-gradient text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3 w-3" /> Lançamentos
            </button>
          </div>

          {/* Active Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 px-1">
              {selectedBrands.map((b) => (
                <Badge
                  key={b}
                  variant="secondary"
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] bg-primary/10 text-primary border-primary/20"
                >
                  {b}
                  <button onClick={() => toggleBrand(b)} className="hover:text-primary/70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedGroups.map((g) => (
                <Badge
                  key={g}
                  variant="secondary"
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] bg-primary/10 text-primary border-primary/20"
                >
                  {g}
                  <button onClick={() => toggleGroup(g)} className="hover:text-primary/70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {onlyInStock && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] bg-success/10 text-success border-success/20"
                >
                  Com estoque
                  <button onClick={() => setOnlyInStock(false)} className="hover:text-success/70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {onlyLaunch && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] bg-brand-gradient text-white border-transparent"
                >
                  Lançamento
                  <button onClick={() => setOnlyLaunch(false)} className="hover:text-white/70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button
                onClick={clearFilters}
                className="text-[11px] font-medium text-muted-foreground hover:text-primary underline underline-offset-2 ml-1"
              >
                Limpar tudo
              </button>
            </div>
          )}

          {/* Brand Filter */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">
              <Building2 className="h-3 w-3" /> Empresa
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {brands.map((b) => (
                <button
                  key={b}
                  onClick={() => toggleBrand(b)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
                    selectedBrands.includes(b)
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">
              <Tag className="h-3 w-3" /> Categoria
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGroup(g)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
                    selectedGroups.includes(g)
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString("pt-BR")} produtos exibidos
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card flex min-h-[40vh] flex-col items-center justify-center p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Search className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Nenhum produto encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tente ajustar os filtros ou o termo de busca.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-info/10 px-4 py-2 text-xs text-info border border-info/20">
            <Sparkles className="h-3 w-3" />
            <span>Nota: O catálogo oculta automaticamente produtos de marcas que foram desativadas administrativamente.</span>
          </div>
          <Button variant="outline" onClick={clearFilters} className="mt-6 rounded-xl">
            Limpar todos os filtros
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pagedItems.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                hasCustomer={Boolean(customer)}
                onAdd={(qty) => {
                  addItem(p.id, qty);
                  toast.success(`${qty} un. de ${p.name} no carrinho`);
                }}
              />
            ))}
            
            {loading && 
              Array.from({ length: 5 }).map((_, i) => (
                <ProductSkeleton key={`skeleton-${i}`} />
              ))
            }
          </div>

          {hasMore && !loading && (
            <div className="flex justify-center pt-8">
              <Button 
                variant="outline" 
                onClick={loadMore}
                className="rounded-xl px-8 h-11 border-primary/20 text-primary hover:bg-primary/5"
              >
                Carregar mais produtos <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="surface-card flex flex-col overflow-hidden opacity-60">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-3 p-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  hasCustomer,
  onAdd,
}: {
  product: Product;
  hasCustomer: boolean;
  onAdd: (qty: number) => void;
}) {
  const { table } = useSales();
  const [qty, setQty] = useState(1);
  const price = resolvePrice(product, table);
  const outOfStock = product.stock <= 0;

  // Sem cliente: navegável (sem preço/adicionar). Com cliente: bloqueia sem estoque/preço.
  const blocked = hasCustomer && (outOfStock || !price.ok);
  const dimmed = hasCustomer ? blocked : outOfStock;

  return (
    <article
      className={cn(
        "surface-card flex flex-col overflow-hidden transition-shadow relative group",
        dimmed ? "opacity-70 grayscale" : "hover:shadow-lift",
      )}
    >
      {/* Brand & Category badges on hover */}
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-background/80 backdrop-blur-sm border-primary/20 text-primary">
          {product.brand}
        </Badge>
        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-background/80 backdrop-blur-sm">
          {(product as any).category || product.group}
        </Badge>
      </div>
      <div className="relative aspect-square bg-muted">
        {productImage(product.imageUrl) ? (
          <img
            src={productImage(product.imageUrl) ?? ""}
            alt={product.name}
            loading="lazy"
            width={800}
            height={800}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center bg-brand-gradient p-4 text-center text-xs font-semibold text-primary-foreground">
            {product.name}
          </div>
        )}
        {product.isLaunch && !dimmed && (
          <span className="absolute left-3 top-3 rounded-full bg-brand-gradient px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
            Lançamento
          </span>
        )}
        {outOfStock && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/85 px-2.5 py-1 text-[11px] font-semibold text-background">
            Indisponível
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
          {product.brand && <span className="font-bold text-primary">{product.brand} · </span>}
          {(product as any).category || product.group} · {product.erpCode}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{product.name}</h3>

        <div className="mt-2">
          {!hasCustomer ? (
            <p className="text-[11px] text-muted-foreground">
              Estoque {product.stock} {product.unit} · selecione um cliente para o preço
            </p>
          ) : price.ok ? (
            <>
              <p className="text-lg font-bold">{formatBRL(price.value)}</p>
              <p className="text-[11px] text-muted-foreground">
                {price.levelLabel} · estoque {product.stock} {product.unit}
              </p>
            </>
          ) : (
            <p className="text-xs font-medium text-warning">{price.message}</p>
          )}
        </div>

        {hasCustomer && !blocked && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border border-border">
                <button
                  className="grid h-9 w-8 place-items-center text-muted-foreground"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                  inputMode="numeric"
                  className="w-9 bg-transparent text-center text-sm font-semibold outline-hidden"
                  aria-label="Quantidade"
                />
                <button
                  className="grid h-9 w-8 place-items-center text-muted-foreground"
                  onClick={() => setQty((q) => q + 1)}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {[6, 12, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setQty(n)}
                  className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {n}
                </button>
              ))}
            </div>
            <Button className="mt-3 w-full rounded-xl" onClick={() => onAdd(qty)}>
              Adicionar
            </Button>
          </>
        )}

        {hasCustomer && blocked && (
          <p className="mt-3 rounded-xl bg-muted p-2.5 text-xs text-muted-foreground">
            {outOfStock
              ? "Sem estoque — indisponível para o pedido."
              : "Sem preço válido para a tabela do cliente."}
          </p>
        )}
      </div>
    </article>
  );
}