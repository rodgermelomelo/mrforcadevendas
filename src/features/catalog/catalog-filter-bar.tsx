import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowUpDown, Building2, PackageCheck, Search, Sparkles, Tag, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
  selectedBrands: string[];
  selectedGroups: string[];
  onToggleBrand: (brand: string) => void;
  onToggleGroup: (group: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  resultCount: number;
}

/** Barra de busca otimizada com filtros em popover para economizar espaço vertical. */
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
  selectedBrands,
  selectedGroups,
  onToggleBrand,
  onToggleGroup,
  hasActiveFilters,
  onClearFilters,
  resultCount,
}: CatalogFilterBarProps) {
  const isMobile = useIsMobile();
  const activeCount =
    selectedBrands.length + selectedGroups.length + (onlyInStock ? 1 : 0) + (onlyLaunch ? 1 : 0);

  const panel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Filtros</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground transition-colors hover:text-destructive"
          >
            Limpar tudo
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={onToggleInStock}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[11px] font-semibold transition-all",
              onlyInStock
                ? "border-transparent bg-success text-white shadow-md"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30",
            )}
          >
            <PackageCheck className="h-3.5 w-3.5" /> Estoque
          </button>
          <button
            onClick={onToggleLaunch}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[11px] font-semibold transition-all",
              onlyLaunch
                ? "border-transparent bg-brand-gradient text-white shadow-md"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" /> Lançamentos
          </button>
        </div>

        <FilterChipRow
          label="Empresa"
          icon={<Building2 className="h-3 w-3" />}
          options={brands}
          selected={selectedBrands}
          onToggle={onToggleGroup}
        />

        <FilterChipRow
          label="Categoria"
          icon={<Tag className="h-3 w-3" />}
          options={groups}
          selected={selectedGroups}
          onToggle={onToggleBrand}
        />
      </div>
    </div>
  );

  const filterTrigger = (
    <Button
      variant="ghost"
      className={cn(
        "h-11 flex-1 rounded-2xl border-none bg-card px-4 shadow-soft transition-all hover:bg-muted sm:flex-none",
        hasActiveFilters && "text-primary ring-2 ring-primary/20",
      )}
    >
      <SlidersHorizontal className="mr-2 h-4 w-4" />
      <span className="text-xs font-semibold">Filtros</span>
      {hasActiveFilters && (
        <Badge className="ml-2 h-5 min-w-5 justify-center rounded-full bg-primary p-0 text-[10px] font-bold text-primary-foreground">
          {activeCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <div className="sticky top-14 z-20 -mx-4 space-y-3 border-b border-border/50 bg-background/90 px-4 pb-3 pt-2 backdrop-blur-md sm:mx-0 sm:border-none sm:px-0 lg:top-0 lg:pb-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        {/* Busca */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
            placeholder="Buscar produtos..."
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
          {/* Ordenação */}
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as CatalogSort)}>
            <SelectTrigger className="h-11 flex-1 rounded-2xl border-none bg-card px-4 text-xs font-medium shadow-soft sm:w-[140px] sm:flex-none">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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

          {/* Filtros avançados: folha inferior no mobile, popover no desktop */}
          {isMobile ? (
            <Sheet>
              <SheetTrigger asChild>{filterTrigger}</SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[85svh] overflow-y-auto rounded-t-3xl border-none pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="pt-2">{panel}</div>
              </SheetContent>
            </Sheet>
          ) : (
            <Popover>
              <PopoverTrigger asChild>{filterTrigger}</PopoverTrigger>
              <PopoverContent className="w-[320px] rounded-3xl border-none p-5 shadow-2xl" align="end">
                {panel}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>


      {/* Chips de filtros ativos (linha única e discreta) */}
      {hasActiveFilters && (
        <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto px-1">
          {selectedBrands.map((b) => (
            <Badge
              key={b}
              variant="secondary"
              className="flex shrink-0 items-center gap-1 rounded-full border-primary/10 bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary shadow-sm"
            >
              {b}
              <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100" onClick={() => onToggleBrand(b)} />
            </Badge>
          ))}
          {selectedGroups.map((g) => (
            <Badge
              key={g}
              variant="secondary"
              className="flex shrink-0 items-center gap-1 rounded-full border-primary/10 bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary shadow-sm"
            >
              {g}
              <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100" onClick={() => onToggleGroup(g)} />
            </Badge>
          ))}
          {onlyInStock && (
            <Badge
              variant="secondary"
              className="flex shrink-0 items-center gap-1 rounded-full border-success/10 bg-success/5 px-2.5 py-1 text-[10px] font-bold text-success shadow-sm"
            >
              Estoque
              <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100" onClick={onToggleInStock} />
            </Badge>
          )}
          {onlyLaunch && (
            <Badge
              variant="secondary"
              className="flex shrink-0 items-center gap-1 rounded-full bg-brand-gradient px-2.5 py-1 text-[10px] font-bold text-white shadow-md"
            >
              Lançamento
              <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100" onClick={onToggleLaunch} />
            </Badge>
          )}
        </div>
      )}

      {/* Totalizador discreto */}
      <div className="flex items-center justify-between px-1 opacity-60">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {resultCount.toLocaleString("pt-BR")} PRODUTOS
        </p>
      </div>
    </div>
  );
}
