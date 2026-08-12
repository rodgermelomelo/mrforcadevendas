import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ExternalLink, Settings2, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionMatrix } from "@/features/admin/permission-matrix";

export interface TeamAccessPanelProps {
  canManageTeams: boolean;
}

export function TeamAccessPanel({ canManageTeams }: TeamAccessPanelProps) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <AccessSummaryCard
          icon={<Users className="h-4 w-4" />}
          title="Membros"
          description="Representantes vinculados à equipe comercial."
        />
        <AccessSummaryCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Responsável"
          description="Gestor que enxerga a equipe pela regra de visibilidade."
        />
        <AccessSummaryCard
          icon={<UserCog className="h-4 w-4" />}
          title="Perfil"
          description="Papel do usuário define módulos e nível de acesso."
        />
      </section>

      <section className="surface-card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-primary">
              <Settings2 className="h-4 w-4" />
              <h2 className="text-lg font-semibold text-foreground">
                Ajustes de acesso por perfil
              </h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              A equipe define quem o responsável enxerga; o perfil define o que ele pode fazer.
            </p>
          </div>
          {canManageTeams && (
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/admin/usuarios">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Gerenciar usuários
              </Link>
            </Button>
          )}
        </div>

        <PermissionMatrix />
      </section>
    </div>
  );
}

function AccessSummaryCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="surface-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
    </article>
  );
}
