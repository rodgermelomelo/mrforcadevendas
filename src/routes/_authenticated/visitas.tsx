import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VisitFormCard } from "@/features/visits/visit-form-card";
import { VisitHistoryList } from "@/features/visits/visit-history-list";
import { VisitMetrics } from "@/features/visits/visit-metrics";
import { VisitRoutinePanel } from "@/features/visits/visit-routine-panel";
import { useSales } from "@/lib/state/sales-store";
import { listCustomerVisits } from "@/lib/visits.functions";
import { buildVisitRoutine } from "@/lib/visits.utils";
import { normalizeSearchText } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/visitas")({
  head: () => ({
    meta: [
      { title: "Visitas comerciais · MR Força de Vendas" },
      {
        name: "description",
        content: "Registre visitas comprovadas com foto e acompanhe a rotina da carteira.",
      },
    ],
  }),
  component: VisitsPage,
});

const ALL_SELLERS = "all";

function VisitsPage() {
  const { customers, sellers, loading } = useSales();
  const loadVisits = useServerFn(listCustomerVisits);
  const [term, setTerm] = useState("");
  const [sellerFilter, setSellerFilter] = useState(ALL_SELLERS);

  const visitsQuery = useQuery({
    queryKey: ["customer-visits"],
    queryFn: () => loadVisits(),
  });

  const filteredCustomers = useMemo(() => {
    const q = normalizeSearchText(term.trim());
    return customers.filter((customer) => {
      if (sellerFilter !== ALL_SELLERS && customer.sellerErpCode !== sellerFilter) return false;
      if (!q) return true;
      return normalizeSearchText(
        [
          customer.erpCode,
          customer.tradeName,
          customer.legalName,
          customer.city,
          customer.uf,
          customer.sellerErpCode,
        ].join(" "),
      ).includes(q);
    });
  }, [customers, sellerFilter, term]);

  const filteredVisits = useMemo(() => {
    const customerCodes = new Set(filteredCustomers.map((customer) => customer.erpCode));
    return (visitsQuery.data ?? []).filter((visit) => {
      if (sellerFilter !== ALL_SELLERS && visit.sellerErpCode !== sellerFilter) return false;
      return customerCodes.has(visit.customerErpCode);
    });
  }, [filteredCustomers, sellerFilter, visitsQuery.data]);

  const routine = useMemo(
    () => buildVisitRoutine(filteredCustomers, visitsQuery.data ?? []),
    [filteredCustomers, visitsQuery.data],
  );

  const defaultSellerCode = sellerFilter !== ALL_SELLERS ? sellerFilter : sellers[0]?.code;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Campo comercial
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-4xl">Visitas</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Registre visitas aos clientes da carteira com foto obrigatória da loja ou gôndola e
            transforme a última visita em uma rotina mensal de acompanhamento.
          </p>
        </div>
        <div className="surface-card flex items-center gap-3 px-4 py-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Padrão de rotina</p>
            <p className="text-sm font-semibold">30 dias após cada visita</p>
          </div>
        </div>
      </header>

      <VisitMetrics visits={filteredVisits} routine={routine} />

      <section className="surface-card p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar cliente, cidade ou representante"
              className="h-12 rounded-xl bg-card pl-11 text-base"
            />
          </div>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-card">
              <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Representante" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={ALL_SELLERS}>Todos os representantes</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.code} value={seller.code}>
                  {seller.code} · {seller.name} ({seller.customerCount.toLocaleString("pt-BR")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <main className="space-y-6">
          <VisitFormCard customers={filteredCustomers} defaultSellerCode={defaultSellerCode} />
          <VisitHistoryList visits={filteredVisits} />
        </main>
        <aside>
          <VisitRoutinePanel routine={routine} />
        </aside>
      </div>

      {(loading || visitsQuery.isLoading) && (
        <p className="text-center text-sm text-muted-foreground">
          Carregando visitas e carteira...
        </p>
      )}
    </div>
  );
}
