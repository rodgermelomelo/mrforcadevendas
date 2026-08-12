import { Camera, CalendarCheck2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { CustomerVisit } from "@/lib/visits.types";
import {
  formatVisitDate,
  formatVisitDateTime,
  proofStatusLabel,
  shelfStatusLabel,
} from "@/lib/visits.utils";

export interface VisitHistoryListProps {
  visits: CustomerVisit[];
}

export function VisitHistoryList({ visits }: VisitHistoryListProps) {
  return (
    <section className="surface-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarCheck2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Histórico comprovado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitas registradas com foto obrigatória da loja ou gôndola.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visits.length === 0 ? (
          <EmptyState
            icon={<Camera className="h-8 w-8" />}
            title="Nenhuma visita registrada"
            description="Registre a primeira visita enviando a foto obrigatória do local."
          />
        ) : (
          visits.slice(0, 30).map((visit) => (
            <article key={visit.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                  {visit.proofPhotoUrl ? (
                    <img
                      src={visit.proofPhotoUrl}
                      alt={`Comprovante da visita em ${visit.customerName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <Camera className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{visit.customerName}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {visit.city}/{visit.uf} · Rep. {visit.sellerErpCode}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    >
                      {proofStatusLabel[visit.proofStatus]}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg bg-muted px-2 py-1 font-medium">
                      {shelfStatusLabel[visit.shelfStatus]}
                    </span>
                    <span className="rounded-lg bg-muted px-2 py-1 font-medium">
                      {formatVisitDateTime(visit.visitedAt)}
                    </span>
                    <span className="rounded-lg bg-muted px-2 py-1 font-medium">
                      Próxima {formatVisitDate(visit.nextVisitDate)}
                    </span>
                  </div>

                  {visit.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">{visit.notes}</p>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
