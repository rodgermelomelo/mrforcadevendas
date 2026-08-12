import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ban, CheckCircle2, ExternalLink, Loader2, RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { integrationLabel, statusLabel, statusTone } from "@/lib/orders/status";
import { cancelOrder, decideOrder, deleteOrder } from "@/lib/orders.functions";
import type { Order } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsApprover } from "@/components/use-is-approver";
import { cn } from "@/lib/utils";

type OrderActionDraft = {
  orderId: string;
  action: "reject" | "changes" | "cancel" | "delete";
  reason: string;
};

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
  const { orders, hydrated, role } = useSales();
  const { data: isApprover } = useIsApprover();
  const queryClient = useQueryClient();
  const decide = useServerFn(decideOrder);
  const cancel = useServerFn(cancelOrder);
  const remove = useServerFn(deleteOrder);
  const [actionDraft, setActionDraft] = useState<OrderActionDraft | null>(null);
  const isAdmin = role === "administrador";

  const decisionMutation = useMutation({
    mutationFn: (input: { orderId: string; decision: "approve" | "reject" | "changes"; reason: string }) =>
      decide({ data: input }),
    onSuccess: async (_res, input) => {
      setActionDraft(null);
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

  const cancelMutation = useMutation({
    mutationFn: (input: { orderId: string; reason: string }) => cancel({ data: input }),
    onSuccess: async () => {
      setActionDraft(null);
      toast.success("Pedido cancelado.");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["team-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { orderId: string }) => remove({ data: input }),
    onSuccess: async () => {
      setActionDraft(null);
      toast.success("Pedido apagado.");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["team-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitDecision = (orderId: string, decision: "approve" | "reject" | "changes", reason = "") => {
    if (decisionMutation.isPending) return;
    decisionMutation.mutate({ orderId, decision, reason: reason.trim() });
  };

  const submitAction = (draft: OrderActionDraft | null) => {
    if (!draft || decisionMutation.isPending || cancelMutation.isPending || deleteMutation.isPending) return;
    if (draft.action === "reject" || draft.action === "changes") {
      submitDecision(draft.orderId, draft.action, draft.reason);
      return;
    }
    if (draft.action === "cancel") {
      cancelMutation.mutate({ orderId: draft.orderId, reason: draft.reason.trim() });
      return;
    }
    deleteMutation.mutate({ orderId: draft.orderId });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Meus pedidos</h1>
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
              canCancel={
                Boolean(isApprover) &&
                !["pending_approval", "rejected", "cancelled"].includes(o.status)
              }
              canDelete={isAdmin}
              actionDraft={actionDraft?.orderId === o.id ? actionDraft : null}
              isProcessing={
                (decisionMutation.isPending && decisionMutation.variables?.orderId === o.id) ||
                (cancelMutation.isPending && cancelMutation.variables?.orderId === o.id) ||
                (deleteMutation.isPending && deleteMutation.variables?.orderId === o.id)
              }
              onApprove={() => submitDecision(o.id, "approve")}
              onOpenAction={(action) => setActionDraft({ orderId: o.id, action, reason: "" })}
              onChangeReason={(reason) =>
                setActionDraft((draft) => (draft?.orderId === o.id ? { ...draft, reason } : draft))
              }
              onCancelAction={() => setActionDraft(null)}
              onSubmitAction={() => submitAction(actionDraft?.orderId === o.id ? actionDraft : null)}
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
  canCancel,
  canDelete,
  actionDraft,
  isProcessing,
  onApprove,
  onOpenAction,
  onChangeReason,
  onCancelAction,
  onSubmitAction,
}: {
  order: Order;
  canDecide: boolean;
  canCancel: boolean;
  canDelete: boolean;
  actionDraft: OrderActionDraft | null;
  isProcessing: boolean;
  onApprove: () => void;
  onOpenAction: (action: OrderActionDraft["action"]) => void;
  onChangeReason: (reason: string) => void;
  onCancelAction: () => void;
  onSubmitAction: () => void;
}) {
  const draftKind = actionDraft?.action;
  const needsReason = draftKind === "reject" || draftKind === "changes" || draftKind === "cancel";

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
              <div className="space-y-1 md:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Decisão de aprovação
                </p>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isProcessing}
                    onClick={onApprove}
                    className="rounded-xl border-0 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                    )}
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => onOpenAction("reject")}
                    className="rounded-xl border-0 bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Reprovar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => onOpenAction("changes")}
                    className="rounded-xl border-0 bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Devolver
                  </Button>
                </div>
              </div>
            )}

            {(canCancel || canDelete) && (
              <div className="space-y-1 md:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gestão do pedido
                </p>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {canCancel && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => onOpenAction("cancel")}
                      className="rounded-xl border-0 bg-slate-700 text-white shadow-sm hover:bg-slate-800"
                    >
                      <Ban className="mr-1 h-4 w-4" />
                      Cancelar pedido
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => onOpenAction("delete")}
                      className="rounded-xl border-0 bg-zinc-950 text-white shadow-sm hover:bg-black"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Apagar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {actionDraft && (
          <div
            className={cn(
              "border-t p-4",
              draftKind === "reject"
                ? "border-rose-200 bg-rose-50 text-rose-950"
                : draftKind === "changes"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : draftKind === "cancel"
                    ? "border-sky-200 bg-sky-50 text-sky-950"
                    : "border-zinc-300 bg-zinc-100 text-zinc-950",
            )}
          >
            {needsReason ? (
              <label className="block text-sm font-semibold">
                {draftKind === "reject"
                  ? "Motivo para reprovar a aprovação"
                  : draftKind === "changes"
                    ? "Orientação para devolver ao vendedor"
                    : "Motivo do cancelamento"}
                <Textarea
                  value={actionDraft.reason}
                  onChange={(event) => onChangeReason(event.target.value)}
                  rows={3}
                  placeholder={
                    draftKind === "reject"
                      ? "Ex.: limite comercial incompatível, cliente com restrição..."
                      : draftKind === "changes"
                        ? "Ex.: ajustar condição, remover desconto, revisar itens..."
                        : "Ex.: cliente desistiu, pedido lançado por engano..."
                  }
                  className="mt-2 border-white/70 bg-white text-foreground"
                />
              </label>
            ) : (
              <div>
                <p className="text-sm font-semibold">Apagar pedido definitivamente?</p>
                <p className="mt-1 text-xs">
                  Esta ação remove o pedido, itens, exceções e histórico relacionado. Use apenas para limpeza administrativa.
                </p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                disabled={isProcessing}
                onClick={onCancelAction}
              >
                Voltar
              </Button>
              <Button
                type="button"
                disabled={isProcessing}
                onClick={onSubmitAction}
                className={cn(
                  "rounded-xl border-0 text-white",
                  draftKind === "reject"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : draftKind === "changes"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : draftKind === "cancel"
                        ? "bg-sky-600 hover:bg-sky-700"
                        : "bg-zinc-900 hover:bg-black",
                )}
              >
                {isProcessing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {draftKind === "reject"
                  ? "Confirmar reprovação"
                  : draftKind === "changes"
                    ? "Confirmar devolução"
                    : draftKind === "cancel"
                      ? "Confirmar cancelamento"
                      : "Apagar definitivamente"}
              </Button>
            </div>
          </div>
        )}
      </article>
    </li>
  );
}
