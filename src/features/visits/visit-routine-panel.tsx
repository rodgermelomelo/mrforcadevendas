import { CalendarClock, MapPin, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatVisitDate, type CustomerVisitRoutine } from "@/lib/visits.utils";

export interface VisitRoutinePanelProps {
  routine: CustomerVisitRoutine[];
}

const statusCopy = {
  overdue: { label: "Vencida", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  due_soon: { label: "Próxima", tone: "border-warning/30 bg-warning/10 text-warning" },
  scheduled: { label: "Agendada", tone: "border-border bg-muted text-muted-foreground" },
  never: { label: "Sem visita", tone: "border-primary/30 bg-primary/10 text-primary" },
} as const;

function routineHint(item: CustomerVisitRoutine) {
  if (item.status === "never") return "Nenhuma visita comprovada registrada.";
  if (item.daysUntilNext === null) return "Sem rotina calculada.";
  if (item.daysUntilNext < 0) return `${Math.abs(item.daysUntilNext)} dias em atraso.`;
  if (item.daysUntilNext === 0) return "Visita sugerida para hoje.";
  return `Próxima em ${item.daysUntilNext} dias.`;
}

export function VisitRoutinePanel({ routine }: VisitRoutinePanelProps) {
  const priority = routine.filter((item) => item.status !== "scheduled").slice(0, 18);

  return (
    <section className="surface-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Rotina sugerida</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Baseada na última visita comprovada e no intervalo definido pelo representante.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {priority.length === 0 ? (
          <EmptyState
            icon={<PlusCircle className="h-8 w-8" />}
            title="Rotina em dia"
            description="Nenhum cliente vencido ou sem visita na carteira filtrada."
          />
        ) : (
          priority.map((item) => {
            const status = statusCopy[item.status];
            return (
              <article
                key={item.customer.id}
                className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{item.customer.tradeName}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.customer.city}/{item.customer.uf} · Rep.{" "}
                      {item.customer.sellerErpCode ?? "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0", status.tone)}>
                    {status.label}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{routineHint(item)}</p>
                {item.lastVisit && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última visita em {formatVisitDate(item.lastVisit.visitedAt)} · próxima{" "}
                    {formatVisitDate(item.lastVisit.nextVisitDate)}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
