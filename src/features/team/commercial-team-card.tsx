import { Edit3, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CommercialTeamRow } from "@/lib/team.functions";
import { roleLabel } from "@/lib/domain/roles";

export interface CommercialTeamCardProps {
  team: CommercialTeamRow;
  selected: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

export function CommercialTeamCard({
  team,
  selected,
  canManage,
  onEdit,
  onDelete,
  onSelect,
}: CommercialTeamCardProps) {
  return (
    <article className="surface-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{team.name}</h3>
            {!team.active && <Badge variant="secondary">Inativa</Badge>}
            {selected && <Badge>Filtrando painel</Badge>}
          </div>
          {team.description && (
            <p className="mt-2 text-sm text-muted-foreground">{team.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onEdit}>
              <Edit3 className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Apagar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Metric label="Representantes" value={String(team.sellerCount)} />
        <Metric label="Clientes ativos" value={team.customerCount.toLocaleString("pt-BR")} />
        <Metric label="Status" value={team.active ? "Ativa" : "Inativa"} />
      </div>

      <ResponsibleBlock team={team} />
      <MembersList team={team} />

      <div className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          O responsável enxerga estes representantes quando a equipe está ativa. O alcance final
          ainda respeita o perfil de acesso do usuário.
        </p>
      </div>

      <Button
        type="button"
        variant={selected ? "secondary" : "outline"}
        className="w-full rounded-xl"
        onClick={onSelect}
      >
        <Users className="mr-1.5 h-4 w-4" />
        {selected ? "Ver todas as equipes" : "Filtrar painel por equipe"}
      </Button>
    </article>
  );
}

function ResponsibleBlock({ team }: { team: CommercialTeamRow }) {
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Responsável
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">{team.leaderName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {team.leaderEmail ?? "sem e-mail"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {team.leaderRoles.length > 0 ? (
              team.leaderRoles.map((role) => (
                <Badge key={`${team.id}-${role}`} variant="outline">
                  {roleLabel(role)}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">Sem perfil</Badge>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MembersList({ team }: { team: CommercialTeamRow }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Membros da equipe
        </p>
        <Badge variant="secondary">{team.members.length}</Badge>
      </div>
      <div className="max-h-56 divide-y divide-border overflow-y-auto">
        {team.members.map((member) => (
          <div
            key={`${team.id}-${member.erpCode}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{member.name}</p>
              <p className="text-xs text-muted-foreground">
                {member.erpCode} · {member.customerCount.toLocaleString("pt-BR")} clientes
              </p>
            </div>
            <Badge variant={member.active ? "outline" : "secondary"}>
              {member.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
