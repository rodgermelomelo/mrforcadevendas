import type { Product } from "@/lib/domain/types";
import { resolveProductImage } from "@/lib/product-images";
import type { BrandGroup } from "./use-brand-hierarchy";

export interface SubcategoryGroup {
  category: string;
  items: Product[];
}

const subcategoryCache = new Map<string, SubcategoryGroup[]>();
const prefetchedBrands = new Set<string>();
const prefetchedImages = new Set<string>();

/** Quantos itens da pasta têm imagem pré-carregada (os primeiros visíveis). */
const IMAGE_PREFETCH_COUNT = 12;
/** Quantas pastas vizinhas são aquecidas junto (as mais prováveis a seguir). */
const NEIGHBOR_RADIUS = 1;

/** Agrupa (com cache) os produtos de uma marca por subcategoria. */
export function getSubcategoryGroups(brand: string, items: Product[]): SubcategoryGroup[] {
  const key = `${brand}::${items.length}::${items[0]?.id ?? ""}::${items[items.length - 1]?.id ?? ""}`;
  const hit = subcategoryCache.get(key);
  if (hit) return hit;

  const map = new Map<string, Product[]>();
  for (const product of items) {
    const category = (product.category ?? "").trim().toUpperCase() || "GERAL";
    const bucket = map.get(category);
    if (bucket) bucket.push(product);
    else map.set(category, [product]);
  }
  const groups = [...map.entries()]
    .map(([category, list]) => ({ category, items: list }))
    .sort((a, b) => a.category.localeCompare(b.category, "pt-BR"));

  subcategoryCache.set(key, groups);
  return groups;
}

function warmImages(items: Product[]) {
  if (typeof window === "undefined") return;
  for (const product of items.slice(0, IMAGE_PREFETCH_COUNT)) {
    const src = resolveProductImage(product);
    if (!src || prefetchedImages.has(src)) continue;
    prefetchedImages.add(src);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}

function warmGroup(group: BrandGroup) {
  if (prefetchedBrands.has(group.brand)) return;
  prefetchedBrands.add(group.brand);
  getSubcategoryGroups(group.brand, group.items);
  warmImages(group.items);
}

/**
 * Aquece a pasta indicada e as vizinhas mais prováveis:
 * calcula as subcategorias e pré-carrega as imagens dos primeiros itens.
 */
export function prefetchBrandFolder(groups: BrandGroup[], brand: string) {
  const index = groups.findIndex((g) => g.brand === brand);
  if (index < 0) return;

  const run = () => {
    warmGroup(groups[index]!);
    for (let offset = 1; offset <= NEIGHBOR_RADIUS; offset++) {
      const before = groups[index - offset];
      const after = groups[index + offset];
      if (after) warmGroup(after);
      if (before) warmGroup(before);
    }
  };

  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 0);
}

/** Aquece várias pastas de uma vez (ex.: as abertas por padrão em uma busca). */
export function prefetchBrandFolders(groups: BrandGroup[], brands: string[]) {
  for (const brand of brands) prefetchBrandFolder(groups, brand);
}

export function clearBrandFolderPrefetchCache() {
  subcategoryCache.clear();
  prefetchedBrands.clear();
}
