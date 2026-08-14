import { useMemo } from "react";
import type { Product } from "@/lib/domain/types";

export interface BrandGroup {
  brand: string;
  items: Product[];
}

type OverrideInput = { categoryName: string; targetBrandName: string }[];

/**
 * Cache em memória da hierarquia (marca > produtos) do catálogo.
 * Evita recalcular o agrupamento a cada troca de visualização (lista <-> pastas)
 * ou remontagem da rota, já que a taxonomia muda muito raramente.
 */
const groupCache = new Map<string, BrandGroup[]>();
const overrideCache = new Map<string, Map<string, string>>();
const MAX_ENTRIES = 12;

function remember<T>(cache: Map<string, T>, key: string, build: () => T): T {
  const hit = cache.get(key);
  if (hit) {
    // Renova a posição (LRU simples).
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = build();
  cache.set(key, value);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return value;
}

/** Mapa CATEGORIA -> MARCA-PAI, memoizado pela assinatura das regras. */
export function useBrandOverrides(taxonomyOverrides: OverrideInput) {
  const signature = useMemo(
    () =>
      taxonomyOverrides
        .map((o) => `${o.categoryName.toUpperCase()}>${o.targetBrandName.toUpperCase()}`)
        .sort()
        .join("|"),
    [taxonomyOverrides],
  );

  return useMemo(
    () =>
      remember(
        overrideCache,
        signature,
        () => new Map(taxonomyOverrides.map((o) => [o.categoryName.toUpperCase(), o.targetBrandName])),
      ),
    // A assinatura é a chave real: taxonomyOverrides muda de referência a cada render do provider.
    [signature],
  );
}

/** Agrupa produtos por marca respeitando as regras de hierarquia, com cache. */
export function useBrandHierarchy(
  products: Product[],
  taxonomyOverrides: OverrideInput,
  cacheKey: string,
): BrandGroup[] {
  const brandOverrides = useBrandOverrides(taxonomyOverrides);

  const signature = useMemo(() => {
    let overrideSig = "";
    brandOverrides.forEach((brand, category) => {
      overrideSig += `${category}>${brand};`;
    });
    return `${cacheKey}::${products.length}::${products[0]?.id ?? ""}::${products[products.length - 1]?.id ?? ""}::${overrideSig}`;
  }, [products, brandOverrides, cacheKey]);

  return useMemo(
    () =>
      remember(groupCache, signature, () => {
        const groups = new Map<string, Product[]>();

        for (const p of products) {
          let brand = p.brand || "Sem Marca";
          const category = (p.category || "").toUpperCase();
          const brandUpper = brand.toUpperCase();

          if (brandOverrides.has(category)) brand = brandOverrides.get(category)!;
          else if (brandOverrides.has(brandUpper)) brand = brandOverrides.get(brandUpper)!;

          const list = groups.get(brand);
          if (list) list.push(p);
          else groups.set(brand, [p]);
        }

        return [...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([brand, items]) => ({
            brand,
            items: items.sort((a, b) => a.name.localeCompare(b.name)),
          }));
      }),
    [signature],
  );
}

/** Limpa o cache (usar após alterar regras de hierarquia no admin). */
export function clearBrandHierarchyCache() {
  groupCache.clear();
  overrideCache.clear();
}
