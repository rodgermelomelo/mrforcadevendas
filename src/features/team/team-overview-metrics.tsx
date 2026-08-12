import { ClipboardList, Target, TrendingUp, Users } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { formatBRL } from "@/lib/pricing";
import type { TeamOverview } from "@/lib/team.functions";

export interface TeamOverviewMetricsProps {
  data: TeamOverview;
}

export function TeamOverviewMetrics({ data }: TeamOverviewMetricsProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        variant="compact"
        icon={<TrendingUp className="h-4 w-4" />}
        label="Total vendido"
        value={formatBRL(data.totals.sold)}
        hint={`${data.totals.orderCount.toLocaleString("pt-BR")} pedidos em ${monthLabel(data.month)}`}
      />
      <MetricCard
        variant="compact"
        icon={<Target className="h-4 w-4" />}
        label="Meta da equipe"
        value={formatBRL(data.totals.goal)}
        hint={data.totals.goal > 0 ? `${data.totals.progress}% atingido` : "Sem metas definidas"}
        progress={data.totals.goal > 0 ? Math.min(100, data.totals.progress) : undefined}
      />
      <MetricCard
        variant="compact"
        icon={<ClipboardList className="h-4 w-4" />}
        label="Em análise"
        value={String(data.totals.pendingCount)}
        hint={formatBRL(data.totals.pendingValue)}
      />
      <MetricCard
        variant="compact"
        icon={<Users className="h-4 w-4" />}
        label="Representantes"
        value={`${data.totals.activeSellers}/${data.totals.sellers}`}
        hint="Com pedidos no período"
      />
    </section>
  );
}

function monthLabel(month: string) {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
