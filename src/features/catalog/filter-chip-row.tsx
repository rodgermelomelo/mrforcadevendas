import { cn } from "@/lib/utils";

export interface FilterChipRowProps<T extends string = string> {
  label: string;
  icon: React.ReactNode;
  options: T[];
  selected: T[];
  onToggle: (option: T) => void;
}

/** Linha rolável de chips de filtro (marcas ou categorias). */
export function FilterChipRow<T extends string = string>({
  label,
  icon,
  options,
  selected,
  onToggle,
}: FilterChipRowProps<T>) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {icon} {label}
      </p>
      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onToggle(option)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
              selected.includes(option)
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
