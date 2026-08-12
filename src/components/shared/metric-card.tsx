import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";

export interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string | undefined;
  /** Percentual 0-100. Quando informado, renderiza a barra de progresso. */
  progress?: number | undefined;
  /**
   * `dashboard` (padrão) destaca o ícone num badge colorido.
   * `compact` usa o ícone inline, para grades densas.
   */
  variant?: "dashboard" | "compact";
}

export function MetricCard({
  icon,
  label,
  value,
  hint,
  progress,
  variant = "dashboard",
}: MetricCardProps) {
  if (variant === "compact") {
    return (
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        {progress !== undefined && <Progress value={progress} className="mt-3 h-1.5" />}
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      {progress !== undefined && <Progress value={progress} className="mt-3 h-1.5" />}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
