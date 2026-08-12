import { useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
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
import { CommercialTeamCard } from "@/features/team/commercial-team-card";
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
            <CommercialTeamCard
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
              {deleting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
