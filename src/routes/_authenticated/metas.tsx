import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Layers3,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Tags,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  deleteGoalTarget,
  getGoalsWorkspace,
  saveGoalTarget,
  type GoalMetricRow,
  type GoalOption,
  type GoalScope,
  type GoalTargetSource,
  type GoalsWorkspace,
} from "@/lib/goals.functions";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas comerciais · MR Força de Vendas" },
      {
        name: "description",
        content: "Acompanhe metas por representante, equipe, marca, categoria e produto.",
      },
    ],
  }),
  component: GoalsPage,
});

const GLOBAL_REF = "__global__";

const scopeLabels: Record<GoalScope, string> = {
  global: "Geral",
  representative: "Representante",
  team: "Equipe",
  brand: "Marca",
  category: "Categoria",
  product: "Produto",
};

const scopeOptions: { value: GoalScope; label: string }[] = [
  { value: "global", label: "Geral" },
  { value: "representative", label: "Representante" },
  { value: "team", label: "Equipe" },
  { value: "brand", label: "Marca" },
  { value: "category", label: "Categoria" },
  { value: "product", label: "Produto" },
];

type DraftState = {
  id: string;
  source: GoalTargetSource;
  scope: GoalScope;
  scopeRef: string;
  targetValue: string;
  notes: string;
};

const emptyDraft: DraftState = {
  id: "",
  source: null,
  scope: "global",
  scopeRef: GLOBAL_REF,
  targetValue: "",
  notes: "",
};

