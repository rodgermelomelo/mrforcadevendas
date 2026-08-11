import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, Gift, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL } from "@/lib/pricing";
import { authorityLabel, validateOrder } from "@/lib/orders/validation";
import type { Order } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pedido/revisar")({
  head: () => ({
    meta: [
      { title: "Revisar pedido — MR Força de Vendas" },
      {
        name: "description",
        content:
          "Checkout comercial com descontos por item e por pedido, bonificação, exceções e roteamento de aprovação.",
      },
      { property: "og:title", content: "Revisar pedido — MR Força de Vendas" },
      { property: "og:description", content: "Valide o pedido antes de gerar ou solicitar aprovação." },
    ],
  }),
  component: RevisarPedido,
});

function contentHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return `sha-demo-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

function RevisarPedido() {
  const sales = useSales();
  const {
    customer, table, lines, subtotal, discountValue, total, orderDiscountPercent,
    isBonus, notes, paymentTerm, setItemDiscount, setOrderDiscount, setBonus, setNotes,
    sellerName, saveOrder, orders,
  } = sales;
  const navigate = useNavigate();

  const nonStandardTerms = Boolean(
    customer && paymentTerm && paymentTerm !== customer.paymentTerm,
  );

  const validation = useMemo(
    () =>
      validateOrder({
        customer,
        table,
        lines: lines.map((l) => ({
          product: l.product,
          quantity: l.quantity,
          discountPercent: l.discountPercent,
          unitPrice: l.unitPrice,
          priceError: l.priceError,
        })),
        orderDiscountPercent,
        isBonus,
        nonStandardTerms,
        subtotal,
        total,
      }),
    [customer, table, lines, orderDiscountPercent, isBonus, nonStandardTerms, subtotal, total],
  );

  if (!customer || lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl surface-card p-10 text-center">
        <h1 className="text-2xl font-bold">Nada para revisar</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Escolha um cliente e adicione produtos para montar o pedido.
        </p>
        <Button asChild className="mt-6 rounded-xl bg-brand-gradient">
          <Link to="/carteira">Começar pela carteira</Link>
        </Button>
      </div>
    );
  }

  const hasExceptions = validation.exceptions.length > 0;
  const hasErrors = validation.errors.length > 0;

  const submit = async () => {
    if (hasErrors) {
      toast.error("Corrija os erros obrigatórios — o pedido permanece em rascunho.");
      return;
    }
    const items = lines.map((l) => ({
      productId: l.product.id,
      erpCode: l.product.erpCode,
      name: l.product.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice ?? 0,
      discountPercent: l.discountPercent,
      total: l.lineTotal,
    }));
    try {
      const order = await sales.submitOrder({
        customerErpCode: customer.erpCode,
        priceTableCode: table?.code ?? "—",
        priceLevelLabel: table?.levelLabel ?? "—",
        paymentTerm: paymentTerm ?? customer.paymentTerm,
        items,
        subtotal,
        discountTotal: discountValue,
        total,
        orderDiscountPercent,
        isBonus,
        notes,
        exceptions: validation.exceptions,
        requiredAuthority: validation.requiredAuthority,
      });
      toast.success(hasExceptions ? "Aprovação solicitada" : "Pedido confirmado");
      void navigate({ to: "/pedidos/$orderId", params: { orderId: order.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o pedido.");
    }
  };


  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Revisar pedido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Comprando para: <strong className="text-foreground">{customer.tradeName}</strong> ·{" "}
          Tabela {table?.code ?? "—"} · {table?.levelLabel ?? "nível pendente"} ·{" "}
          {paymentTerm ?? customer.paymentTerm} · Vendedor {sellerName}
        </p>
      </header>

      {hasErrors && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Erros obrigatórios — pedido fica em rascunho
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {validation.errors.map((e, i) => (
              <li key={i}>
                <strong>{e.label}:</strong> {e.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <section className="space-y-3">
          {lines.map((line) => (
            <article key={line.product.id} className="surface-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{line.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {line.product.erpCode} · {line.quantity} un. ×{" "}
                  {line.unitPrice !== null ? formatBRL(line.unitPrice) : "sem preço"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Desc. %
                  <Input
                    value={line.discountPercent}
                    onChange={(e) =>
                      setItemDiscount(line.product.id, Number(e.target.value.replace(/[^\d.]/g, "")) || 0)
                    }
                    inputMode="decimal"
                    className="h-9 w-16 rounded-lg text-center"
                  />
                </label>
                <span className="w-24 text-right text-sm font-semibold">
                  {formatBRL(line.lineTotal)}
                </span>
              </div>
            </article>
          ))}

          <div className="surface-card space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-muted-foreground">Desconto total do pedido (%)</span>
                <Input
                  value={orderDiscountPercent}
                  onChange={(e) => setOrderDiscount(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
                  inputMode="decimal"
                  className="mt-1 h-11 rounded-xl"
                />
              </label>
              <div className="text-sm">
                <span className="text-muted-foreground">Bonificação</span>
                <Button
                  type="button"
                  variant={isBonus ? "default" : "outline"}
                  onClick={() => setBonus(!isBonus)}
                  className={cn("mt-1 h-11 w-full rounded-xl", isBonus && "bg-brand-gradient")}
                >
                  <Gift className="mr-1 h-4 w-4" />
                  {isBonus ? "Pedido marcado como bonificação" : "Marcar como bonificação"}
                </Button>
              </div>
            </div>
            <label className="block text-sm">
              <span className="text-muted-foreground">Observações</span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Informações para a análise interna"
                className="mt-1 rounded-xl"
              />
            </label>
          </div>
        </section>

        <aside className="surface-card sticky top-4 space-y-4 p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatBRL(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Descontos</dt>
              <dd className="text-destructive">-{formatBRL(discountValue)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatBRL(total)}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-border p-3">
            {hasExceptions ? (
              <>
                <p className="flex items-center gap-2 text-xs font-semibold text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> Exceções comerciais detectadas
                </p>
                <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
                  {validation.exceptions.map((e, i) => (
                    <li key={i}>
                      <strong className="text-foreground">{e.label}</strong> — {e.detail}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Encaminhamento direto para:{" "}
                  <strong className="text-foreground">
                    {authorityLabel[validation.requiredAuthority ?? "gerente_comercial"]}
                  </strong>
                </p>
              </>
            ) : (
              <p className="flex items-center gap-2 text-xs font-medium text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> Pedido no padrão — será auto-aprovado e
                confirmado.
              </p>
            )}
          </div>

          <Button
            size="lg"
            onClick={submit}
            disabled={hasErrors}
            className={cn("w-full rounded-xl shadow-lift", !hasExceptions && "bg-brand-gradient")}
            variant={hasExceptions ? "default" : "default"}
          >
            {hasExceptions ? "Solicitar aprovação" : "Gerar pedido"}
          </Button>
          {hasExceptions && (
            <p className="text-center text-[11px] text-muted-foreground">
              Irá para {authorityLabel[validation.requiredAuthority ?? "gerente_comercial"]}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
