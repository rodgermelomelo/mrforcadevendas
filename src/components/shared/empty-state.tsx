import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string | undefined;
  icon?: ReactNode;
  /** Ações opcionais (ex.: limpar filtros). */
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-12 text-center">
      {icon && <div className="mb-3 flex justify-center text-muted-foreground/50">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
