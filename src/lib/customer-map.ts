import type { Customer } from "@/lib/domain/types";

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface CustomerMapPoint {
  id: string;
  customerId: string;
  erpCode: string;
  tradeName: string;
  legalName: string;
  sellerErpCode: string | undefined;
  city: string;
  uf: string;
  cityKey: string;
  coordinate: Coordinate;
  knownCoordinate: boolean;
}

export interface CustomerCityCluster {
  key: string;
  city: string;
  uf: string;
  count: number;
  coordinate: Coordinate;
  knownCoordinate: boolean;
  sellerCodes: string[];
  points: CustomerMapPoint[];
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ProjectedCoordinate {
  x: number;
  y: number;
}

const BRAZIL_BOUNDS: MapBounds = {
  minLat: -33.8,
  maxLat: 5.4,
  minLng: -74,
  maxLng: -34.7,
};

const STATE_COORDS: Record<string, Coordinate> = {
  AC: { lat: -9.98, lng: -67.81 },
  AL: { lat: -9.66, lng: -35.73 },
  AM: { lat: -3.1, lng: -60.02 },
  AP: { lat: 0.04, lng: -51.07 },
  BA: { lat: -12.97, lng: -38.5 },
  CE: { lat: -3.73, lng: -38.52 },
  DF: { lat: -15.78, lng: -47.93 },
  ES: { lat: -20.32, lng: -40.34 },
  GO: { lat: -16.68, lng: -49.25 },
  MA: { lat: -2.53, lng: -44.3 },
  MG: { lat: -19.92, lng: -43.94 },
  MS: { lat: -20.45, lng: -54.62 },
  MT: { lat: -15.6, lng: -56.1 },
  PA: { lat: -1.45, lng: -48.5 },
  PB: { lat: -7.12, lng: -34.86 },
  PE: { lat: -8.05, lng: -34.9 },
  PI: { lat: -5.09, lng: -42.8 },
  PR: { lat: -25.43, lng: -49.27 },
  RJ: { lat: -22.91, lng: -43.17 },
  RN: { lat: -5.79, lng: -35.21 },
  RO: { lat: -8.76, lng: -63.9 },
  RR: { lat: 2.82, lng: -60.67 },
  RS: { lat: -30.03, lng: -51.23 },
  SC: { lat: -27.59, lng: -48.55 },
  SE: { lat: -10.91, lng: -37.07 },
  SP: { lat: -22.2, lng: -48.8 },
  TO: { lat: -10.18, lng: -48.33 },
};

const CITY_COORDS: Record<string, Coordinate> = {
  "AGUDOS/SP": { lat: -22.47, lng: -48.99 },
  "AMERICANA/SP": { lat: -22.74, lng: -47.33 },
  "AMPARO/SP": { lat: -22.7, lng: -46.76 },
  "ANDRADINA/SP": { lat: -20.9, lng: -51.38 },
  "APIAI/SP": { lat: -24.51, lng: -48.84 },
  "ARACATUBA/SP": { lat: -21.21, lng: -50.43 },
  "ARARAQUARA/SP": { lat: -21.78, lng: -48.18 },
  "ARARAS/SP": { lat: -22.36, lng: -47.38 },
  "ARTUR NOGUEIRA/SP": { lat: -22.57, lng: -47.17 },
  "ASSIS/SP": { lat: -22.66, lng: -50.41 },
  "ATIBAIA/SP": { lat: -23.12, lng: -46.55 },
  "AVARE/SP": { lat: -23.1, lng: -48.93 },
  "BARIRI/SP": { lat: -22.07, lng: -48.74 },
  "BARRETOS/SP": { lat: -20.56, lng: -48.57 },
  "BARUERI/SP": { lat: -23.51, lng: -46.88 },
  "BATATAIS/SP": { lat: -20.89, lng: -47.59 },
  "BAURU/SP": { lat: -22.31, lng: -49.06 },
  "BEBEDOURO/SP": { lat: -20.95, lng: -48.48 },
  "BIRIGUI/SP": { lat: -21.29, lng: -50.34 },
  "BOITUVA/SP": { lat: -23.28, lng: -47.67 },
  "BOTUCATU/SP": { lat: -22.89, lng: -48.45 },
  "BRAGANCA PAULISTA/SP": { lat: -22.95, lng: -46.54 },
  "CABREUVA/SP": { lat: -23.31, lng: -47.13 },
  "CAMPINAS/SP": { lat: -22.91, lng: -47.06 },
  "CAMPO LIMPO PAULISTA/SP": { lat: -23.21, lng: -46.78 },
  "CARAGUATATUBA/SP": { lat: -23.62, lng: -45.41 },
  "CATANDUVA/SP": { lat: -21.14, lng: -48.97 },
  "COTIA/SP": { lat: -23.6, lng: -46.92 },
  "DIADEMA/SP": { lat: -23.69, lng: -46.62 },
  "FERNANDOPOLIS/SP": { lat: -20.28, lng: -50.25 },
  "FRANCA/SP": { lat: -20.54, lng: -47.4 },
  "GARCA/SP": { lat: -22.21, lng: -49.66 },
  "GUARULHOS/SP": { lat: -23.45, lng: -46.53 },
  "HORTOLANDIA/SP": { lat: -22.85, lng: -47.21 },
  "IBATE/SP": { lat: -21.96, lng: -47.99 },
  "IBITINGA/SP": { lat: -21.76, lng: -48.83 },
  "IBIUNA/SP": { lat: -23.66, lng: -47.22 },
  "IGARAPAVA/SP": { lat: -20.04, lng: -47.75 },
  "IGUAPE/SP": { lat: -24.71, lng: -47.56 },
  "INDAIATUBA/SP": { lat: -23.09, lng: -47.22 },
  "ITAPEVA/SP": { lat: -23.98, lng: -48.88 },
  "ITAPETININGA/SP": { lat: -23.59, lng: -48.05 },
  "ITAPIRA/SP": { lat: -22.44, lng: -46.82 },
  "ITAPOLIS/SP": { lat: -21.6, lng: -48.81 },
  "ITARARE/SP": { lat: -24.11, lng: -49.33 },
  "ITU/SP": { lat: -23.26, lng: -47.3 },
  "ITUPEVA/SP": { lat: -23.15, lng: -47.06 },
  "ITUVERAVA/SP": { lat: -20.34, lng: -47.78 },
  "JABOTICABAL/SP": { lat: -21.25, lng: -48.32 },
  "JAGUARIUNA/SP": { lat: -22.7, lng: -47 },
  "JALES/SP": { lat: -20.27, lng: -50.55 },
  "JAU/SP": { lat: -22.29, lng: -48.56 },
  "JUNDIAI/SP": { lat: -23.19, lng: -46.9 },
  "LARANJAL PAULISTA/SP": { lat: -23.05, lng: -47.84 },
  "LEME/SP": { lat: -22.19, lng: -47.39 },
  "LENCOIS PAULISTA/SP": { lat: -22.6, lng: -48.8 },
  "LIMEIRA/SP": { lat: -22.56, lng: -47.4 },
  "LINS/SP": { lat: -21.68, lng: -49.74 },
  "LORENA/SP": { lat: -22.73, lng: -45.12 },
  "LOUVEIRA/SP": { lat: -23.09, lng: -46.95 },
  "MARILIA/SP": { lat: -22.22, lng: -49.95 },
  "MATAO/SP": { lat: -21.6, lng: -48.37 },
  "MIRASSOL/SP": { lat: -20.82, lng: -49.52 },
  "MOGI DAS CRUZES/SP": { lat: -23.52, lng: -46.19 },
  "MOGI GUACU/SP": { lat: -22.37, lng: -46.94 },
  "MOGI MIRIM/SP": { lat: -22.43, lng: -46.96 },
  "MONTE ALTO/SP": { lat: -21.26, lng: -48.5 },
  "MONTE MOR/SP": { lat: -22.95, lng: -47.31 },
  "NOVA ODESSA/SP": { lat: -22.78, lng: -47.29 },
  "ORLANDIA/SP": { lat: -20.72, lng: -47.89 },
  "OSASCO/SP": { lat: -23.53, lng: -46.79 },
  "OURINHOS/SP": { lat: -22.98, lng: -49.87 },
  "PAULINIA/SP": { lat: -22.76, lng: -47.15 },
  "PENAPOLIS/SP": { lat: -21.42, lng: -50.08 },
  "PIRACICABA/SP": { lat: -22.73, lng: -47.65 },
  "PIRASSUNUNGA/SP": { lat: -21.99, lng: -47.43 },
  "PRESIDENTE EPITACIO/SP": { lat: -21.76, lng: -52.12 },
  "PRESIDENTE PRUDENTE/SP": { lat: -22.12, lng: -51.39 },
  "REGISTRO/SP": { lat: -24.49, lng: -47.84 },
  "RIBEIRAO PRETO/SP": { lat: -21.18, lng: -47.81 },
  "RIO CLARO/SP": { lat: -22.41, lng: -47.56 },
  "SALTO/SP": { lat: -23.2, lng: -47.29 },
  "SANTA BARBARA D OESTE/SP": { lat: -22.75, lng: -47.41 },
  "SANTA FE DO SUL/SP": { lat: -20.21, lng: -50.93 },
  "SANTOS/SP": { lat: -23.96, lng: -46.33 },
  "SAO BERNARDO DO CAMPO/SP": { lat: -23.69, lng: -46.56 },
  "SAO CARLOS/SP": { lat: -22.01, lng: -47.89 },
  "SAO JOAO DA BOA VISTA/SP": { lat: -21.97, lng: -46.8 },
  "SAO JOAQUIM DA BARRA/SP": { lat: -20.58, lng: -47.86 },
  "SAO JOSE DO RIO PRETO/SP": { lat: -20.81, lng: -49.38 },
  "SAO JOSE DOS CAMPOS/SP": { lat: -23.22, lng: -45.9 },
  "SAO MANUEL/SP": { lat: -22.73, lng: -48.57 },
  "SAO PAULO/SP": { lat: -23.55, lng: -46.63 },
  "SAO ROQUE/SP": { lat: -23.53, lng: -47.14 },
  "SERTAOZINHO/SP": { lat: -21.14, lng: -47.99 },
  "SOROCABA/SP": { lat: -23.5, lng: -47.45 },
  "SUMARE/SP": { lat: -22.82, lng: -47.27 },
  "TAUBATE/SP": { lat: -23.03, lng: -45.56 },
  "TATUI/SP": { lat: -23.35, lng: -47.85 },
  "TUPA/SP": { lat: -21.93, lng: -50.51 },
  "VALINHOS/SP": { lat: -22.97, lng: -46.99 },
  "VARZEA PAULISTA/SP": { lat: -23.21, lng: -46.83 },
  "VINHEDO/SP": { lat: -23.03, lng: -46.98 },
  "VOTORANTIM/SP": { lat: -23.55, lng: -47.44 },
  "VOTUPORANGA/SP": { lat: -20.42, lng: -49.98 },
};

function normalizeLocationText(value: string | undefined) {
  return (value ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getCustomerCityKey(customer: Pick<Customer, "city" | "uf">) {
  const city = normalizeLocationText(customer.city) || "SEM CIDADE";
  const uf = normalizeLocationText(customer.uf) || "BR";
  return `${city}/${uf}`;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBaseCoordinate(
  cityKey: string,
  uf: string,
): { coordinate: Coordinate; known: boolean } {
  const known = CITY_COORDS[cityKey];
  if (known) return { coordinate: known, known: true };

  const state = STATE_COORDS[normalizeLocationText(uf)] ?? { lat: -14.24, lng: -51.93 };
  const seed = hashString(cityKey);
  const angle = ((seed % 3600) / 3600) * Math.PI * 2;
  const distance = 0.45 + ((seed >>> 8) % 1000) / 1000;
  const stateSpread = normalizeLocationText(uf) === "SP" ? 3.3 : 5.5;

  return {
    coordinate: {
      lat: clamp(
        state.lat + Math.sin(angle) * distance * stateSpread * 0.55,
        BRAZIL_BOUNDS.minLat,
        BRAZIL_BOUNDS.maxLat,
      ),
      lng: clamp(
        state.lng + Math.cos(angle) * distance * stateSpread,
        BRAZIL_BOUNDS.minLng,
        BRAZIL_BOUNDS.maxLng,
      ),
    },
    known: false,
  };
}

function spreadCustomer(
  base: Coordinate,
  pointSeed: string,
  index: number,
  total: number,
): Coordinate {
  if (total <= 1) return base;

  const seed = hashString(`${pointSeed}:${index}`);
  const angle = ((seed % 3600) / 3600) * Math.PI * 2;
  const ring = Math.sqrt((index + 1) / total);
  const distance = Math.min(0.36, 0.05 + Math.log10(total + 1) * 0.12) * ring;

  return {
    lat: clamp(base.lat + Math.sin(angle) * distance, BRAZIL_BOUNDS.minLat, BRAZIL_BOUNDS.maxLat),
    lng: clamp(
      base.lng + Math.cos(angle) * distance * 1.25,
      BRAZIL_BOUNDS.minLng,
      BRAZIL_BOUNDS.maxLng,
    ),
  };
}

export function buildCustomerMapData(customers: Customer[]) {
  const grouped = new Map<
    string,
    { customers: Customer[]; city: string; uf: string; coordinate: Coordinate; known: boolean }
  >();

  for (const customer of customers) {
    const key = getCustomerCityKey(customer);
    const existing = grouped.get(key);
    if (existing) {
      existing.customers.push(customer);
      continue;
    }

    const base = getBaseCoordinate(key, customer.uf);
    grouped.set(key, {
      customers: [customer],
      city: customer.city || "Sem cidade",
      uf: customer.uf || "BR",
      coordinate: base.coordinate,
      known: base.known,
    });
  }

  const points: CustomerMapPoint[] = [];
  const clusters: CustomerCityCluster[] = [];

  for (const [key, group] of grouped) {
    const sortedCustomers = [...group.customers].sort((a, b) =>
      a.tradeName.localeCompare(b.tradeName, "pt-BR"),
    );
    const clusterPoints = sortedCustomers.map((customer, index) => {
      const point: CustomerMapPoint = {
        id: `${customer.id}:${index}`,
        customerId: customer.id,
        erpCode: customer.erpCode,
        tradeName: customer.tradeName,
        legalName: customer.legalName,
        sellerErpCode: customer.sellerErpCode,
        city: customer.city || group.city,
        uf: customer.uf || group.uf,
        cityKey: key,
        coordinate: spreadCustomer(group.coordinate, customer.id, index, sortedCustomers.length),
        knownCoordinate: group.known,
      };
      points.push(point);
      return point;
    });

    clusters.push({
      key,
      city: group.city,
      uf: group.uf,
      count: sortedCustomers.length,
      coordinate: group.coordinate,
      knownCoordinate: group.known,
      sellerCodes: [
        ...new Set(
          sortedCustomers.map((customer) => customer.sellerErpCode).filter(Boolean) as string[],
        ),
      ].sort(),
      points: clusterPoints,
    });
  }

  return {
    points,
    clusters: clusters.sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "pt-BR")),
    knownCityCount: clusters.filter((cluster) => cluster.knownCoordinate).length,
  };
}

export function getMapBounds(points: CustomerMapPoint[]): MapBounds {
  if (points.length === 0) return BRAZIL_BOUNDS;

  const minLat = Math.min(...points.map((point) => point.coordinate.lat));
  const maxLat = Math.max(...points.map((point) => point.coordinate.lat));
  const minLng = Math.min(...points.map((point) => point.coordinate.lng));
  const maxLng = Math.max(...points.map((point) => point.coordinate.lng));
  const latPadding = Math.max((maxLat - minLat) * 0.18, 0.5);
  const lngPadding = Math.max((maxLng - minLng) * 0.18, 0.5);

  return {
    minLat: clamp(minLat - latPadding, BRAZIL_BOUNDS.minLat, BRAZIL_BOUNDS.maxLat),
    maxLat: clamp(maxLat + latPadding, BRAZIL_BOUNDS.minLat, BRAZIL_BOUNDS.maxLat),
    minLng: clamp(minLng - lngPadding, BRAZIL_BOUNDS.minLng, BRAZIL_BOUNDS.maxLng),
    maxLng: clamp(maxLng + lngPadding, BRAZIL_BOUNDS.minLng, BRAZIL_BOUNDS.maxLng),
  };
}

export function projectCoordinate(coordinate: Coordinate, bounds: MapBounds): ProjectedCoordinate {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.1);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.1);

  return {
    x: clamp(((coordinate.lng - bounds.minLng) / lngSpan) * 100, 2, 98),
    y: clamp(((bounds.maxLat - coordinate.lat) / latSpan) * 100, 2, 98),
  };
}
