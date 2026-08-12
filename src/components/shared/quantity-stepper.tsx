import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  size?: "sm" | "md";
  className?: string;
}

/** Seletor numérico de quantidade reutilizado no catálogo, no modal e no carrinho. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  size = "sm",
  className,
}: QuantityStepperProps) {
  const dimension = size === "md" ? "h-10 w-10" : "h-9 w-8";
  const inputWidth = size === "md" ? "w-12 text-base" : "w-9 text-sm";

  return (
    <div
      className={cn(
        "flex items-center rounded-xl border border-border",
        size === "md" && "bg-card shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "grid place-items-center text-muted-foreground transition-colors hover:text-foreground",
          dimension,
        )}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Diminuir quantidade"
      >
        <Minus className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>
      <input
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value.replace(/\D/g, "")) || min))}
        inputMode="numeric"
        className={cn("bg-transparent text-center font-semibold outline-hidden", inputWidth, size === "md" && "font-bold")}
        aria-label="Quantidade"
      />
      <button
        type="button"
        className={cn(
          "grid place-items-center text-muted-foreground transition-colors hover:text-foreground",
          dimension,
        )}
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar quantidade"
      >
        <Plus className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>
    </div>
  );
}
