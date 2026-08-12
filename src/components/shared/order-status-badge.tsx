import { statusLabel, statusTone } from "@/lib/orders/status";
import type { CommercialStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface OrderStatusBadgeProps {
  status: CommercialStatus | string;
  className?: string;
}

/** Badge padrão de status comercial do pedido (rótulo + cor). */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const typed = status as CommercialStatus;
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        statusTone(typed),
        className,
      )}
    >
      {statusLabel[typed] ?? status}
    </span>
  );
}
