import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { integrationLabel, statusLabel, statusTone } from "@/lib/orders/status";
import { decideOrder } from "@/lib/orders.functions";
import type { Order } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsApprover } from "@/components/use-is-approver";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — MR Força de Vendas" },
      {
        name: "description",
        content: "Acompanhe seus pedidos por status comercial e status de integração com o ERP.",
      },
      { property: "og:title", content: "Meus pedidos — MR Força de Vendas" },
      { property: "og:description", content: "Histórico de pedidos da sua carteira." },
    ],
  }),
  component: Pedidos,
});

function Pedidos() {
  const { orders, hydrated } = useSales();
  const { data: isApprover } = useIsApprover();
  const queryClient = useQueryClient();
  const decide = useServerFn(decideOrder);
  const [decisionDraft, setDecisionDraft] = useState<{
    orderId: string;
    decision: "reject" | "changes";
    reason: string;
  } | null>(null);

  const decisionMutation = useMutation({
    mutationFn: (input: { orderId: string; decision: "approve" | "reject" | "changes"; reason: string }) =>
      decide({ data: input }),
    onSuccess: async (_res, input) => {
      setDecisionDraft(null);
      toast.success(
        input.decision === "approve"
          ? "Pedido aprovado."
          : input.decision === "reject"
            ? "Pedido reprovado."
            : "Pedido devolvido para correção.",
      );
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["team-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitDecision = (orderId: string, decision: "approve" | "reject" | "changes", reason = "") => {
    if (decisionMutation.isPending) return;
    decisionMutation.mutate({ orderId, decision, reason: reason.trim() });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Meus pedidos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Status comercial e status de integração são independentes.
        </p>
      </header>

      {!hydrated ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não gerou pedidos.</p>
          <Button asChild className="mt-5 rounded-xl bg-brand-gradient">
            <Link to="/carteira">Criar primeiro pedido</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              canDecide={Boolean(isApprover) && o.status === "pending_approval"}
              decisionDraft={decisionDraft?.orderId === o.id ? decisionDraft : null}
              isDeciding={decisionMutation.isPending && decisionMutation.variables?.orderId === o.id}
              onApprove={() => submitDecision(o.id, "approve")}
              onOpenDecision={(decision) => setDecisionDraft({ orderId: o.id, decision, reason: "" })}
              onChangeReason={(reason) =>
                setDecisionDraft((draft) => (draft?.orderId === o.id ? { ...draft, reason } : draft))
              }
              onCancelDecision={() => setDecisionDraft(null)}
              onSubmitDecision={() => {
                if (!decisionDraft || decisionDraft.orderId !== o.id) return;
                submitDecision(o.id, decisionDraft.decision, decisionDraft.reason);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({
  order,
  canDecide,
  decisionDraft,
  isDeciding,
  onApprove,
  onOpenDecision,
  onChangeReason,
  onCancelDecision,
  onSubmitDecision,
}: {
  order: Order;
  canDecide: boolean;
  decisionDraft: { orderId: string; decision: "reject" | "changes"; reason: string } | null;
  isDeciding: boolean;
  onApprove: () => void;
  onOpenDecision: (decision: "reject" | "changes") => void;
  onChangeReason: (reason: string) => void;
  onCancelDecision: () => void;
  onSubmitDecision: () => void;
}) {
  const draftKind = decisionDraft?.decision;

  return (
    <li>
      <article className="surface-card overflow-hidden transition-shadow hover:shadow-lift">
        <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <Link
            to="/pedidos/$orderId"
            params={{ orderId: order.id }}
            className="min-w-0 rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{order.customerName}</p>
              <p className="text-xs text-muted-foreground">
                {order.number} · {formatDateTimeBR(order.createdAt)} · {order.items.length} itens
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${statusTone(order.status)}`}>
                  {statusLabel[order.status]}
                </span>
                <span className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {integrationLabel[order.integrationStatus]}
                </span>
                {order.requiredAuthority && order.status === "pending_approval" && (
                  <span className="rounded-lg border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                    Exige aprovação
                  </span>
                )}
              </div>
            </div>
          </Link>

          <div className="flex flex-col gap-3 md:items-end">
            <Link
              to="/pedidos/$orderId"
              params={{ orderId: order.id }}
              className="shrink-0 rounded-xl text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:text-right"
            >
              <span className="block font-bold">{formatBRL(order.total)}</span>
              {(order.commissionTotal ?? 0) > 0 && (
                <span className="block text-xs font-semibold text-primary">
                  Comissão {formatBRL(order.commissionTotal)}
                </span>
              )}
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                Abrir <ExternalLink className="h-3 w-3" />
              </span>
            </Link>

            {canDecide && (
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={isDeciding}
                  onClick={onApprove}
                  className="rounded-xl border-0 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                >
                  {isDeciding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                  Aprovar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isDeciding}
                  onClick={() => onOpenDecision("reject")}
                  className="rounded-xl border-0 bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Negar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isDeciding}
                  onClick={() => onOpenDecision("changes")}
                  className="rounded-xl border-0 bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Devolver
                </Button>
              </div>
            )}
          </div>
        </div>

        {decisionDraft && (
          <div
            className={cn(
              "border-t p-4",
              draftKind === "reject"
                ? "border-rose-200 bg-rose-50 text-rose-950"
                : "border-amber-200 bg-amber-50 text-amber-950",
            )}
          >
            <label className="block text-sm font-semibold">
              {draftKind === "reject" ? "Motivo para negar o pedido" : "Orientação para devolver ao vendedor"}
              <Textarea
                value={decisionDraft.reason}
                onChange={(event) => onChangeReason(event.target.value)}
                rows={3}
                placeholder={
                  draftKind === "reject"
                    ? "Ex.: limite comercial incompatível, cliente com restrição..."
                    : "Ex.: ajustar condição, remover desconto, revisar itens..."
                }
                className="mt-2 border-white/70 bg-white text-foreground"
              />
            </label>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                disabled={isDeciding}
                onClick={onCancelDecision}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isDeciding}
                onClick={onSubmitDecision}
                className={cn(
                  "rounded-xl border-0 text-white",
                  draftKind === "reject" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-500 hover:bg-amber-600",
                )}
              >
                {isDeciding && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {draftKind === "reject" ? "Confirmar negativa" : "Confirmar devolução"}
              </Button>
            </div>
          </div>
        )}
      </article>
    </li>
  );
}
