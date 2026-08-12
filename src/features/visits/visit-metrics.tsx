import { CalendarCheck2, Camera, Clock, Route } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import type { CustomerVisit } from "@/lib/visits.types";
import type { CustomerVisitRoutine } from "@/lib/visits.utils";

export interface VisitMetricsProps {
  visits: CustomerVisit[];
  routine: CustomerVisitRoutine[];
}

export function VisitMetrics({ visits, routine }: VisitMetricsProps) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const visitsThisMonth = visits.filter((visit) => visit.visitedAt.slice(0, 7) === month).length;
  const visitsToday = visits.filter((visit) => visit.visitedAt.slice(0, 10) === today).length;
  const overdue = routine.filter(
    (item) => item.status === "overdue" || item.status === "never",
  ).length;
  const withPhoto = visits.filter((visit) => Boolean(visit.proofPhotoPath)).length;
  const photoCoverage = visits.length > 0 ? (withPhoto / visits.length) * 100 : 0;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={<CalendarCheck2 className="h-4 w-4" />}
        label="Visitas no mês"
        value={visitsThisMonth.toLocaleString("pt-BR")}
        hint={`${visitsToday.toLocaleString("pt-BR")} feitas hoje`}
      />
      <MetricCard
        icon={<Clock className="h-4 w-4" />}
        label="Rotina pendente"
        value={overdue.toLocaleString("pt-BR")}
        hint="Clientes vencidos ou sem visita registrada"
      />
      <MetricCard
        icon={<Camera className="h-4 w-4" />}
        label="Comprovantes"
        value={`${Math.round(photoCoverage)}%`}
        hint="Visitas com foto obrigatória"
        progress={photoCoverage}
      />
      <MetricCard
        icon={<Route className="h-4 w-4" />}
        label="Clientes na rotina"
        value={routine.length.toLocaleString("pt-BR")}
        hint="Base visível para visitas"
      />
    </section>
  );
}
