import { cn } from "@/lib/utils";

export interface FilterChipRowProps<T extends string = string> {
  label: string;
  icon: React.ReactNode;
  options: T[];
  selected: T[];
  onToggle: (option: T) => void;
}

/** Grade de chips de filtro otimizada para visualização em popover. */
export function FilterChipRow<T extends string = string>({
  label,
  icon,
  options,
  selected,
  onToggle,
}: FilterChipRowProps<T>) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onToggle(option)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95",
              selected.includes(option)
                ? "border-transparent bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
