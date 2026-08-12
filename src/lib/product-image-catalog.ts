export type CatalogAssetKey = "base" | "batom" | "esmalte" | "skincare";

export interface ProductImageCandidate {
  erpCode: string;
  name: string;
  brand?: string | null | undefined;
  category?: string | null | undefined;
  group?: string | null | undefined;
  groupCode?: string | null | undefined;
  imageUrl?: string | null | undefined;
}

const DAILUS_BASE_IMAGES = {
  D2: "https://www.dailus.com.br/cdn/shop/files/7894222029641_1_1.png?v=1751495665&width=1946",
  D3: "https://www.dailus.com.br/cdn/shop/files/7894222029658_1.png?v=1751497617&width=1946",
  D4: "https://www.dailus.com.br/cdn/shop/files/7894222029665_1.png?v=1751496842&width=1946",
  D5: "https://www.dailus.com.br/cdn/shop/files/7894222029672_1.png?v=1751497072&width=1946",
  D6: "https://www.dailus.com.br/cdn/shop/files/7894222029689_1_1.png?v=1751496009&width=1946",
  D7: "https://www.dailus.com.br/cdn/shop/files/7894222029696_1.png?v=1751497209&width=1946",
  D8: "https://www.dailus.com.br/cdn/shop/files/7894222029702_1.png?v=1751497320&width=1946",
  D9: "https://www.dailus.com.br/cdn/shop/files/7894222029719_1.png?v=1751497425&width=1946",
  D10: "https://www.dailus.com.br/cdn/shop/files/7894222029726_1.png?v=1751496144&width=1946",
  D11: "https://www.dailus.com.br/cdn/shop/files/7894222029733_1_1.png?v=1751496266&width=1946",
  D12: "https://www.dailus.com.br/cdn/shop/files/7894222029740_1.png?v=1751496388&width=1946",
} as const;

type DailusBaseShade = keyof typeof DAILUS_BASE_IMAGES;

const DAILUS_LAPISEIRA_CLARO =
  "https://www.dailus.com.br/cdn/shop/files/7894222027821_1.webp?v=1753124775&width=1445";
const DAILUS_LAPISEIRA_MEDIO =
  "https://www.dailus.com.br/cdn/shop/files/7894222027838_1.webp?v=1753124774&width=1445";
const DAILUS_LAPISEIRA_ESCURO =
  "https://www.dailus.com.br/cdn/shop/files/7894222027845_1--1.webp?v=1753124773&width=1445";
const DAILUS_ESMALTE_COLAR_PEROLA =
  "https://www.dailus.com.br/cdn/shop/files/7894222010373_4.webp?v=1776548433&width=1946";
const DAILUS_REMOVEDOR =
  "https://www.dailus.com.br/cdn/shop/files/7894222030968_1_1.png?v=1754147237&width=1946";

const ACEMAR_SEM_ACETONA_UVA =
  "https://soneda.fbitsstatic.net/img/p/removedor-de-esmaltes-sem-acetona-acemar-uva-180ml-163185/350282.jpg?h=1000&v=202602112042&w=1000";
const ACEMAR_SEM_ACETONA_MORANGO =
  "https://soneda.fbitsstatic.net/img/p/removedor-de-esmaltes-sem-acetona-acemar-morango-180ml-163176/350273.jpg?h=1000&v=202602112040&w=1000";
const ACEMAR_SEM_ACETONA_NEUTRO =
  "https://tdc0tj.vtexassets.com/arquivos/ids/196038/70341386040.jpg?v=638609720772530000";
const ACEMAR_ACETONA_100 =
  "https://www.arenaatacado.com.br/on/demandware.static/-/Sites-storefront-catalog-sv/default/dw5d772479/Produtos/1010140-0070341071861-solucao%20acetona%20de%20esmalte%20acemar%20pro%20100ml-acemar-1.jpg";
const ACEMAR_ACETONA_500 =
  "https://acdn-us.mitiendanube.com/stores/844/547/products/acetona-acemar-9f689ec5a205a8bbbb17158680618220-1024-1024.webp";
const ACEMAR_SPRAY_SECANTE =
  "https://www.conexaodistribuidora.com.br/14102-large_default/secante-esmalte-acemar-400ml-spray-oleo-de-cravo.webp";
const ACEMAR_GOTA_SECANTE =
  "https://images.tcdn.com.br/img/img_prod/1017481/secante_de_esmalte_oleo_de_cravo_10ml_acemar_41363_1_b7da45d41828a30b565b6fa4dc97e363.jpg";

