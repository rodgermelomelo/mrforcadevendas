import { useState } from "react";
import {
  X,
  ShoppingCart,
  Package,
  Tag,
  Building2,
  Sparkles,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LayoutList,
} from "lucide-react";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, resolvePrice } from "@/lib/pricing";
import { resolveProductImage } from "@/lib/product-images";
import { useSales } from "@/lib/state/sales-store";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/domain/types";
import { toast } from "sonner";
import { canViewPriceTableDetails } from "@/lib/domain/roles";

interface ProductDetailDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailDialog({ product, open, onOpenChange }: ProductDetailDialogProps) {
  const { customer, table, addItem, role } = useSales();
  const [qty, setQty] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lastProductId, setLastProductId] = useState<string | null>(null);

  if (product && product.id !== lastProductId) {
    setLastProductId(product.id);
    setQty(1);
  }

  if (!product) return null;

  const price = resolvePrice(product, table);
  const outOfStock = product.stock <= 0;
  const hasCustomer = Boolean(customer);
  const showPriceTableDetails = canViewPriceTableDetails(role);
  const blocked = hasCustomer && (outOfStock || !price.ok);
  const maxQty = product.stock > 0 ? Math.floor(product.stock) : 1;
  const clamp = (n: number) => Math.min(maxQty, Math.max(1, n));
  const subtotal = price.ok ? price.value * qty : 0;
  const image = resolveProductImage(product);

  const handleAdd = () => {
    const result = addItem(product.id, qty);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`${qty} un. de ${product.name} no carrinho`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-6xl overflow-hidden rounded-2xl p-0 sm:w-[calc(100vw-2rem)]">
        <div className="grid max-h-[calc(100vh-1rem)] grid-cols-1 overflow-y-auto md:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1fr)] md:overflow-hidden">
          {/* Imagem e Galeria */}
          <div className="relative flex min-h-[420px] flex-col bg-muted md:h-[calc(100vh-2rem)] md:max-h-[760px] md:min-h-0">
            <div className="relative min-h-0 flex-1 bg-muted">
              {image ? (
                <img src={image} alt={product.name} className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full place-items-center bg-brand-gradient p-8 text-center text-lg font-bold text-primary-foreground">
                  {product.name}
                </div>
              )}
              {product.isLaunch && (
                <Badge className="absolute left-4 top-4 bg-brand-gradient px-3 py-1 text-xs font-bold uppercase tracking-wider text-white border-none z-10">
                  Lançamento
                </Badge>
              )}

              {/* Navegação da Galeria (Simulada com a mesma imagem para demonstração de UI) */}
              <div className="absolute inset-y-0 left-0 flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/40 ml-2"
                  onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? 2 : prev - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/40 mr-2"
                  onClick={() => setCurrentImageIndex((prev) => (prev === 2 ? 0 : prev + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Miniaturas da Galeria */}
            <div className="flex shrink-0 gap-2 border-t border-border/50 bg-white/50 p-3 backdrop-blur-sm">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={cn(
                    "relative h-12 w-12 rounded-lg overflow-hidden border-2 transition-all",
                    currentImageIndex === i
                      ? "border-primary shadow-sm"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={`${product.name} thumbnail ${i}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-brand-gradient flex items-center justify-center text-[10px] font-bold text-white">
                      {i + 1}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo */}
          <div className="min-w-0 p-5 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto lg:p-7">
            <DialogHeader className="text-left">
              <div className="mb-2 flex flex-wrap gap-2 pr-10">
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-bold px-2 py-0.5"
                >
                  <Building2 className="mr-1 h-3 w-3" /> {product.brand}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5">
                  <Tag className="mr-1 h-3 w-3" /> {product.category || product.group}
                </Badge>
                {(() => {
                  const raw = `${product.category ?? ""} ${product.brand ?? ""}`.toUpperCase();
                  const TAGGED = [
                    "AMACIANTE", "AMOLECEDOR", "GOTA", "MANTEIGA", "OLEO", "SECANTE", "SOLUCAO", "TOALHA",
                    "SOBRANCELHA", "SKINCARE", "SKIN", "EFEITO",
                  ];
                  const match = TAGGED.find((t) => raw.includes(t));
                  return match ? (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20 text-[10px] uppercase font-bold px-2 py-0.5">
                      TAG {match}
                    </Badge>
                  ) : null;
                })()}
              </div>
              <DialogTitle className="min-w-0 break-words pr-10 text-2xl font-bold leading-tight">
                {product.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                Código: {product.erpCode}
              </p>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              {/* Preço e Estoque */}
              <div className="rounded-2xl border border-border/50 bg-muted/50 p-4">
                {!hasCustomer ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Preço sob consulta
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Selecione um cliente para visualizar o preço aplicável.
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Disponibilidade
                      </p>
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 font-semibold",
                          outOfStock ? "text-destructive" : "text-success",
                        )}
                      >
                        <Package className="h-4 w-4" />
                        {product.stock.toLocaleString("pt-BR")} {product.unit}
                      </div>
                    </div>
                  </div>
                ) : price.ok ? (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Valor Unitário
                      </p>
                      <p className="text-3xl font-black tracking-tight text-foreground">
                        {formatBRL(price.value)}
                      </p>
                      {showPriceTableDetails && (
                        <p className="text-xs font-medium text-primary mt-1">{price.levelLabel}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Disponibilidade
                      </p>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 font-semibold",
                          outOfStock ? "text-destructive" : "text-success",
                        )}
                      >
                        <Package className="h-4 w-4" />
                        {product.stock.toLocaleString("pt-BR")} {product.unit}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-start gap-2 text-warning">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <p className="min-w-0 break-words text-sm font-semibold">
                        {showPriceTableDetails
                          ? price.message
                          : "Preço pendente para este cliente."}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Disponibilidade
                      </p>
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 font-semibold",
                          outOfStock ? "text-destructive" : "text-success",
                        )}
                      >
                        <Package className="h-4 w-4" />
                        {product.stock.toLocaleString("pt-BR")} {product.unit}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Informações Adicionais */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                  Detalhes
                </h4>
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Unidade</p>
                    <p className="font-semibold">{product.unit}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-muted-foreground">Grupo Comercial</p>
                    <p className="break-words font-semibold">{product.group}</p>
                  </div>
                </div>
              </div>

              {/* Ações */}
              {hasCustomer && !blocked && (
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-bold">Quantidade</span>
                      <p className="text-xs text-muted-foreground">
                        Máximo disponível: {maxQty} un.
                      </p>
                    </div>
                    <QuantityStepper value={qty} onChange={(n) => setQty(clamp(n))} size="md" />
                  </div>

                  <div className="flex gap-2">
                    {[6, 12, 30, 60].map((n) => (
                      <Button
                        key={n}
                        variant="outline"
                        size="sm"
                        disabled={n > maxQty}
                        className={cn(
                          "flex-1 rounded-xl h-10 font-bold border-border/50 transition-all hover:border-primary hover:bg-primary/5",
                          qty === n && "border-primary bg-primary/10 text-primary",
                        )}
                        onClick={() => setQty(clamp(n))}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subtotal ({qty} un.)
                    </span>
                    <span className="text-lg font-bold">{formatBRL(subtotal)}</span>
                  </div>

                  <Button
                    className="w-full h-12 rounded-xl bg-brand-gradient text-lg font-bold shadow-lift"
                    onClick={handleAdd}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" /> Adicionar {qty} ao Pedido
                  </Button>
                </div>
              )}

              {hasCustomer && blocked && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-center">
                  <p className="text-sm font-bold text-destructive">
                    {customer?.restricted
                      ? `Indisponível: ${customer?.restrictionReason || "Cliente com restrição comercial ativa no sistema."}`
                      : outOfStock
                        ? "Este produto está sem saldo em estoque e não pode ser adicionado ao pedido."
                      : !price.ok
                        ? (showPriceTableDetails ? price.message : "Preço pendente para este cliente.")
                        : ""}
                  </p>
                </div>
              )}

              {/* Tabela de Preços por Nível */}
              {hasCustomer && showPriceTableDetails && (
                <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <LayoutList className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Tabela de Preços ({customer?.priceTableCode})
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((level, idx) => {
                      const levelValue = product.prices[customer?.priceTableCode || ""]?.[idx];
                      const isCurrent = table?.mappedLevel === idx;

                      return (
                        <div
                          key={level}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all",
                            isCurrent
                              ? "border-primary bg-primary/5 font-bold"
                              : "border-border/40 bg-white/50",
                          )}
                        >
                          <span
                            className={cn(isCurrent ? "text-primary" : "text-muted-foreground")}
                          >
                            Nível {level}
                          </span>
                          <span className={cn(isCurrent ? "text-primary" : "font-medium")}>
                            {levelValue ? formatBRL(levelValue) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!hasCustomer && (
                <div className="rounded-xl bg-info/10 border border-info/20 p-4 text-center">
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
