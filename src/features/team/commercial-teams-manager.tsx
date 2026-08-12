import { useState } from "react";
import { AlertTriangle, Edit3, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TeamFormDialog, type TeamFormState } from "@/features/team/commercial-team-form-dialog";
import type { CommercialTeamRow, CommercialTeamsPayload } from "@/lib/team.functions";

export interface CommercialTeamsManagerProps {
  payload: CommercialTeamsPayload | undefined;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  error?: string | undefined;
  onSave: (input: TeamFormState) => void;
  onDelete: (teamId: string) => void;
  onSelectTeam: (teamId: string | undefined) => void;
  selectedTeamId?: string | undefined;
}

const emptyForm: TeamFormState = {
  name: "",
  description: "",
  leaderUserId: "",
  sellerCodes: [],
  active: true,
};

export function CommercialTeamsManager({
  payload,
  loading,
  saving,
  deleting,
  error,
  onSave,
  onDelete,
  onSelectTeam,
  selectedTeamId,
}: CommercialTeamsManagerProps) {
  const [form, setForm] = useState<TeamFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommercialTeamRow | null>(null);

  if (loading) {
    return (
      <div className="grid min-h-40 place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const teams = payload?.teams ?? [];
  const canManage = payload?.canManageTeams ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Equipes comerciais</h2>
          <p className="text-sm text-muted-foreground">
            Organize líderes e representantes para gestão de carteiras, metas e aprovações.
          </p>
        </div>
        {canManage && (
          <Button type="button" className="rounded-xl" onClick={() => setForm(emptyForm)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova equipe
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <EmptyState
          title="Nenhuma equipe cadastrada"
          description="Crie equipes como Time Edmilson ou Time Luciano para separar líderes e carteiras."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              selected={team.id === selectedTeamId}
              canManage={canManage}
              onEdit={() => setForm(toForm(team))}
              onDelete={() => setDeleteTarget(team)}
              onSelect={() => onSelectTeam(team.id === selectedTeamId ? undefined : team.id)}
            />
          ))}
        </div>
      )}

      <TeamFormDialog
        form={form}
        users={payload?.users ?? []}
        sellers={payload?.sellers ?? []}
        saving={saving}
        onChange={setForm}
        onClose={() => setForm(null)}
        onSubmit={() => form && onSave(form)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Apagar equipe?</DialogTitle>
            <DialogDescription>
              A equipe será removida, mas os representantes e pedidos continuam preservados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setDeleteTarget(null)}>
              Voltar
            </Button>
            <Button
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteTarget && onDelete(deleteTarget.id)}
            >
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamCard({
  team,
  selected,
  canManage,
  onEdit,
  onDelete,
  onSelect,
}: {
  team: CommercialTeamRow;
  selected: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  return (
    <article className="surface-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{team.name}</h3>
            {!team.active && <Badge variant="secondary">Inativa</Badge>}
            {selected && <Badge>Filtrando painel</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Líder: <span className="font-medium text-foreground">{team.leaderName}</span>
            {team.leaderEmail && ` · ${team.leaderEmail}`}
          </p>
          {team.description && <p className="mt-2 text-sm text-muted-foreground">{team.description}</p>}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onEdit}>
              <Edit3 className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl text-destructive" onClick={onDelete}>
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

      <div className="flex flex-wrap gap-2">
        {team.sellerNames.slice(0, 8).map((name, index) => (
          <Badge key={`${team.id}-${name}-${index}`} variant="outline">
            {name}
          </Badge>
        ))}
        {team.sellerNames.length > 8 && <Badge variant="secondary">+{team.sellerNames.length - 8}</Badge>}
      </div>

      <Button type="button" variant={selected ? "secondary" : "outline"} className="w-full rounded-xl" onClick={onSelect}>
        <Users className="mr-1.5 h-4 w-4" />
        {selected ? "Ver todas as equipes" : "Filtrar painel por equipe"}
      </Button>
    </article>
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

function toForm(team: CommercialTeamRow): TeamFormState {
  return {
    teamId: team.id,
    name: team.name,
    description: team.description,
    leaderUserId: team.leaderUserId ?? "",
    sellerCodes: team.sellerCodes,
    active: team.active,
  };
}
