import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Target, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/pricing";
import {
  listSellerGoals,
  updateSellerGoal,
  deleteSellerGoal,
  type SellerGoal,
} from "@/lib/admin-data.functions";

function monthLabel(month: string) {
  const d = new Date(`${month}T12:00:00`);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const currentMonth = () => `${new Date().toISOString().slice(0, 7)}-01`;

interface Props {
  erpCode: string;
  canManage: boolean;
}

export function SellerGoalsHistory({ erpCode, canManage }: Props) {
  const queryClient = useQueryClient();
  const fetchGoals = useServerFn(listSellerGoals);
  const saveGoal = useServerFn(updateSellerGoal);
  const removeGoal = useServerFn(deleteSellerGoal);

  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [newMonth, setNewMonth] = useState(new Date().toISOString().slice(0, 7));
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);

  const goalsQuery = useQuery({
    queryKey: ["seller-goals", erpCode],
    queryFn: () => fetchGoals({ data: { sellerErpCode: erpCode } }) as Promise<SellerGoal[]>,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["seller-goals", erpCode] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "seller-detail", erpCode] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "sellers"] });
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: { month: string; targetValue: number }) =>
      saveGoal({ data: { sellerErpCode: erpCode, ...input } }),
    onSuccess: async () => {
      toast.success("Meta salva.");
      setEditingMonth(null);
      setAdding(false);
      setNewValue("");
      await invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeGoal({ data: { id } }),
    onSuccess: async () => {
      toast.success("Meta excluída.");
      await invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const goals = goalsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de metas
          </h4>
        </div>
        {canManage && !adding && (
          <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Nova meta
          </Button>
        )}
      </div>

      {canManage && adding && (
        <div className="grid gap-3 rounded-xl border border-dashed p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Input
              type="month"
              value={newMonth}
              onChange={(e) => setNewMonth(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor da meta (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="0,00"
              className="rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="rounded-xl bg-brand-gradient"
              disabled={saveMutation.isPending || !newMonth || newValue === ""}
              onClick={() =>
                saveMutation.mutate({ month: `${newMonth}-01`, targetValue: Number(newValue) })
              }
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
            <Button variant="ghost" className="rounded-xl" onClick={() => setAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {goalsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-xl border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma meta registrada até o momento.
            {canManage ? " Cadastre a primeira meta acima." : " Consulte seu supervisor comercial."}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {goals.map((g) => {
            const isEditing = editingMonth === g.month;
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-32 flex-1">
                  <p className="text-sm font-medium">{monthLabel(g.month)}</p>
                  {g.month === currentMonth() && (
                    <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
                      Mês atual
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      className="h-9 w-36 rounded-xl"
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-xl bg-brand-gradient"
                      disabled={saveMutation.isPending}
                      onClick={() =>
                        saveMutation.mutate({ month: g.month, targetValue: Number(draftValue) })
                      }
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => setEditingMonth(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-base font-semibold tabular-nums">{formatBRL(g.targetValue)}</p>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl"
                          aria-label={`Editar meta de ${monthLabel(g.month)}`}
                          onClick={() => {
                            setEditingMonth(g.month);
                            setDraftValue(String(g.targetValue));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl text-destructive"
                          aria-label={`Excluir meta de ${monthLabel(g.month)}`}
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Excluir a meta de ${monthLabel(g.month)}?`)) {
                              deleteMutation.mutate(g.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
