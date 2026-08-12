import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  Building2,
  CircleDot,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Navigation,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, normalizeSearchText } from "@/lib/utils";
import { useSales } from "@/lib/state/sales-store";
import { buildCustomerMapData, type CustomerCityCluster } from "@/lib/customer-map";
import {
  CustomerTileMap,
  CUSTOMER_TILE_PROVIDERS,
  type CustomerTileProviderId,
} from "@/features/customers/customer-tile-map";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mapa-clientes")({
  beforeLoad: async ({ context }) => {
    // Apenas gestores (supervisor, gerente, administrador) podem acessar
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", (context as any).user.id);

    const allowedRoles = ["supervisor", "gerente_comercial", "administrador"];
    const hasAccess = roles?.some((r: { role: string }) => allowedRoles.includes(r.role));

    if (!hasAccess) {
      throw redirect({ to: "/catalogo" });
    }
  },
  head: () => ({
    meta: [
      { title: "Mapa de clientes · MR Força de Vendas" },
      {
        name: "description",
        content: "Visualize a carteira comercial em mapa real com um ponto por cliente.",
      },
    ],
  }),
  component: CustomerMapPage,
});

const ALL_SELLERS = "all";
const numberFormat = new Intl.NumberFormat("pt-BR");

function CustomerMapPage() {
  const { customers, sellers, loading } = useSales();
  const [term, setTerm] = useState("");
  const [sellerFilter, setSellerFilter] = useState(ALL_SELLERS);
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null);
  const [tileProvider, setTileProvider] = useState<CustomerTileProviderId>("carto-voyager");
  const [usedFallback, setUsedFallback] = useState(false);

  const segments = useMemo(() => {
    const s = new Set<string>();
    customers.forEach((c) => {
      if (c.segment) s.add(c.segment);
    });
    return Array.from(s).sort();
  }, [customers]);

  const [segmentFilter, setSegmentFilter] = useState<string>("all");

  const filteredCustomers = useMemo(() => {
    const q = normalizeSearchText(term.trim());

    return customers.filter((customer) => {
      if (sellerFilter !== ALL_SELLERS && customer.sellerErpCode !== sellerFilter) return false;
      if (segmentFilter !== "all" && customer.segment !== segmentFilter) return false;
      if (!q) return true;

      return normalizeSearchText(
        [
          customer.erpCode,
          customer.legalName,
          customer.tradeName,
          customer.taxId,
          customer.city,
          customer.uf,
          customer.sellerErpCode,
          customer.segment,
        ].join(" "),
      ).includes(q);
    });
  }, [customers, sellerFilter, segmentFilter, term]);

  const mapData = useMemo(() => buildCustomerMapData(filteredCustomers), [filteredCustomers]);

  const selectedCluster = useMemo(
    () => mapData.clusters.find((cluster) => cluster.key === selectedCityKey) ?? null,
    [mapData.clusters, selectedCityKey],
  );

  const focusedCluster = selectedCluster ?? mapData.clusters[0] ?? null;
  const selectedSeller = sellers.find((seller) => seller.code === sellerFilter);
  const estimatedCities = mapData.clusters.length - mapData.knownCityCount;
  const cityCoverage = mapData.clusters.length
    ? Math.round((mapData.knownCityCount / mapData.clusters.length) * 100)
    : 0;
  const handleProviderFallback = useCallback((providerId: CustomerTileProviderId) => {
    setTileProvider(providerId);
    setUsedFallback(true);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Carteira geográfica
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Mapa de clientes</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Mapa real com tiles CARTO e um pin por cliente. A posição usa cidade/UF do cadastro;
            quando vários clientes estão na mesma cidade, os pins são espalhados ao redor do centro.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/carteira">
            <Users className="mr-2 h-4 w-4" /> Ver carteira
          </Link>
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MapMetric
          icon={Building2}
          label="Clientes no mapa"
          value={numberFormat.format(filteredCustomers.length)}
          detail={`${numberFormat.format(customers.length)} clientes na base`}
        />
        <MapMetric
          icon={MapPin}
          label="Cidades"
          value={numberFormat.format(mapData.clusters.length)}
          detail={`${cityCoverage}% com coordenada aproximada conhecida`}
        />
        <MapMetric
          icon={LocateFixed}
          label="Estimativas"
          value={numberFormat.format(Math.max(estimatedCities, 0))}
          detail="Cidades posicionadas por UF até termos geocoding"
        />
        <MapMetric
          icon={Users}
          label="Representante"
          value={selectedSeller ? selectedSeller.code : "Todos"}
          detail={selectedSeller ? selectedSeller.name : "Carteira completa"}
        />
      </section>

      <section className="surface-card p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative min-w-[300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setSelectedCityKey(null);
              }}
              placeholder="Buscar cliente, CNPJ, código, cidade ou representante"
              className="h-12 rounded-xl bg-card pl-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={sellerFilter}
              onValueChange={(value) => {
                setSellerFilter(value);
                setSelectedCityKey(null);
              }}
            >
              <SelectTrigger className="h-12 w-full rounded-xl bg-card sm:w-[200px]">
                <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Representante" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value={ALL_SELLERS}>Todos</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.code} value={seller.code}>
                    {seller.code} · {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={segmentFilter}
              onValueChange={(value) => {
                setSegmentFilter(value);
                setSelectedCityKey(null);
              }}
            >
              <SelectTrigger className="h-12 w-full rounded-xl bg-card sm:w-[180px]">
                <Building2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Segmento" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">Todos Segmentos</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="h-12 rounded-xl"
              onClick={() => {
                setSellerFilter(ALL_SELLERS);
                setSegmentFilter("all");
              }}
              disabled={sellerFilter === ALL_SELLERS && segmentFilter === "all"}
            >
              Limpar
            </Button>
          </div>
          {/* Seletor de mapas removido do topo */}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="surface-card overflow-hidden">
          <div className="grid gap-3 border-b border-border/70 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <MapIcon className="h-5 w-5 text-primary" /> Distribuição visual
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pan, zoom e popups por cliente. Bolhas maiores indicam concentração por cidade.
              </p>
            </div>
            {selectedCluster && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setSelectedCityKey(null)}
              >
                Limpar seleção
              </Button>
            )}
          </div>

          <div className="space-y-3 bg-muted/30 p-3 sm:p-5">
            <CustomerTileMap
              points={mapData.points}
              clusters={mapData.clusters}
              selectedCityKey={selectedCityKey}
              providerId={tileProvider}
              loading={loading}
              onSelectCity={setSelectedCityKey}
              onProviderFallback={handleProviderFallback}
            />

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <LegendDot className="bg-[#e92b8d]" label="Cliente (Coordenada Real)" />
                <LegendDot className="bg-sky-500" label="Cliente (Posição Estimada)" />
                <LegendDot className="bg-emerald-500" label="Cidade Selecionada" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l border-border/50 pl-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Cores dos Pins:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                      <div className="h-2.5 w-2.5 rounded-full border border-white bg-[#0ea5e9]" />
                      <div className="h-2.5 w-2.5 rounded-full border border-white bg-[#f59e0b]" />
                      <div className="h-2.5 w-2.5 rounded-full border border-white bg-[#8b5cf6]" />
                    </div>
                    <span className="text-muted-foreground">Por Representante</span>
                  </div>
                </div>
                {usedFallback && (
                  <span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-1 font-medium text-warning">
                    Fallback ativado para Esri Street
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mr-2">
                  Estilo do Mapa:
                </span>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
                  {CUSTOMER_TILE_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setTileProvider(provider.id);
                        setUsedFallback(false);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                        tileProvider === provider.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Layers className="h-3 w-3" />
                      {provider.name.replace("CARTO ", "")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <CityFocusCard cluster={focusedCluster} />

          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CircleDot className="h-5 w-5 text-primary" /> Maiores concentrações
            </h2>
            <div className="mt-4 space-y-2">
              {mapData.clusters.slice(0, 12).map((cluster) => (
                <button
                  key={cluster.key}
                  type="button"
                  onClick={() => setSelectedCityKey(cluster.key)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50",
                    selectedCluster?.key === cluster.key && "border-primary/60 bg-primary/5",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {cluster.city}/{cluster.uf}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {cluster.sellerCodes.length} representantes
                    </span>
                  </span>
                  <span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold">
                    {numberFormat.format(cluster.count)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MapMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="mt-1 block truncate text-2xl font-bold">{value}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function CityFocusCard({ cluster }: { cluster: CustomerCityCluster | null }) {
  if (!cluster) {
    return (
      <section className="surface-card p-5">
        <h2 className="text-lg font-semibold">Cidade em foco</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aplique uma busca ou selecione um ponto para analisar.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-card p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cidade em foco
          </p>
          <h2 className="mt-1 truncate text-xl font-bold">
            {cluster.city}/{cluster.uf}
          </h2>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            cluster.knownCoordinate
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-sky-500/10 text-sky-700",
          )}
        >
          {cluster.knownCoordinate ? "Cidade conhecida" : "Estimado"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Clientes</p>
          <p className="mt-1 text-2xl font-bold">{numberFormat.format(cluster.count)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Representantes</p>
          <p className="mt-1 text-2xl font-bold">
            {numberFormat.format(cluster.sellerCodes.length)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {cluster.sellerCodes.slice(0, 8).map((sellerCode) => (
          <span
            key={sellerCode}
            className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium"
          >
            Rep. {sellerCode}
          </span>
        ))}
      </div>

      <div className="mt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Navigation className="h-4 w-4 text-primary" /> Clientes nesta cidade
        </h3>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
          {cluster.points.slice(0, 18).map((point) => (
            <div
              key={point.customerId}
              className="rounded-xl border border-border bg-card px-3 py-2"
            >
              <p className="truncate text-sm font-semibold">{point.tradeName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {point.erpCode} · Rep. {point.sellerErpCode ?? "—"}
              </p>
            </div>
          ))}
        </div>
        {cluster.points.length > 18 && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{numberFormat.format(cluster.points.length - 18)} clientes nesta cidade.
          </p>
        )}
      </div>
    </section>
  );
}
