import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ProductCard } from "@/features/catalog/product-card";
import { ProductCardSkeleton } from "@/features/catalog/product-card-skeleton";
import type { Product } from "@/lib/domain/types";

export interface VirtualizedProductGridProps {
  products: Product[];
  hasCustomer: boolean;
  loadingMore?: boolean;
  onAdd: (product: Product, qty: number) => void;
  onOpenDetail: (product: Product) => void;
  /** Disparado quando as últimas linhas entram na janela de renderização. */
  onEndReached?: () => void;
}

/** Colunas equivalentes ao grid original (2 / 3 / 4 / 5). */
function columnsForWidth(width: number) {
  if (width >= 1280) return 5;
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

/** Altura estimada de um card — com cliente o card ganha stepper e botão. */
function estimateRowHeight(hasCustomer: boolean, columns: number) {
  const base = columns <= 2 ? 300 : 340;
  return hasCustomer ? base + 110 : base;
}

/**
 * Grid virtualizado: só monta as linhas visíveis (mais overscan), mantendo a
 * altura total real para a barra de rolagem da janela continuar correta.
 */
export function VirtualizedProductGrid({
  products,
  hasCustomer,
  loadingMore = false,
  onAdd,
  onOpenDetail,
  onEndReached,
}: VirtualizedProductGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(2);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const sync = () => {
      setColumns(columnsForWidth(element.offsetWidth));
      setScrollMargin(element.getBoundingClientRect().top + window.scrollY);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  const rowCount = Math.ceil(products.length / columns);
  const gap = 16;

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: useCallback(() => estimateRowHeight(hasCustomer, columns) + gap, [hasCustomer, columns]),
    overscan: 4,
    scrollMargin,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const lastRenderedRow = virtualRows.length > 0 ? virtualRows[virtualRows.length - 1]!.index : 0;

  useEffect(() => {
    if (!onEndReached || loadingMore || rowCount === 0) return;
    if (lastRenderedRow >= rowCount - 2) onEndReached();
  }, [lastRenderedRow, rowCount, loadingMore, onEndReached]);

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualRows.map((virtualRow) => {
          const start = virtualRow.index * columns;
          const rowProducts = products.slice(start, start + columns);
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)` }}
            >
              <div
                className="grid gap-3 pb-4 sm:gap-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {rowProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    hasCustomer={hasCustomer}
                    onAdd={(qty) => onAdd(product, qty)}
                    onOpenDetail={() => onOpenDetail(product)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {loadingMore && (
        <div
          className="grid gap-3 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <ProductCardSkeleton key={`catalog-more-${index}`} />
          ))}
        </div>
      )}
    </div>
  );
}