function monthLabel(month: string) {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function parseTargetValue(value: string) {
  const text = value.trim();
  const normalized =
    text.includes(",") && text.includes(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function optionsForScope(data: GoalsWorkspace | undefined, scope: GoalScope): GoalOption[] {
  if (!data) return [];
  if (scope === "representative") return data.options.representatives;
  if (scope === "team") return data.options.teams;
  if (scope === "brand") return data.options.brands;
  if (scope === "category") return data.options.categories;
  if (scope === "product") return data.options.products;
  return [];
}

function GoalsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const loadGoals = useServerFn(getGoalsWorkspace);
  const saveGoal = useServerFn(saveGoalTarget);
  const removeGoal = useServerFn(deleteGoalTarget);

  const goalsQuery = useQuery({
    queryKey: ["goals-workspace", month],
    queryFn: () => loadGoals({ data: { month } }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["goals-workspace"] });
    await queryClient.invalidateQueries({ queryKey: ["team-overview"] });
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    if (draft.scope === "representative" && draft.scopeRef) {
      await queryClient.invalidateQueries({ queryKey: ["seller-goals", draft.scopeRef] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const targetValue = parseTargetValue(draft.targetValue);
      if (!Number.isFinite(targetValue) || targetValue < 0) {
        throw new Error("Informe uma meta válida.");
      }
      const payload = {
        scope: draft.scope,
        scopeRef: draft.scope === "global" ? GLOBAL_REF : draft.scopeRef,
        month,
        targetValue,
        notes: draft.notes,
        active: true,
      };
      return saveGoal({ data: draft.id ? { ...payload, id: draft.id } : payload });
    },
    onSuccess: async () => {
      toast.success("Meta salva.");
      setDraft(emptyDraft);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: GoalMetricRow) =>
      removeGoal({ data: { id: row.id ?? "", source: row.source } }),
    onSuccess: async () => {
      toast.success("Meta removida.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = goalsQuery.data;
  const selectableOptions = optionsForScope(data, draft.scope);
  const needsScopeRef = draft.scope !== "global";
  const canSave =
    !!data?.canManage &&
    draft.targetValue.trim().length > 0 &&
    (!needsScopeRef || draft.scopeRef.trim().length > 0) &&
    (draft.scope === "representative" || data.goalTargetsReady);

  const startEditing = (row: GoalMetricRow) => {
    setDraft({
      id: row.id ?? "",
      source: row.source,
      scope: row.scope,
      scopeRef: row.scopeRef,
      targetValue: String(row.targetValue),
      notes: "",
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Target className="h-4 w-4" />
            Gestão comercial
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Metas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {data?.scope === "visible"
              ? "Visão limitada aos representantes liberados para o seu perfil."
              : "Visão consolidada da operação comercial."}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="goals-period" className="text-xs">
            Período
          </Label>
          <Input
            id="goals-period"
            type="month"
            value={month}
            onChange={(event) => event.target.value && setMonth(event.target.value)}
            className="w-44 rounded-xl"
          />
        </div>
      </header>

      {goalsQuery.isLoading ? (
        <GoalsSkeleton />
      ) : goalsQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
          <p className="mt-3 text-sm font-medium text-destructive">
            {(goalsQuery.error as Error).message}
          </p>
        </div>
      ) : data ? (
        <>
          {!data.goalTargetsReady && data.canManage && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                A tabela de metas por equipe, marca, categoria e produto ainda não está ativa no
                Supabase.
              </span>
              <Badge variant="outline" className="border-warning/40 text-warning-foreground">
                Migration pendente
              </Badge>
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              variant="compact"
              icon={<Target className="h-4 w-4" />}
              label="Meta geral"
              value={
                data.totals.targetValue > 0 ? formatBRL(data.totals.targetValue) : "Não definida"
              }
              hint={`${data.totals.progress}% atingido em ${monthLabel(data.month)}`}
              progress={
                data.totals.targetValue > 0 ? Math.min(100, data.totals.progress) : undefined
              }
            />
            <MetricCard
              variant="compact"
              icon={<TrendingUp className="h-4 w-4" />}
              label="Vendido"
              value={formatBRL(data.totals.actualValue)}
              hint={`${data.totals.orderCount.toLocaleString("pt-BR")} pedidos confirmados/aprovados`}
            />
            <MetricCard
              variant="compact"
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Restante"
              value={data.totals.targetValue > 0 ? formatBRL(data.totals.remainingValue) : "—"}
              hint={
                data.general.targetKind === "seller_sum"
                  ? "Somado por representantes"
                  : "Alvo consolidado"
              }
            />
            <MetricCard
              variant="compact"
              icon={<Users className="h-4 w-4" />}
              label="Cobertura"
              value={data.totals.sellerCount.toLocaleString("pt-BR")}
              hint={`${data.totals.missingTargets.toLocaleString("pt-BR")} dimensões vendendo sem meta`}
            />
          </section>

          {data.canManage && (
            <section className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Plus className="h-4 w-4 text-primary" />
                    {draft.id || draft.targetValue ? "Editar meta" : "Nova meta"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scopeLabels[draft.scope]} · {monthLabel(month)}
                  </p>
                </div>
                {(draft.id || draft.targetValue || draft.scope !== "global") && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => setDraft(emptyDraft)}
                  >
                    Limpar
                  </Button>
                )}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(180px,1fr)_auto] lg:items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={draft.scope}
                    onValueChange={(value) =>
                      setDraft({
                        ...emptyDraft,
                        scope: value as GoalScope,
                        scopeRef: value === "global" ? GLOBAL_REF : "",
                      })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {scopeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Aplicar em</Label>
                  {needsScopeRef ? (
                    <Select
                      value={draft.scopeRef}
                      onValueChange={(scopeRef) =>
                        setDraft((current) => ({ ...current, scopeRef }))
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80 rounded-xl">
                        {selectableOptions.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            Nenhuma opção disponível
                          </SelectItem>
                        ) : (
                          selectableOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex h-9 items-center rounded-xl border border-border px-3 text-sm text-muted-foreground">
                      Operação completa
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="goal-value" className="text-xs">
                    Meta em R$
                  </Label>
                  <Input
                    id="goal-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.targetValue}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, targetValue: event.target.value }))
                    }
                    placeholder="0,00"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="goal-notes" className="text-xs">
                    Observação
                  </Label>
                  <Input
                    id="goal-notes"
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Opcional"
                    className="rounded-xl"
                  />
                </div>

                <Button
                  type="button"
                  className="rounded-xl bg-brand-gradient"
                  disabled={!canSave || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </section>
          )}

          <Tabs defaultValue="representantes" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start rounded-xl">
              <TabsTrigger value="representantes" className="rounded-lg">
                Representantes
              </TabsTrigger>
              <TabsTrigger value="equipes" className="rounded-lg">
                Equipes
              </TabsTrigger>
              <TabsTrigger value="marcas" className="rounded-lg">
                Marcas
              </TabsTrigger>
              <TabsTrigger value="categorias" className="rounded-lg">
                Categorias
              </TabsTrigger>
              <TabsTrigger value="produtos" className="rounded-lg">
                Produtos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="representantes">
              <GoalRowsTable
                title="Metas por representantes"
                description="Base usada também no dashboard, perfil e equipe."
                icon={<Users className="h-4 w-4" />}
                rows={data.representatives}
                canManage={data.canManage}
                onEdit={startEditing}
                onDelete={(row) => {
                  if (window.confirm(`Remover meta de ${row.label}?`)) deleteMutation.mutate(row);
                }}
                deleting={deleteMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="equipes">
              <GoalRowsTable
                title="Metas por equipe"
                description="Quando não há meta própria, a equipe usa a soma das metas dos representantes."
                icon={<Building2 className="h-4 w-4" />}
                rows={data.teams}
                canManage={data.canManage && data.goalTargetsReady}
                onEdit={startEditing}
                onDelete={(row) => {
                  if (window.confirm(`Remover meta de ${row.label}?`)) deleteMutation.mutate(row);
                }}
                deleting={deleteMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="marcas">
              <GoalRowsTable
                title="Metas por marca"
                description="Vendas consolidadas pelos produtos vendidos no período."
                icon={<Tags className="h-4 w-4" />}
                rows={data.brands}
                canManage={data.canManage && data.goalTargetsReady}
                onEdit={startEditing}
                onDelete={(row) => {
                  if (window.confirm(`Remover meta de ${row.label}?`)) deleteMutation.mutate(row);
                }}
                deleting={deleteMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="categorias">
              <GoalRowsTable
                title="Metas por categoria"
                description="Categoria combinada com a marca curada do produto."
                icon={<Layers3 className="h-4 w-4" />}
                rows={data.categories}
                canManage={data.canManage && data.goalTargetsReady}
                onEdit={startEditing}
                onDelete={(row) => {
                  if (window.confirm(`Remover meta de ${row.label}?`)) deleteMutation.mutate(row);
                }}
                deleting={deleteMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="produtos">
              <GoalRowsTable
                title="Metas por produto"
                description="Top produtos vendidos ou com meta configurada no período."
                icon={<Package className="h-4 w-4" />}
                rows={data.products}
                canManage={data.canManage && data.goalTargetsReady}
                onEdit={startEditing}
                onDelete={(row) => {
                  if (window.confirm(`Remover meta de ${row.label}?`)) deleteMutation.mutate(row);
                }}
                deleting={deleteMutation.isPending}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

function GoalsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

function targetBadge(row: GoalMetricRow) {
  if (row.targetKind === "configured") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Configurada</Badge>;
  }
  if (row.targetKind === "seller_sum") {
    return <Badge variant="outline">Somada</Badge>;
  }
  return <Badge className="border-amber-200 bg-amber-50 text-amber-700">Sem meta</Badge>;
}

function GoalRowsTable({
  title,
  description,
  icon,
  rows,
  canManage,
  deleting,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  rows: GoalMetricRow[];
  canManage: boolean;
  deleting: boolean;
  onEdit: (row: GoalMetricRow) => void;
  onDelete: (row: GoalMetricRow) => void;
}) {
  return (
    <section className="surface-card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="text-primary">{icon}</span>
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{rows.length.toLocaleString("pt-BR")} linhas</Badge>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma meta ou venda no período"
          description="Quando houver venda confirmada ou meta cadastrada, a dimensão aparece aqui."
          icon={<CalendarDays className="h-7 w-7" />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dimensão</TableHead>
              <TableHead className="w-[160px]">Status</TableHead>
              <TableHead className="w-[180px] text-right">Vendido</TableHead>
              <TableHead className="w-[180px] text-right">Meta</TableHead>
              <TableHead className="w-[220px]">Progresso</TableHead>
              <TableHead className="w-[120px] text-right">Pedidos</TableHead>
              {canManage && <TableHead className="w-[110px] text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.scope}:${row.scopeRef}`}>
                <TableCell>
                  <div className="min-w-0">
                    <p className="max-w-[360px] truncate font-medium">{row.label}</p>
                    <p className="max-w-[360px] truncate text-xs text-muted-foreground">
                      {row.subtitle || row.scopeRef}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{targetBadge(row)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatBRL(row.actualValue)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.targetValue > 0 ? formatBRL(row.targetValue) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={row.targetValue > 0 ? Math.min(100, row.progress) : 0}
                      className="h-2"
                    />
                    <span
                      className={cn(
                        "w-12 shrink-0 text-right text-xs font-semibold tabular-nums",
                        row.progress >= 100 ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      {row.targetValue > 0 ? `${row.progress}%` : "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.orderCount.toLocaleString("pt-BR")}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-xl"
                        aria-label={`Editar meta de ${row.label}`}
                        onClick={() => onEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {row.id && row.source && row.targetKind === "configured" && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl text-destructive"
                          aria-label={`Remover meta de ${row.label}`}
                          disabled={deleting}
                          onClick={() => onDelete(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
