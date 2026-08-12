import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Building2,
  CircleDot,
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
import {
  buildCustomerMapData,
  getMapBounds,
  projectCoordinate,
  type CustomerCityCluster,
} from "@/lib/customer-map";

export const Route = createFileRoute("/_authenticated/mapa-clientes")({
  head: () => ({
    meta: [
      { title: "Mapa de clientes · MR Força de Vendas" },
      {
        name: "description",
        content: "Visualize a carteira comercial em um mapa aproximado com um ponto por cliente.",
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

  const filteredCustomers = useMemo(() => {
    const q = normalizeSearchText(term.trim());

    return customers.filter((customer) => {
      if (sellerFilter !== ALL_SELLERS && customer.sellerErpCode !== sellerFilter) return false;
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
        ].join(" "),
      ).includes(q);
    });
  }, [customers, sellerFilter, term]);

  const mapData = useMemo(() => buildCustomerMapData(filteredCustomers), [filteredCustomers]);
  const bounds = useMemo(() => getMapBounds(mapData.points), [mapData.points]);

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Carteira geográfica
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Mapa de clientes</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Cada ponto representa um cliente. A posição usa cidade/UF do cadastro atual; quando
            vários clientes estão na mesma cidade, os pontos são espalhados ao redor dela.
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
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="relative">
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
          <Select
            value={sellerFilter}
            onValueChange={(value) => {
              setSellerFilter(value);
              setSelectedCityKey(null);
            }}
          >
            <SelectTrigger className="h-12 rounded-xl bg-card">
              <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Representante" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={ALL_SELLERS}>Todos os representantes</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.code} value={seller.code}>
                  {seller.code} · {seller.name} ({numberFormat.format(seller.customerCount)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                Visualização aproximada por cidade, útil para cobertura comercial e concentração da
                carteira.
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

          <div className="bg-muted/30 p-3 sm:p-5">
            <svg
              viewBox="0 0 100 100"
              role="img"
              aria-label="Mapa visual com pontos de clientes por cidade"
              className="h-[32rem] w-full rounded-2xl border border-border bg-card shadow-inner"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern
                  id="customer-map-grid"
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 10 0 L 0 0 0 10"
                    className="stroke-border/60"
                    fill="none"
                    strokeWidth="0.12"
                  />
                </pattern>
              </defs>
              <rect width="100" height="100" className="fill-background" />
              <rect width="100" height="100" fill="url(#customer-map-grid)" />
              <path
                d="M12 78 C22 64 27 56 35 50 C43 44 51 44 60 37 C70 30 79 20 88 17"
                className="fill-none stroke-muted-foreground/20"
                strokeWidth="0.7"
              />
              <path
                d="M18 84 C28 72 35 66 44 61 C54 56 63 52 72 43 C80 35 86 27 92 20"
                className="fill-none stroke-primary/10"
                strokeWidth="2.2"
              />

              {mapData.clusters.slice(0, 12).map((cluster) => {
                const projected = projectCoordinate(cluster.coordinate, bounds);
                const selected = cluster.key === selectedCluster?.key;
                return (
                  <text
                    key={cluster.key}
                    x={projected.x}
                    y={Math.max(projected.y - 2.2, 3)}
                    textAnchor="middle"
                    className={cn(
                      "pointer-events-none select-none fill-muted-foreground text-[2.4px] font-semibold uppercase",
                      selected && "fill-primary",
                    )}
                  >
                    {cluster.city}
                  </text>
                );
              })}

              {focusedCluster && (
                <circle
                  cx={projectCoordinate(focusedCluster.coordinate, bounds).x}
                  cy={projectCoordinate(focusedCluster.coordinate, bounds).y}
                  r="4.8"
                  className="fill-primary/10 stroke-primary/35"
                  strokeWidth="0.35"
                />
              )}

              {mapData.points.map((point) => {
                const projected = projectCoordinate(point.coordinate, bounds);
                const selected = point.cityKey === selectedCluster?.key;
                const muted = Boolean(selectedCluster && !selected);
                const radius = selected ? 0.82 : mapData.points.length > 2500 ? 0.38 : 0.52;

                return (
                  <g
                    key={point.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer outline-none transition-opacity",
                      muted && "opacity-20",
                    )}
                    onClick={() => setSelectedCityKey(selected ? null : point.cityKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCityKey(selected ? null : point.cityKey);
                      }
                    }}
                  >
                    <title>
                      {point.tradeName} · {point.city}/{point.uf} · Rep.{" "}
                      {point.sellerErpCode ?? "—"}
                    </title>
                    <circle
                      cx={projected.x}
                      cy={projected.y}
                      r={radius + 0.25}
                      className={cn("fill-background/80", selected && "fill-primary/20")}
                    />
                    <circle
                      cx={projected.x}
                      cy={projected.y}
                      r={radius}
                      className={cn(
                        "fill-primary/75 stroke-background",
                        !point.knownCoordinate && "fill-sky-500/70",
                        selected && "fill-emerald-500",
                      )}
                      strokeWidth="0.18"
                    />
                  </g>
                );
              })}

              {!loading && mapData.points.length === 0 && (
                <text
                  x="50"
                  y="50"
                  textAnchor="middle"
                  className="fill-muted-foreground text-[3px] font-semibold"
                >
                  Nenhum cliente encontrado para os filtros atuais
                </text>
              )}
            </svg>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <LegendDot className="bg-primary" label="Cidade conhecida" />
              <LegendDot className="bg-sky-500" label="Estimado pela UF" />
              <LegendDot className="bg-emerald-500" label="Cidade selecionada" />
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
