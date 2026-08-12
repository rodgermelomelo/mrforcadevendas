import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import type { TeamOrderRow } from "@/lib/team.functions";

export interface TeamOrderListProps {
  orders: TeamOrderRow[];
  emptyTitle: string;
  emptyDescription: string;
}

/** Lista de pedidos da equipe com link para o detalhe. */
export function TeamOrderList({ orders, emptyTitle, emptyDescription }: TeamOrderListProps) {
  if (orders.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            to="/pedidos/$orderId"
            params={{ orderId: order.id }}
            className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{order.customerName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {order.number} · {order.sellerName} · {formatDateTimeBR(order.createdAt)}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
            <span className="text-sm font-semibold tabular-nums">{formatBRL(order.total)}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
