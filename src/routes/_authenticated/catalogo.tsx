import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Minus, ShoppingCart, Sparkles, PackageCheck, UserPlus, Plus as PlusIcon } from "lucide-react";
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
  const { customer, table, addItem, itemCount, products, productGroups } = useSales();
  const { openCustomerPicker } = useCustomerPicker();
  const [term, setTerm] = useState("");
  const [group, setGroup] = useState<string>("Todos");
  const [onlyLaunch, setOnlyLaunch] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return products.filter((p) => {
      if (group !== "Todos" && p.group !== group) return false;
      if (onlyLaunch && !p.isLaunch) return false;
      if (onlyInStock && p.stock <= 0) return false;
      if (!q) return true;
      return `${p.name} ${p.erpCode} ${p.group}`.toLowerCase().includes(q);
    });
  }, [term, group, onlyLaunch, onlyInStock, products]);

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
              <PlusIcon className="mr-1 h-4 w-4" /> Novo pedido
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
        </div>
      </header>

      {tableBlocked && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Configuração de preço pendente: a tabela {customer?.priceTableCode} não tem nível de preço
          mapeado. Nenhum preço é exibido e o pedido fica bloqueado até a configuração administrativa.
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nome, código ou grupo"
            className="h-12 rounded-xl bg-card pl-11 text-base"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
          <span className="mx-1 w-px shrink-0 self-stretch bg-border" />
          {["Todos", ...productGroups].map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                group === g
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString("pt-BR")} produtos exibidos
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
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
        </div>
      )}
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
        "surface-card flex flex-col overflow-hidden transition-shadow",
        dimmed ? "opacity-70 grayscale" : "hover:shadow-lift",
      )}
    >
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
          {product.group} · {product.erpCode}
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
