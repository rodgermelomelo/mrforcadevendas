import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Cabeçalho padrão das telas: título, descrição e ações à direita. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && (
          <div className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground sm:mt-2 sm:line-clamp-none sm:text-sm">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:shrink-0 sm:overflow-visible sm:px-0 [&>*]:shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
