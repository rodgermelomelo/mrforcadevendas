import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { getIsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return false;
      try {
        return await getIsAdmin();
      } catch {
        return false;
      }
    },
  });
}

interface AdminPageProps {
  title: string;
  description: string;
  backTo?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminPage({ title, description, backTo = true, actions, children }: AdminPageProps) {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva para administradores do MR Força de Vendas.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-2">
        {backTo && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Administração
          </Link>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
}

export function Pager({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-sm">
      <span className="text-muted-foreground">
        {total.toLocaleString("pt-BR")} registros · página {page + 1} de {pages.toLocaleString("pt-BR")}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="rounded-xl border border-border px-3 py-1.5 font-medium disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded-xl border border-border px-3 py-1.5 font-medium disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