export const KNOWN_EXTERNAL_PRODUCT_IMAGE_URLS: Record<string, string> = {
  "001845": DAILUS_ESMALTE_COLAR_PEROLA,
  "003874": DAILUS_LAPISEIRA_ESCURO,
  "003875": DAILUS_LAPISEIRA_MEDIO,
  "003876": DAILUS_LAPISEIRA_CLARO,
  "003953": DAILUS_BASE_IMAGES.D2,
  "003954": DAILUS_BASE_IMAGES.D3,
  "003955": DAILUS_BASE_IMAGES.D4,
  "003956": DAILUS_BASE_IMAGES.D5,
  "003957": DAILUS_BASE_IMAGES.D6,
  "003958": DAILUS_BASE_IMAGES.D7,
  "003959": DAILUS_BASE_IMAGES.D8,
  "003960": DAILUS_BASE_IMAGES.D9,
  "003961": DAILUS_BASE_IMAGES.D10,
  "003962": DAILUS_BASE_IMAGES.D11,
  "003963": DAILUS_BASE_IMAGES.D12,
  "004077": DAILUS_REMOVEDOR,

  "004117": ACEMAR_ACETONA_100,
  "004118": ACEMAR_ACETONA_100,
  "004119": ACEMAR_ACETONA_500,
  "004494": ACEMAR_SEM_ACETONA_UVA,
  "004495": ACEMAR_SEM_ACETONA_MORANGO,
  "004496": ACEMAR_SEM_ACETONA_NEUTRO,
  "004497": ACEMAR_SEM_ACETONA_UVA,
  "004498": ACEMAR_SEM_ACETONA_MORANGO,
  "004499": ACEMAR_SEM_ACETONA_NEUTRO,
  "004500": ACEMAR_SEM_ACETONA_UVA,
  "004501": ACEMAR_SEM_ACETONA_MORANGO,
  "004502": ACEMAR_SEM_ACETONA_NEUTRO,
  "004518": ACEMAR_ACETONA_100,
  "004519": ACEMAR_ACETONA_100,
  "004520": ACEMAR_ACETONA_500,
  "004749": ACEMAR_SPRAY_SECANTE,
  "004750": ACEMAR_GOTA_SECANTE,
  "005029": ACEMAR_SPRAY_SECANTE,
  "005030": ACEMAR_GOTA_SECANTE,
};

const KNOWN_PRODUCT_ASSET_KEYS: Record<string, CatalogAssetKey> = {
  "000080": "batom",
  "000298": "esmalte",
  "004682": "esmalte",
  "005210": "esmalte",
};

export function normalizeCatalogText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function productImageSearchText(product: ProductImageCandidate): string {
  return normalizeCatalogText(
    [
      product.erpCode,
      product.name,
      product.brand,
      product.category,
      product.group,
      product.groupCode,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function includesAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}

function baseShadeFrom(text: string): string | null {
  const match = text.match(/\bD\s*(1[0-2]|[2-9])\b/);
  return match ? `D${match[1]}` : null;
}

function isDailusBaseShade(value: string | null): value is DailusBaseShade {
  return Boolean(value && value in DAILUS_BASE_IMAGES);
}

function isDailus(product: ProductImageCandidate, text: string): boolean {
  return normalizeCatalogText(product.brand) === "DAILUS" || text.includes("DAILUS");
}

function isAcemar(product: ProductImageCandidate, text: string): boolean {
  return normalizeCatalogText(product.brand) === "ACEMAR" || text.includes("ACEMAR");
}

export function knownExternalProductImageUrl(product: ProductImageCandidate): string | null {
  const code = String(product.erpCode ?? "").trim();
  const direct = KNOWN_EXTERNAL_PRODUCT_IMAGE_URLS[code];
  if (direct) return direct;

  const text = productImageSearchText(product);
  if (isDailus(product, text)) {
    const shade = baseShadeFrom(text);
    if (isDailusBaseShade(shade)) return DAILUS_BASE_IMAGES[shade];
    if (text.includes("LAPISEIRA") && text.includes("SOBRANCELHA")) {
      if (text.includes("CLARO")) return DAILUS_LAPISEIRA_CLARO;
      if (text.includes("MEDIO")) return DAILUS_LAPISEIRA_MEDIO;
      if (text.includes("ESCURO")) return DAILUS_LAPISEIRA_ESCURO;
    }
    if (text.includes("COLAR DE PEROLA")) return DAILUS_ESMALTE_COLAR_PEROLA;
    if (text.includes("REMOVEDOR") && text.includes("ESMALTE")) return DAILUS_REMOVEDOR;
  }

  if (isAcemar(product, text)) {
    if (text.includes("SPRAY SECANTE")) return ACEMAR_SPRAY_SECANTE;
    if (text.includes("GOTA SECANTE")) return ACEMAR_GOTA_SECANTE;
    if (text.includes("UVA")) return ACEMAR_SEM_ACETONA_UVA;
    if (text.includes("MORANGO")) return ACEMAR_SEM_ACETONA_MORANGO;
    if (text.includes("NEUTRO")) return ACEMAR_SEM_ACETONA_NEUTRO;
    if (text.includes("500")) return ACEMAR_ACETONA_500;
    if (text.includes("ACETONA") || text.includes("REMOVEDOR")) return ACEMAR_ACETONA_100;
  }

  return null;
}

export function fallbackProductImageAssetKey(
  product: ProductImageCandidate,
): CatalogAssetKey | null {
  const directAsset = KNOWN_PRODUCT_ASSET_KEYS[String(product.erpCode ?? "").trim()];
  if (directAsset) return directAsset;

  const text = productImageSearchText(product);

  if (includesAny(text, ["BASE", "CORRETIVO", "PO COMPACTO", "PO SOLTO"])) return "base";
  if (includesAny(text, ["BATOM", "BOCA", "LABIAL", "GLOSS", "LAPISEIRA", "SOBRANCELHA"]))
    return "batom";
  if (includesAny(text, ["ESMALTE", "UNHA", "REMOVEDOR", "ACETONA", "SECANTE", "OLEO P/ESMALTE"]))
    return "esmalte";
  if (includesAny(text, ["SKIN", "CREME", "HIDRATANTE", "SABONETE", "MANTEIGA"])) return "skincare";
  if (isAcemar(product, text)) return "esmalte";
  if (isDailus(product, text)) return "batom";

  return null;
}

export function catalogProductImageRef(product: ProductImageCandidate): string | null {
  if (product.imageUrl) return product.imageUrl;
  const externalUrl = knownExternalProductImageUrl(product);
  if (externalUrl) return externalUrl;
  const assetKey = fallbackProductImageAssetKey(product);
  return assetKey ? `asset:${assetKey}` : null;
}
