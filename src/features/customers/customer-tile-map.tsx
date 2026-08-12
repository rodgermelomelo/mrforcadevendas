import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CircleMarker,
  LatLngBoundsExpression,
  LatLngExpression,
  LayerGroup,
  Map as LeafletMap,
  TileLayer,
} from "leaflet";
import type { CustomerCityCluster, CustomerMapPoint } from "@/lib/customer-map";
import { cn } from "@/lib/utils";

export const CUSTOMER_TILE_PROVIDERS = [
  {
    id: "carto-voyager",
    name: "CARTO Voyager",
    detail: "colorido",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "carto-positron",
    name: "CARTO Positron",
    detail: "claro",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "esri-streets",
    name: "Esri Street",
    detail: "fallback",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors, and the GIS User Community",
  },
] as const;

export type CustomerTileProviderId = (typeof CUSTOMER_TILE_PROVIDERS)[number]["id"];

interface CustomerTileMapProps {
  points: CustomerMapPoint[];
  clusters: CustomerCityCluster[];
  selectedCityKey: string | null;
  providerId: CustomerTileProviderId;
  loading: boolean;
  onSelectCity: (cityKey: string | null) => void;
  onProviderFallback: (providerId: CustomerTileProviderId) => void;
}

const BRAZIL_CENTER: LatLngExpression = [-14.235, -51.9253];
const SELLER_COLORS = [
  "#e92b8d",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#f97316",
  "#84cc16",
];

function colorForSeller(code: string | undefined) {
  if (!code) return "#64748b";
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (Math.imul(hash, 31) + code.charCodeAt(index)) | 0;
  }
  return SELLER_COLORS[Math.abs(hash) % SELLER_COLORS.length] ?? SELLER_COLORS[0];
}

