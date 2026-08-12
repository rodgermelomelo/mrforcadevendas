import { useCallback, useEffect, useMemo, useState } from "react";
import { resolvePrice } from "@/lib/pricing";
import type { Product } from "@/lib/domain/types";
import type { PriceTable } from "@/lib/domain/types";

export type CatalogSort = "relevance" | "code" | "price-asc" | "price-desc";

export interface BrandMetadataEntry {
  isCategory?: boolean;
  parentBrand?: string | null;
}

export const CATALOG_PAGE_SIZE = 20;

interface UseCatalogFiltersParams {
  products: Product[];
  brandMetadata: Record<string, BrandMetadataEntry>;
  table: PriceTable | undefined;
  pageSize?: number;
}

/**
 * Regras de busca, filtro por marca/categoria, ordenação e paginação do catálogo.
 * Mantém a rota livre de lógica: ela apenas consome o retorno deste hook.
 */
export function useCatalogFilters({
  products,
  brandMetadata,
  table,
  pageSize = CATALOG_PAGE_SIZE,
}: UseCatalogFiltersParams) {
  const [term, setTerm] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [onlyLaunch, setOnlyLaunch] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState<CatalogSort>("relevance");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const result = products.filter((p) => {
      const pCategory = p.category || p.group;

      // Filtro de marca e categoria vinculada
      if (selectedBrands.length > 0) {
        const brandName = p.brand;
        if (!brandName) return false;

        const metadata = brandMetadata[brandName];
        const isExactBrandSelected = selectedBrands.includes(brandName);
        const isParentBrandSelected =
          metadata?.isCategory && metadata?.parentBrand && selectedBrands.includes(metadata.parentBrand);

        if (!isExactBrandSelected && !isParentBrandSelected) return false;
      }

      // Se houver grupos (categorias) selecionados, o produto deve pertencer a um deles
      if (selectedGroups.length > 0) {
        const brandName = p.brand;
        const isGroupSelected =
          (brandName && selectedGroups.includes(brandName)) || selectedGroups.includes(pCategory);
        if (!isGroupSelected) return false;
      }

      if (onlyLaunch && !p.isLaunch) return false;
      if (onlyInStock && p.stock <= 0) return false;
      if (!q) return true;
      return `${p.name} ${p.erpCode} ${pCategory} ${p.brand || ""}`.toLowerCase().includes(q);
    });

    return result.sort((a, b) => {
      if (sortBy === "code") return a.erpCode.localeCompare(b.erpCode);
      if (sortBy.startsWith("price")) {
        const resA = resolvePrice(a, table);
        const resB = resolvePrice(b, table);
        const pA = resA.ok ? resA.value : 0;
        const pB = resB.ok ? resB.value : 0;
        return sortBy === "price-asc" ? pA - pB : pB - pA;
      }
      // relevância (padrão): produtos com estoque primeiro, depois lançamentos, depois código
      const availA = a.stock > 0 ? 1 : 0;
      const availB = b.stock > 0 ? 1 : 0;
      if (availA !== availB) return availB - availA;
      if (a.isLaunch !== b.isLaunch) return a.isLaunch ? -1 : 1;
      return a.erpCode.localeCompare(b.erpCode);
    });
  }, [term, selectedGroups, selectedBrands, onlyLaunch, onlyInStock, products, sortBy, table, brandMetadata]);

  const pagedItems = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page, pageSize]);
  const hasMore = pagedItems.length < filtered.length;

  useEffect(() => {
    setPage(1);
  }, [term, selectedGroups, selectedBrands, onlyLaunch, onlyInStock, sortBy]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    setTimeout(() => {
      setPage((prev) => prev + 1);
      setLoading(false);
    }, 400);
  }, [loading, hasMore]);

  /** Marcas principais disponíveis (categorias sobem para a marca pai). */
  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const brandName = p.brand;
      if (!brandName) return;

      const metadata = brandMetadata[brandName];
      if (metadata?.isCategory && metadata?.parentBrand) {
        set.add(metadata.parentBrand);
      } else if (!metadata?.isCategory) {
        set.add(brandName);
      }
    });
    return Array.from(set).sort();
  }, [products, brandMetadata]);

  /** Categorias disponíveis considerando as marcas atualmente selecionadas. */
  const groups = useMemo(() => {
    const availableGroups = new Set<string>();

    products.forEach((p) => {
      const brandName = p.brand;
      if (!brandName) return;

      const metadata = brandMetadata[brandName];
      const parentBrand = metadata?.parentBrand;

      const isRelevant =
        selectedBrands.length === 0 ||
        selectedBrands.includes(brandName) ||
        (parentBrand ? selectedBrands.includes(parentBrand) : false);

      if (isRelevant) {
        if (metadata?.isCategory) {
          availableGroups.add(brandName);
        } else {
          const pCategory = p.category || p.group;
          if (pCategory) availableGroups.add(pCategory);
        }
      }
    });
    return Array.from(availableGroups).sort();
  }, [products, selectedBrands, brandMetadata]);

  const toggleBrand = useCallback((brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((i) => i !== brand) : [...prev, brand],
    );
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((i) => i !== group) : [...prev, group],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedBrands([]);
    setSelectedGroups([]);
    setOnlyLaunch(false);
    setOnlyInStock(false);
    setTerm("");
  }, []);

  const hasActiveFilters =
    selectedBrands.length > 0 ||
    selectedGroups.length > 0 ||
    onlyLaunch ||
    onlyInStock ||
    term !== "";

  return {
    // estado
    term,
    setTerm,
    sortBy,
    setSortBy,
    selectedBrands,
    selectedGroups,
    onlyLaunch,
    setOnlyLaunch,
    onlyInStock,
    setOnlyInStock,
    // dados derivados
    brands,
    groups,
    filtered,
    pagedItems,
    hasMore,
    loading,
    hasActiveFilters,
    // ações
    toggleBrand,
    toggleGroup,
    clearFilters,
    loadMore,
  };
}
