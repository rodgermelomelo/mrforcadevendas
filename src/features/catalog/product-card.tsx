import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { formatBRL, resolvePrice } from "@/lib/pricing";
import { resolveProductImage } from "@/lib/product-images";
import { useSales } from "@/lib/state/sales-store";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/domain/types";
import { canViewPriceTableDetails } from "@/lib/domain/roles";

/** Atalhos de quantidade usados no card do catálogo. */
export const QUANTITY_SHORTCUTS = [6, 12, 30] as const;

export interface ProductCardProps {
  product: Product;
  hasCustomer: boolean;
  onAdd: (qty: number) => void;
  onOpenDetail: () => void;
}

function ProductCardComponent({ product, hasCustomer, onAdd, onOpenDetail }: ProductCardProps) {
  const { table, role, customer: activeCustomer } = useSales();
  const [qty, setQty] = useState(1);
  const price = resolvePrice(product, table);
  const showPriceTableDetails = canViewPriceTableDetails(role);
  const outOfStock = product.stock <= 0;
  const maxQty = product.stock > 0 ? Math.floor(product.stock) : 1;
  const clampQty = (value: number) => Math.min(maxQty, Math.max(1, value));

  // Sem cliente: navegável (sem preço/adicionar). Com cliente: bloqueia sem estoque/preço/restrição.
  const isRestricted = hasCustomer && activeCustomer?.restricted;
  const blocked = hasCustomer && (outOfStock || !price.ok || isRestricted);
  const dimmed = hasCustomer ? blocked : outOfStock;
  const category = product.category || product.group;
  const image = resolveProductImage(product);

  return (
    <article
      className={cn(
        "surface-card group relative flex flex-col overflow-hidden transition-shadow",
        dimmed ? "opacity-70 grayscale" : "hover:shadow-lift",
      )}
    >
      {/* Marca e categoria aparecem no hover */}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Badge
          variant="secondary"
          className="h-4 border-primary/20 bg-background/80 px-1 text-[9px] text-primary backdrop-blur-sm"
        >
          {product.brand}
        </Badge>
        <Badge variant="outline" className="h-4 bg-background/80 px-1 text-[9px] backdrop-blur-sm">
          {category}
        </Badge>
      </div>

      <div className="relative aspect-square cursor-pointer bg-muted" onClick={onOpenDetail}>
        {image ? (
          <img
            src={image}
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
          {category} · {product.erpCode}
        </p>
        <h3
          className="mt-1 line-clamp-2 cursor-pointer text-sm font-semibold transition-colors hover:text-primary"
          onClick={onOpenDetail}
        >
          {product.name}
        </h3>

        <div className="mt-2">
          {!hasCustomer ? (
            <p className="text-[11px] text-muted-foreground">
              Estoque {product.stock.toLocaleString("pt-BR")} {product.unit} · selecione um cliente
              para o preço
            </p>
          ) : price.ok ? (
            <>
              <p className="text-lg font-bold">{formatBRL(price.value)}</p>
              <p className="text-[11px] text-muted-foreground">
                {showPriceTableDetails && `${price.levelLabel} · `}
                estoque {product.stock.toLocaleString("pt-BR")} {product.unit}
              </p>
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-medium leading-tight text-warning">
                {isRestricted 
                  ? `Indisponível: ${activeCustomer?.restrictionReason || "Restrição comercial"}`
                  : !price.ok ? (showPriceTableDetails ? price.message : "Preço pendente para este cliente.") : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Estoque {product.stock.toLocaleString("pt-BR")} {product.unit}
              </p>
            </div>
          )}
        </div>

        {hasCustomer && !blocked && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <QuantityStepper value={qty} onChange={(value) => setQty(clampQty(value))} />
              {QUANTITY_SHORTCUTS.map((n) => (
                <button
                  key={n}
                  disabled={n > maxQty}
                  onClick={() => setQty(clampQty(n))}
                  className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {n}
                </button>
              ))}
            </div>
            <Button className="mt-3 w-full rounded-xl" onClick={() => onAdd(clampQty(qty))}>
              Adicionar
            </Button>
          </>
        )}

        {hasCustomer && blocked && (
          <p className="mt-3 rounded-xl bg-muted p-2.5 text-[10px] leading-snug text-muted-foreground">
            {isRestricted
              ? `Indisponível: ${activeCustomer?.restrictionReason || "Cliente com restrição comercial ativa."}`
              : outOfStock
                ? "Sem estoque — indisponível para o pedido."
                : !price.ok
                  ? (showPriceTableDetails ? price.message : "Sem preço válido para o cliente selecionado.")
                  : "Indisponível"}
          </p>
        )}
      </div>
    </article>
  );
}

/** Memoizado: o grid virtualizado remonta linhas com frequência ao rolar. */
export const ProductCard = memo(ProductCardComponent);
