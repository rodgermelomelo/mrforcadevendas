import { useState } from "react";
import { AlertCircle, Building2, Package, ShoppingCart, Tag } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { formatBRL, resolvePrice } from "@/lib/pricing";
import { productImage } from "@/lib/product-images";
import { useSales } from "@/lib/state/sales-store";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/domain/types";

const DIALOG_QUANTITY_SHORTCUTS = [6, 12, 30, 60] as const;

export interface ProductQuickViewDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Visão rápida comercial do produto, aberta a partir do catálogo. */
export function ProductQuickViewDialog({
  product,
  open,
  onOpenChange,
}: ProductQuickViewDialogProps) {
  const { customer, table, addItem } = useSales();
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const price = resolvePrice(product, table);
  const outOfStock = product.stock <= 0;
  const hasCustomer = Boolean(customer);
  const blocked = hasCustomer && (outOfStock || !price.ok);
  const category = product.category || product.group;

  const handleAdd = () => {
    addItem(product.id, qty);
    toast.success(`${qty} un. de ${product.name} no carrinho`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl p-0">
        <div className="flex flex-col md:flex-row">
          <div className="relative aspect-square w-full bg-muted md:w-1/2">
            {productImage(product.imageUrl) ? (
              <img
                src={productImage(product.imageUrl) ?? ""}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center bg-brand-gradient p-8 text-center text-lg font-bold text-primary-foreground">
                {product.name}
              </div>
            )}
            {product.isLaunch && (
              <Badge className="absolute left-4 top-4 border-none bg-brand-gradient px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Lançamento
              </Badge>
            )}
          </div>

          <div className="flex flex-1 flex-col p-6 md:max-h-[600px] md:overflow-y-auto">
            <DialogHeader className="text-left">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge
                  variant="secondary"
                  className="border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary"
                >
                  <Building2 className="mr-1 h-3 w-3" /> {product.brand}
                </Badge>
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-bold uppercase">
                  <Tag className="mr-1 h-3 w-3" /> {category}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold leading-tight">{product.name}</DialogTitle>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                Código: {product.erpCode}
              </p>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-border/50 bg-muted/50 p-4">
                {!hasCustomer ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Preço sob consulta</p>
                    <p className="text-xs text-muted-foreground">
                      Selecione um cliente para visualizar o preço da tabela correspondente.
                    </p>
                  </div>
                ) : price.ok ? (
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Valor Unitário
                      </p>
                      <p className="text-3xl font-black tracking-tight text-foreground">
                        {formatBRL(price.value)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-primary">{price.levelLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Disponibilidade
                      </p>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 font-semibold",
                          outOfStock ? "text-destructive" : "text-success",
                        )}
                      >
                        <Package className="h-4 w-4" />
                        {product.stock} {product.unit}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm font-semibold">{price.message}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                  Detalhes
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Unidade</p>
                    <p className="font-semibold">{product.unit}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Grupo Comercial</p>
                    <p className="font-semibold">{product.group}</p>
                  </div>
                </div>
              </div>

              {hasCustomer && !blocked && (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">Quantidade</span>
                    <QuantityStepper value={qty} onChange={setQty} size="md" />
                  </div>

                  <div className="flex gap-2">
                    {DIALOG_QUANTITY_SHORTCUTS.map((n) => (
                      <Button
                        key={n}
                        variant="outline"
                        size="sm"
                        className="h-10 flex-1 rounded-xl border-border/50 font-bold transition-all hover:border-primary hover:bg-primary/5"
                        onClick={() => setQty(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>

                  <Button
                    className="h-12 w-full rounded-xl bg-brand-gradient text-lg font-bold shadow-lift"
                    onClick={handleAdd}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" /> Adicionar ao Pedido
                  </Button>
                </div>
              )}

              {hasCustomer && blocked && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center">
                  <p className="text-sm font-bold text-destructive">
                    {outOfStock
                      ? "Este produto está sem saldo em estoque e não pode ser adicionado ao pedido."
                      : "Tabela de preço do cliente sem nível configurado para este item."}
                  </p>
                </div>
              )}

              {!hasCustomer && (
                <div className="rounded-xl border border-info/20 bg-info/10 p-4 text-center">
                  <p className="text-sm font-medium text-info">
                    Para visualizar preços e realizar pedidos, selecione um cliente na tela de
                    catálogo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
