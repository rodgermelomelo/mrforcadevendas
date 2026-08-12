import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Cabeçalho padrão das telas: título, descrição e ações à direita. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {description && (
          <div className="mt-2 text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
