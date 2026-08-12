import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2, MapPin, Plus, Search, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import {
  addCarrierCity,
  deleteCarrier,
  deleteCarrierCity,
  listCarriers,
  saveCarrier,
} from "@/lib/carriers.functions";
import type { CarrierRecord } from "@/lib/carriers.functions";

export const Route = createFileRoute("/_authenticated/admin/transportadoras")({
  component: CarriersPage,
  head: () => ({
    meta: [
      { title: "Transportadoras · MR Força de Vendas" },
      {
        name: "description",
        content:
          "Cadastre transportadoras e consulte as cidades atendidas por cada empresa, com prazo de entrega e tipo de frete.",
      },
      { property: "og:title", content: "Transportadoras · MR Força de Vendas" },
      {
        property: "og:description",
        content: "Veja quais cidades cada transportadora movimenta e mantenha a malha de entrega atualizada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CarriersPage() {
  const queryClient = useQueryClient();
  const loadCarriers = useServerFn(listCarriers);
  const upsertCarrier = useServerFn(saveCarrier);
  const dropCarrier = useServerFn(deleteCarrier);
  const createCity = useServerFn(addCarrierCity);
  const dropCity = useServerFn(deleteCarrierCity);

  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const carriersQuery = useQuery({
    queryKey: ["admin", "carriers"],
    queryFn: () => loadCarriers(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "carriers"] });

  const carrierMutation = useMutation({
    mutationFn: (input: Parameters<typeof upsertCarrier>[0]["data"]) => upsertCarrier({ data: input }),
    onSuccess: async () => {
      toast.success("Transportadora salva.");
      setCreating(false);
      setNewName("");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCarrierMutation = useMutation({
    mutationFn: (id: string) => dropCarrier({ data: { id } }),
    onSuccess: async () => {
      toast.success("Transportadora removida.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cityMutation = useMutation({
    mutationFn: (input: Parameters<typeof createCity>[0]["data"]) => createCity({ data: input }),
    onSuccess: async () => {
      toast.success("Cidade adicionada.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCityMutation = useMutation({
    mutationFn: (id: string) => dropCity({ data: { id } }),
    onSuccess: async () => {
      toast.success("Cidade removida.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const rows = carriersQuery.data ?? [];
    if (!t) return rows;
    return rows.filter(
      (carrier) =>
        carrier.name.toLowerCase().includes(t) ||
        carrier.cities.some(
          (city) => city.city.toLowerCase().includes(t) || city.uf.toLowerCase() === t,
        ),
    );
  }, [carriersQuery.data, term]);

  return (
    <AdminPage
      title="Transportadoras"
      description="Cadastro das transportadoras parceiras. Abra a opção “Movimenta” para ver todas as cidades atendidas por cada empresa."
      actions={
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova transportadora
        </button>
      }
    >
      {creating && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            carrierMutation.mutate({
              name: newName,
              taxId: "",
              phone: "",
              email: "",
              notes: "",
              active: true,
            });
          }}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nome da transportadora"
            className="min-w-[220px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={carrierMutation.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Salvar
          </button>
        </form>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por transportadora, cidade ou UF"
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {carriersQuery.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nenhuma transportadora encontrada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste a busca ou cadastre uma nova transportadora para mapear as cidades atendidas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((carrier) => (
            <CarrierCard
              key={carrier.id}
              carrier={carrier}
              open={expanded === carrier.id}
              onToggle={() => setExpanded((current) => (current === carrier.id ? null : carrier.id))}
              onAddCity={(input) => cityMutation.mutate({ carrierId: carrier.id, ...input })}
              onRemoveCity={(id) => removeCityMutation.mutate(id)}
              onToggleActive={(active) =>
                carrierMutation.mutate({
                  id: carrier.id,
                  name: carrier.name,
                  taxId: carrier.taxId,
                  phone: carrier.phone,
                  email: carrier.email,
                  notes: carrier.notes,
                  active,
                })
              }
              onRemove={() => removeCarrierMutation.mutate(carrier.id)}
              busy={cityMutation.isPending || removeCityMutation.isPending}
            />
          ))}
        </div>
      )}
    </AdminPage>
  );
}

interface CarrierCardProps {
  carrier: CarrierRecord;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onAddCity: (input: { city: string; uf: string; leadTimeDays: number; freightType: string }) => void;
  onRemoveCity: (id: string) => void;
  onToggleActive: (active: boolean) => void;
  onRemove: () => void;
}

function CarrierCard({
  carrier,
  open,
  busy,
  onToggle,
  onAddCity,
  onRemoveCity,
  onToggleActive,
  onRemove,
}: CarrierCardProps) {
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [leadTime, setLeadTime] = useState("1");

  const ufs = useMemo(
    () => Array.from(new Set(carrier.cities.map((item) => item.uf))).sort(),
    [carrier.cities],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <Truck className="h-4 w-4 text-primary" />
            {carrier.name}
            {!carrier.active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Inativa
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {carrier.cities.length.toLocaleString("pt-BR")} cidades atendidas
            {ufs.length > 0 && ` · ${ufs.join(", ")}`}
            {carrier.phone && ` · ${carrier.phone}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={carrier.active}
              onChange={(event) => onToggleActive(event.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Ativa
          </label>
          <button
            type="button"
            onClick={onRemove}
            title="Remover transportadora"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Movimenta
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cidades atendidas
          </p>

          {carrier.cities.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
              Nenhuma cidade cadastrada para esta transportadora ainda.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {carrier.cities.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {item.city} / {item.uf}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {item.leadTimeDays > 0
                        ? `Prazo ${item.leadTimeDays} dia${item.leadTimeDays > 1 ? "s" : ""}`
                        : "Prazo a combinar"}{" "}
                      · {item.freightType}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemoveCity(item.id)}
                    title="Remover cidade"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onAddCity({
                city,
                uf,
                leadTimeDays: Number(leadTime) || 0,
                freightType: "CIF",
              });
              setCity("");
              setUf("");
            }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Cidade"
              className="min-w-[160px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={uf}
              onChange={(event) => setUf(event.target.value.toUpperCase().slice(0, 2))}
              placeholder="UF"
              className="w-20 rounded-xl border border-border bg-card px-3 py-2 text-sm uppercase outline-none focus:border-primary"
            />
            <input
              value={leadTime}
              onChange={(event) => setLeadTime(event.target.value.replace(/\D/g, ""))}
              placeholder="Dias"
              className="w-24 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Adicionar cidade
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
