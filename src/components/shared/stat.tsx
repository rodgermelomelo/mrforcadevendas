import { cn } from "@/lib/utils";

export interface StatProps {
  label: string;
  value: string;
  tone?: "warning" | "success" | "destructive" | undefined;
}

/** Par rótulo/valor usado em listas de indicadores densos. */
export function Stat({ label, value, tone }: StatProps) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
