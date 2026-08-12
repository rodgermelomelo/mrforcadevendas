import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Hash,
  PackageCheck,
  ReceiptText,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useSales } from "@/lib/state/sales-store";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { integrationLabel, statusLabel, statusTone } from "@/lib/orders/status";
import { authorityLabel } from "@/lib/orders/validation";
import { Button } from "@/components/ui/button";
import { canViewPriceTableDetails } from "@/lib/domain/roles";
import { cn } from "@/lib/utils";

type OrderDataTone = "muted" | "primary" | "warning" | "success" | "info";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId")({
  head: () => ({
    meta: [
      { title: "Detalhe do pedido — MR Força de Vendas" },
      {
        name: "description",
        content: "Snapshot do pedido: itens, exceções comerciais, aprovação e histórico.",
      },
      { property: "og:title", content: "Detalhe do pedido — MR Força de Vendas" },
      { property: "og:description", content: "Histórico e snapshot imutável do pedido." },
    ],
  }),
  component: DetalhePedido,
});

function DetalhePedido() {
  const { orderId } = Route.useParams();
  const { orders, hydrated, role } = useSales();
  const order = orders.find((o) => o.id === orderId);
  const showPriceTableDetails = canViewPriceTableDetails(role);

  if (!hydrated) {
    return <div className="mx-auto h-64 w-full max-w-3xl animate-pulse rounded-xl bg-muted" />;
  }

  if (!order) {
    return (
      <div className="mx-auto w-full max-w-xl surface-card p-10 text-center">
        <h1 className="text-2xl font-bold">Pedido não encontrado</h1>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/pedidos">Voltar para meus pedidos</Link>
        </Button>
      </div>
    );
  }

  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const invoiceTone: OrderDataTone =
    order.integrationStatus === "accepted_by_erp"
      ? "success"
      : order.integrationStatus === "integration_error"
        ? "warning"
        : "primary";
  const invoiceStatus =
    order.integrationStatus === "accepted_by_erp"
      ? "ERP aceitou"
      : order.integrationStatus === "sending"
        ? "Enviando"
        : order.integrationStatus === "integration_error"
          ? "Revisar ERP"
          : "Aguardando ERP";
  const billingTone: OrderDataTone = order.status === "cancelled" ? "muted" : "warning";
  const deliveryTone: OrderDataTone =
    order.integrationStatus === "accepted_by_erp" ? "info" : "muted";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold sm:text-4xl">{order.number}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{order.customerName}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              {formatDateTimeBR(order.createdAt)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <span
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
              statusTone(order.status),
            )}
          >
            {statusLabel[order.status]}
          </span>
          <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            {integrationLabel[order.integrationStatus]}
          </span>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="surface-card p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Resumo do pedido</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Snapshot comercial, aprovação e dados base para faturamento.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <Info
              icon={<UserRound className="h-4 w-4" />}
              label="Vendedor"
              value={order.sellerName}
            />
            {showPriceTableDetails && (
              <Info
                label="Tabela / nível"
                value={`${order.priceTableCode} · ${order.priceLevelLabel}`}
              />
            )}
            <Info label="Condição" value={order.paymentTerm} />
            <Info label="Bonificação" value={order.isBonus ? "Sim" : "Não"} />
            <Info
              icon={<PackageCheck className="h-4 w-4" />}
              label="Linhas / unidades"
              value={`${order.items.length} itens · ${totalUnits} un.`}
            />
            <Info
              icon={<Hash className="h-4 w-4" />}
              label="Hash do conteúdo"
              value={order.contentHash}
              valueClassName="break-all font-mono text-xs"
            />
          </div>
        </div>

        <aside className="surface-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success">
              <WalletCards className="h-5 w-5" />
            </span>
            <h2 className="text-sm font-semibold uppercase">Valores</h2>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <AmountRow label="Subtotal" value={formatBRL(order.subtotal)} />
            <AmountRow
              label="Descontos"
              value={`-${formatBRL(order.discountTotal)}`}
              valueClassName="text-destructive"
            />
            <div className="border-t border-border pt-3">
              <AmountRow
                label="Total"
                value={formatBRL(order.total)}
                labelClassName="text-base font-bold text-foreground"
                valueClassName="text-xl font-bold"
              />
            </div>
            <AmountRow
              label="Comissão calculada"
              value={formatBRL(order.commissionTotal)}
              labelClassName="font-semibold text-primary"
              valueClassName="font-bold text-primary"
            />
          </dl>
        </aside>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Dados do pedido</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Documentos, cobrança e logística para a próxima etapa operacional.
            </p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Preparado para ERP e Foxy Entregas
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <OrderDataCard
            icon={<FileText className="h-5 w-5" />}
            title="Nota fiscal"
            status={invoiceStatus}
            tone={invoiceTone}
            lines={[
              { label: "Número", value: "Não emitida" },
              { label: "DANFE / XML", value: "Aguardando vínculo" },
              { label: "Base", value: `${order.number} · ${formatBRL(order.total)}` },
            ]}
          />
          <OrderDataCard
            icon={<ReceiptText className="h-5 w-5" />}
            title="Boletos"
            status={order.status === "cancelled" ? "Cancelado" : "A gerar"}
            tone={billingTone}
            lines={[
              { label: "Condição", value: order.paymentTerm || "A definir" },
              { label: "Vencimentos", value: "Não gerados" },
              { label: "Cobrança", value: "Após faturamento" },
            ]}
          />
          <OrderDataCard
            icon={<Truck className="h-5 w-5" />}
            title="Entrega / TMS"
            status={order.integrationStatus === "accepted_by_erp" ? "A expedir" : "Pendente"}
            tone={deliveryTone}
            lines={[
              { label: "Romaneio", value: "Não vinculado" },
              { label: "Transportadora", value: "Aguardando cotação" },
              { label: "Rastreio", value: "Pendente" },
            ]}
            footer="Foxy Entregas: notas, romaneios, transportadoras e rastreio."
          />
        </div>
      </section>

      <section className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Itens</h2>
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {order.items.length} linhas · {totalUnits} unidades
          </span>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {order.items.map((i) => (
            <li key={i.productId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm">{i.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.erpCode} · {i.quantity} un. × {formatBRL(i.unitPrice)}
                  {i.discountPercent > 0 ? ` · -${i.discountPercent}%` : ""}
                </span>
                {(i.commissionValue ?? 0) > 0 && (
                  <span className="mt-1 block text-xs text-primary">
                    Comissão {i.commissionPercent?.toLocaleString("pt-BR")}% ·{" "}
                    {formatBRL(i.commissionValue ?? 0)}
                    {i.commissionRuleName ? ` · ${i.commissionRuleName}` : ""}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-semibold">{formatBRL(i.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      {order.exceptions.length > 0 && (
        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">Exceções comerciais</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Autoridade responsável: {authorityLabel[order.requiredAuthority ?? "gerente_comercial"]}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {order.exceptions.map((e, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <p className="font-medium">{e.label}</p>
                <p className="text-xs text-muted-foreground">{e.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.notes && (
        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">Observações</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p>
        </section>
      )}

      <section className="surface-card p-5">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <ol className="mt-3 space-y-3">
          {order.history.map((h, i) => (
            <li key={i} className="border-l-2 border-primary/40 pl-3">
              <p className="text-sm font-medium">{h.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTimeBR(h.at)}
                {h.detail ? ` · ${h.detail}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon && <span className="text-primary">{icon}</span>}
        {label}
      </p>
      <p className={cn("mt-1 break-words font-semibold", valueClassName)}>{value}</p>
    </div>
  );
}

function AmountRow({
  label,
  value,
  labelClassName,
  valueClassName,
}: {
  label: string;
  value: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-muted-foreground", labelClassName)}>{label}</dt>
      <dd className={cn("text-right font-semibold tabular-nums", valueClassName)}>{value}</dd>
    </div>
  );
}

function OrderDataCard({
  icon,
  title,
  status,
  tone,
  lines,
  footer,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  tone: OrderDataTone;
  lines: { label: string; value: string }[];
  footer?: string;
}) {
  return (
    <article className="surface-card flex min-h-[230px] flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-10 w-10 place-items-center rounded-xl", dataToneIcon[tone])}>
            {icon}
          </span>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">Dados vinculáveis</p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            dataToneBadge[tone],
          )}
        >
          {status}
        </span>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="grid grid-cols-[108px_minmax(0,1fr)] gap-3">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="min-w-0 break-words font-semibold">{line.value}</dd>
          </div>
        ))}
      </dl>

      {footer && (
        <p className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground">
          {footer}
        </p>
      )}
    </article>
  );
}

const dataToneIcon: Record<OrderDataTone, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
};

const dataToneBadge: Record<OrderDataTone, string> = {
  muted: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
  warning: "border-warning/20 bg-warning/10 text-warning",
  success: "border-success/20 bg-success/10 text-success",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
};