function escapeHtml(value: string | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function providerById(providerId: CustomerTileProviderId) {
  return (
    CUSTOMER_TILE_PROVIDERS.find((provider) => provider.id === providerId) ??
    CUSTOMER_TILE_PROVIDERS[0]
  );
}

function boundsForPoints(points: CustomerMapPoint[]): LatLngBoundsExpression | null {
  if (points.length === 0) return null;
  return points.map((point) => [point.coordinate.lat, point.coordinate.lng] as [number, number]);
}

function markerRadius(totalPoints: number, selected: boolean) {
  if (selected) return 7;
  if (totalPoints > 3500) return 3.5;
  if (totalPoints > 1800) return 4;
  return 4.8;
}

function popupHtml(point: CustomerMapPoint) {
  return `
    <div style="min-width: 220px; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="font-size: 13px; font-weight: 800; color: #111827; line-height: 1.25;">${escapeHtml(point.tradeName)}</div>
      <div style="margin-top: 4px; color: #6b7280; font-size: 12px;">${escapeHtml(point.legalName)}</div>
      <div style="margin-top: 10px; display: grid; gap: 4px; color: #374151; font-size: 12px;">
        <span><strong>Código:</strong> ${escapeHtml(point.erpCode)}</span>
        <span><strong>Cidade:</strong> ${escapeHtml(point.city)}/${escapeHtml(point.uf)}</span>
        <span><strong>Representante:</strong> ${escapeHtml(point.sellerErpCode ?? "-")}</span>
      </div>
    </div>
  `;
}

export function CustomerTileMap({
  points,
  clusters,
  selectedCityKey,
  providerId,
  loading,
  onSelectCity,
  onProviderFallback,
}: CustomerTileMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const dataLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [tileFailures, setTileFailures] = useState(0);

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.key === selectedCityKey) ?? null,
    [clusters, selectedCityKey],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootMap() {
      if (!containerRef.current || mapRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        attributionControl: true,
        preferCanvas: true,
        zoomControl: false,
        worldCopyJump: true,
      }).setView(BRAZIL_CENTER, 4);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
      dataLayerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    }

    void bootMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      dataLayerRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !leafletRef.current || !mapRef.current) return;
    const L = leafletRef.current;
    const provider = providerById(providerId);
    tileLayerRef.current?.remove();

    const tileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
        subdomains: provider.subdomains ?? "abc",
      detectRetina: true,
    }).addTo(mapRef.current);

    tileLayer.on("tileerror", () => {
      setTileFailures((current) => current + 1);
    });

    tileLayerRef.current = tileLayer;
    setTileFailures(0);
  }, [providerId, ready]);

  useEffect(() => {
    if (tileFailures < 4 || providerId === "esri-streets") return;
    onProviderFallback("esri-streets");
  }, [onProviderFallback, providerId, tileFailures]);

  useEffect(() => {
    if (!ready || !leafletRef.current || !dataLayerRef.current) return;
    const L = leafletRef.current;
    const layer = dataLayerRef.current;
    layer.clearLayers();

    const selected = selectedCityKey;
    for (const cluster of clusters) {
      const isSelected = cluster.key === selected;
      const muted = Boolean(selected && !isSelected);
      const color = isSelected ? "#10b981" : "#e92b8d";
      L.circle([cluster.coordinate.lat, cluster.coordinate.lng], {
        radius: Math.min(36000, 6000 + Math.sqrt(cluster.count) * 3000),
        color,
        weight: isSelected ? 2 : 1,
        opacity: muted ? 0.12 : 0.28,
        fillColor: color,
        fillOpacity: muted ? 0.03 : isSelected ? 0.16 : 0.08,
        interactive: false,
      }).addTo(layer);
    }

    const renderer = L.canvas({ padding: 0.5 });
    for (const point of points) {
      const isSelected = point.cityKey === selected;
      const muted = Boolean(selected && !isSelected);
      const color = isSelected ? "#10b981" : colorForSeller(point.sellerErpCode);
      const marker: CircleMarker = L.circleMarker([point.coordinate.lat, point.coordinate.lng], {
        renderer,
        radius: markerRadius(points.length, isSelected),
        color: "#ffffff",
        fillColor: point.knownCoordinate ? color : "#0ea5e9",
        weight: isSelected ? 2 : 1.2,
        opacity: muted ? 0.35 : 1,
        fillOpacity: muted ? 0.28 : 0.88,
      });

      marker.bindPopup(popupHtml(point), {
        closeButton: true,
        maxWidth: 280,
      });
      marker.on("click", () => onSelectCity(isSelected ? null : point.cityKey));
      marker.addTo(layer);
    }
  }, [clusters, onSelectCity, points, ready, selectedCityKey]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const bounds = boundsForPoints(points);

    if (!bounds) {
      map.setView(BRAZIL_CENTER, 4);
      return;
    }

    map.fitBounds(bounds, {
      animate: false,
      maxZoom: points.length > 1 ? 9 : 12,
      padding: [36, 36],
    });
  }, [points, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !selectedCluster) return;
    const bounds = boundsForPoints(selectedCluster.points);
    if (!bounds) return;
    mapRef.current.flyToBounds(bounds, {
      duration: 0.55,
      maxZoom: selectedCluster.count > 1 ? 12 : 13,
      padding: [52, 52],
    });
  }, [ready, selectedCluster]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={cn(
      "relative min-h-[34rem] overflow-hidden rounded-2xl border border-border bg-slate-100 shadow-inner",
      isFullscreen && "fixed inset-0 z-[60] rounded-none border-0"
    )}>
      <div ref={containerRef} className="absolute inset-0" />
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute right-4 top-4 z-[500] rounded-xl bg-white/90 p-2 shadow-sm backdrop-blur hover:bg-white"
      >
        {isFullscreen ? "Sair da tela cheia" : "Ampliar mapa"}
      </button>
      {(!ready || loading) && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-card px-5 py-4 text-center shadow-lift">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm font-semibold">Carregando mapa e clientes...</p>
          </div>
        </div>
      )}
      {ready && points.length === 0 && !loading && (
        <div className="absolute inset-x-4 top-4 z-[500] rounded-2xl border border-border bg-card/95 p-4 text-sm text-muted-foreground shadow-lift backdrop-blur">
          Nenhum cliente encontrado para os filtros atuais.
        </div>
      )}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-4 bottom-4 z-[500] rounded-2xl border border-border bg-card/92 px-4 py-3 shadow-lift backdrop-blur",
          "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mapa real por tiles
          </p>
          <p className="truncate text-sm font-semibold">
            {providerById(providerId).name} · {points.length.toLocaleString("pt-BR")} pins
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e92b8d]" />
          Cliente
          <span className="ml-2 h-2.5 w-2.5 rounded-full bg-[#10b981]" />
          Seleção
        </div>
      </div>
    </div>
  );
}
