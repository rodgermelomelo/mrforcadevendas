import { ArrowUpDown, Building2, PackageCheck, Search, Sparkles, Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FilterChipRow } from "./filter-chip-row";
import type { CatalogSort } from "./use-catalog-filters";

export interface CatalogFilterBarProps {
  term: string;
  onTermChange: (term: string) => void;
  sortBy: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
  onlyInStock: boolean;
  onToggleInStock: () => void;
  onlyLaunch: boolean;
  onToggleLaunch: () => void;
  brands: string[];
  groups: string[];
  segments: string[];
  selectedBrands: string[];
  selectedGroups: string[];
  selectedSegments: string[];
  onToggleBrand: (brand: string) => void;
  onToggleGroup: (group: string) => void;
  onToggleSegment: (segment: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  resultCount: number;
}

/** Barra pegajosa de busca, ordenação e filtros do catálogo. */
export function CatalogFilterBar({
  term,
  onTermChange,
  sortBy,
  onSortChange,
  onlyInStock,
  onToggleInStock,
  onlyLaunch,
  onToggleLaunch,
  brands,
  groups,
  segments,
  selectedBrands,
  selectedGroups,
  selectedSegments,
  onToggleBrand,
  onToggleGroup,
  onToggleSegment,
  hasActiveFilters,
  onClearFilters,
  resultCount,
}: CatalogFilterBarProps) {
  return (
    <div className="sticky top-0 z-10 space-y-3 bg-background/80 pb-4 backdrop-blur-md sm:pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
            placeholder="Buscar por nome, código, grupo ou empresa"
            className="h-11 rounded-2xl border-none bg-card px-11 text-sm shadow-soft ring-primary/5 transition-all focus-visible:ring-2"
          />
          {term && (
            <button 
              onClick={() => onTermChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as CatalogSort)}>
            <SelectTrigger className="h-11 w-full rounded-2xl border-none bg-card px-4 text-sm shadow-soft sm:w-[160px]">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Ordenar" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-xl">
              <SelectItem value="relevance">Relevância</SelectItem>
              <SelectItem value="code">Código</SelectItem>
              <SelectItem value="price-asc">Menor Preço</SelectItem>
              <SelectItem value="price-desc">Maior Preço</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Filtros rápidos */}
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={onToggleInStock}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              onlyInStock
                ? "border-transparent bg-success text-white"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <PackageCheck className="h-3 w-3" /> Com estoque
          </button>
          <button
            onClick={onToggleLaunch}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              onlyLaunch
                ? "border-transparent bg-brand-gradient text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="h-3 w-3" /> Lançamentos
          </button>
        </div>

        {/* Chips ativos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 px-1">
            {selectedBrands.map((b) => (
              <Badge
                key={b}
                variant="secondary"
                className="flex items-center gap-1 rounded-lg border-primary/20 bg-primary/10 px-2 py-1 text-[11px] text-primary"
              >
                {b}
                <button onClick={() => onToggleBrand(b)} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedGroups.map((g) => (
              <Badge
                key={g}
                variant="secondary"
                className="flex items-center gap-1 rounded-lg border-primary/20 bg-primary/10 px-2 py-1 text-[11px] text-primary"
              >
                {g}
                <button onClick={() => onToggleGroup(g)} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedSegments.map((s) => (
              <Badge
                key={s}
                variant="secondary"
                className="flex items-center gap-1 rounded-lg border-primary/20 bg-primary/10 px-2 py-1 text-[11px] text-primary"
              >
                {s}
                <button onClick={() => onToggleSegment(s)} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {onlyInStock && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 rounded-lg border-success/20 bg-success/10 px-2 py-1 text-[11px] text-success"
              >
                Com estoque
                <button onClick={onToggleInStock} className="hover:text-success/70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {onlyLaunch && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 rounded-lg border-transparent bg-brand-gradient px-2 py-1 text-[11px] text-white"
              >
                Lançamento
                <button onClick={onToggleLaunch} className="hover:text-white/70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button
              onClick={onClearFilters}
              className="ml-1 text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-primary"
            >
              Limpar tudo
            </button>
          </div>
        )}

        <FilterChipRow
          label="Empresa"
          icon={<Building2 className="h-3 w-3" />}
          options={brands}
          selected={selectedBrands}
          onToggle={onToggleBrand}
        />

        <FilterChipRow
          label="Categoria"
          icon={<Tag className="h-3 w-3" />}
          options={groups}
          selected={selectedGroups}
          onToggle={onToggleGroup}
        />

        <FilterChipRow
          label="Segmento"
          icon={<Search className="h-3 w-3" />}
          options={segments}
          selected={selectedSegments}
          onToggle={onToggleSegment}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {resultCount.toLocaleString("pt-BR")} produtos exibidos
      </p>
    </div>
  );
}
