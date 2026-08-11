import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Minus, Plus } from "lucide-react";
import { productImage } from "@/lib/product-images";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho do pedido — MR Força de Vendas" },
      {
        name: "description",
        content: "Itens do pedido em montagem, sempre com o cliente atendido, tabela e condição visíveis.",
      },
      { property: "og:title", content: "Carrinho do pedido — MR Força de Vendas" },
      { property: "og:description", content: "Revise os itens antes do checkout comercial." },
    ],
  }),
  component: Carrinho,
});

function Carrinho() {
  const { customer, table, lines, subtotal, setQuantity, removeItem, clearCart, hydrated } = useSales();

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="mx-auto w-full max-w-xl surface-card p-10 text-center">
        <h1 className="text-2xl font-bold">Nenhum cliente em atendimento</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Escolha o cliente na sua carteira para montar o pedido.
        </p>
        <Button asChild className="mt-6 rounded-xl bg-brand-gradient">
          <Link to="/carteira">Abrir minha carteira</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Carrinho</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Comprando para: <strong className="text-foreground">{customer.tradeName}</strong> ·{" "}
          {table ? `Tabela ${table.code}` : "sem tabela"} · {table?.levelLabel ?? "nível pendente"} ·{" "}
          {customer.paymentTerm}
        </p>
      </header>

      {lines.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to="/catalogo">Ir para o catálogo</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.product.id} className="surface-card grid gap-3 p-4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center">
                <div className="hidden h-16 w-16 overflow-hidden rounded-xl bg-muted sm:block">
                  {productImage(line.product.imageUrl) && (
                    <img
                      src={productImage(line.product.imageUrl) ?? ""}
                      alt={line.product.name}
                      loading="lazy"
                      width={800}
                      height={800}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{line.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.product.erpCode} ·{" "}
                    {line.unitPrice !== null ? `${formatBRL(line.unitPrice)} / un.` : line.priceError}
                  </p>
                  {line.quantity > line.product.stock && (
                    <p className="mt-1 text-xs text-warning">
                      Estoque insuficiente ({line.product.stock} disponíveis) — exceção comercial.
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex items-center rounded-xl border border-border">
                    <button
                      className="grid h-9 w-9 place-items-center text-muted-foreground"
                      onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      className="grid h-9 w-9 place-items-center text-muted-foreground"
                      onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-24 text-right text-sm font-semibold">
                    {formatBRL(line.lineTotal)}
                  </span>
                  <button
                    onClick={() => removeItem(line.product.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="surface-card sticky bottom-20 space-y-3 p-5 lg:bottom-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-lg font-bold">{formatBRL(subtotal)}</span>
            </div>
            <Button asChild className="w-full rounded-xl bg-brand-gradient shadow-lift" size="lg">
              <Link to="/pedido/revisar">Revisar pedido</Link>
            </Button>
            <button
              onClick={clearCart}
              className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Esvaziar carrinho
            </button>
          </div>
        </>
      )}
    </div>
  );
}
