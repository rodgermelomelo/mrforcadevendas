import type { Customer } from "@/lib/domain/types";
import type { CustomerVisit, VisitProofStatus, VisitShelfStatus } from "@/lib/visits.types";

export const shelfStatusLabel: Record<VisitShelfStatus, string> = {
  abastecida: "Abastecida",
  baixo_estoque: "Baixo estoque",
  sem_exposicao: "Sem exposição",
  oportunidade: "Oportunidade",
};

export const proofStatusLabel: Record<VisitProofStatus, string> = {
  photo_sent: "Foto enviada",
  validated: "Validada",
  rejected: "Revisar prova",
};

export interface CustomerVisitRoutine {
  customer: Customer;
  lastVisit: CustomerVisit | null;
  nextVisitDate: string | null;
  daysUntilNext: number | null;
  status: "overdue" | "due_soon" | "scheduled" | "never";
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function diffDays(date: string) {
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - startOfToday().getTime()) / 86_400_000);
}

function portfolioVisitKey(customerErpCode: string, sellerErpCode: string | undefined) {
  return `${customerErpCode}:${sellerErpCode ?? ""}`;
}

export function formatVisitDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatVisitDateTime(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildVisitRoutine(customers: Customer[], visits: CustomerVisit[]) {
  const lastVisitByCustomer = new Map<string, CustomerVisit>();

  for (const visit of visits) {
    const key = portfolioVisitKey(visit.customerErpCode, visit.sellerErpCode);
    const existing = lastVisitByCustomer.get(key);
    if (!existing || visit.visitedAt.localeCompare(existing.visitedAt) > 0) {
      lastVisitByCustomer.set(key, visit);
    }
  }

  return customers
    .map<CustomerVisitRoutine>((customer) => {
      const lastVisit =
        lastVisitByCustomer.get(portfolioVisitKey(customer.erpCode, customer.sellerErpCode)) ??
        null;
      const daysUntilNext = lastVisit ? diffDays(lastVisit.nextVisitDate) : null;
      const status =
        daysUntilNext === null
          ? "never"
          : daysUntilNext < 0
            ? "overdue"
            : daysUntilNext <= 7
              ? "due_soon"
              : "scheduled";

      return {
        customer,
        lastVisit,
        nextVisitDate: lastVisit?.nextVisitDate ?? null,
        daysUntilNext,
        status,
      };
    })
    .sort((a, b) => {
      const priority = { overdue: 0, never: 1, due_soon: 2, scheduled: 3 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return (a.daysUntilNext ?? 9999) - (b.daysUntilNext ?? 9999);
    });
}
