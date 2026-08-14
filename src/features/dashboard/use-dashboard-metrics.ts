import { useMemo } from "react";
import { useSales } from "@/lib/state/sales-store";

/**
 * Concentra os cálculos comerciais do painel do vendedor
 * (meta, total vendido, contagem de status e clientes em atenção).
 */
export function useDashboardMetrics() {
  const { orders, customers, sellerName, sellers } = useSales();

  return useMemo(() => {
    const seller = sellers.find((s) => s.name === sellerName);
    const goal = seller?.monthlyGoal ?? 0;

    const totalSold = orders
      .filter((o) => o.status === "confirmed" || o.status === "auto_approved")
      .reduce((acc, o) => acc + o.total, 0);

    const counts = {
      analise: orders.filter((o) => o.status === "pending_approval").length,
      aprovados: orders.filter((o) => o.status === "approved" || o.status === "auto_approved").length,
      correcao: orders.filter((o) => o.status === "changes_requested").length,
      erp: orders.filter((o) => o.integrationStatus === "awaiting_erp_integration").length,
    };

    const attention = customers.filter(
      (c) => c.restricted || (c.creditLimit > 0 && c.openBalance / c.creditLimit > 0.8),
    );

    const recentCustomers = customers
      .filter((c) => orders.some((o) => o.customerId === c.erpCode))
      .slice(0, 3);

    const goalProgress = goal > 0 ? (totalSold / goal) * 100 : 0;

    return { goal, goalProgress, totalSold, counts, attention, recentCustomers };
  }, [orders, customers, sellerName, sellers]);
}
