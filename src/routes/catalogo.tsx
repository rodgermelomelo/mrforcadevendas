import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Minus, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { productGroups, products } from "@/lib/demo/data";
import { formatBRL, resolvePrice } from "@/lib/pricing";
import { useSales } from "@/lib/state/sales-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/domain/types";

export const Route = createFileRoute("/catalogo")({
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
  const { customer, table, addItem, itemCount } = useSales();
  const [term, setTerm] = useState("");
  const [group, setGroup] = useState<string>("Todos");
  const [onlyLaunch, setOnlyLaunch] = useState(false);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return products.filter((p) => {
      if (group !== "Todos" && p.group !== group) return false;
      if (onlyLaunch && !p.isLaunch) return false;
      if (!q) return true;
      return `${p.name} ${p.erpCode} ${p.group}`.toLowerCase().includes(q);
    });
  }, [term, group, onlyLaunch]);

  if (!customer) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="surface-card p-10 text-center">
          <h1 className="text-2xl font-bold">Selecione um cliente primeiro</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            O preço depende da tabela do cliente, por isso o catálogo só abre depois que você escolhe
            quem está comprando.
          </p>
          <Button asChild className="mt-6 rounded-xl bg-brand-gradient">
            <Link to="/carteira">Abrir minha carteira</Link>
          </Button>
        </div>
      </div>
    );
  }

  const tableBlocked = !table || table.mappedLevel === null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold sm:text-4xl">Catálogo</h1>
          <p className="mt-2 truncate text-sm text-muted-foreground">
            Comprando para: <strong className="text-foreground">{customer.tradeName}</strong> ·{" "}
            {table ? `${table.code} ${table.name}` : "sem tabela"} ·{" "}
            {table?.levelLabel ?? "nível pendente"} · {customer.paymentTerm}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 rounded-xl">
          <Link to="/carrinho">
            <ShoppingCart className="mr-1 h-4 w-4" /> {itemCount}
          </Link>
        </Button>
      </header>

      {tableBlocked && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Configuração de preço pendente: a tabela {customer.priceTableCode} não tem nível de preço
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
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
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

function ProductCard({ product, onAdd }: { product: Product; onAdd: (qty: number) => void }) {
  const { table } = useSales();
  const [qty, setQty] = useState(1);
  const price = resolvePrice(product, table);
  const outOfStock = product.stock <= 0;
  const blocked = outOfStock || !price.ok;

  return (
    <article
      className={cn(
        "surface-card flex flex-col overflow-hidden transition-shadow",
        blocked ? "opacity-70 grayscale" : "hover:shadow-lift",
      )}
    >
      <div className="relative aspect-square bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            width={800}
            height={800}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center bg-brand-gradient p-6 text-center text-sm font-semibold text-primary-foreground">
            {product.name}
          </div>
        )}
        {product.isLaunch && !blocked && (
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

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {product.group} · {product.erpCode}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{product.name}</h3>

        <div className="mt-3">
          {price.ok ? (
            <>
              <p className="text-xl font-bold">{formatBRL(price.value)}</p>
              <p className="text-[11px] text-muted-foreground">
                {price.levelLabel} · estoque {product.stock} {product.unit}
              </p>
            </>
          ) : (
            <p className="text-xs font-medium text-warning">{price.message}</p>
          )}
        </div>

        {!blocked && (
          <>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex items-center rounded-xl border border-border">
                <button
                  className="grid h-9 w-9 place-items-center text-muted-foreground"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                  inputMode="numeric"
                  className="w-10 bg-transparent text-center text-sm font-semibold outline-hidden"
                  aria-label="Quantidade"
                />
                <button
                  className="grid h-9 w-9 place-items-center text-muted-foreground"
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
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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

        {blocked && (
          <p className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            {outOfStock
              ? "Produto sem estoque — indisponível para inclusão no pedido."
              : "Produto sem preço válido para a tabela do cliente."}
          </p>
        )}
      </div>
    </article>
  );
}
