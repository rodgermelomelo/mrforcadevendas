import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgePercent, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { CommissionRuleCard } from "@/components/admin/commission-rule-card";
import { CommissionRuleForm } from "@/components/admin/commission-rule-form";
import { Button } from "@/components/ui/button";
import {
  deleteCommissionRule,
  listCommissionOptions,
  listCommissionRules,
  saveCommissionRule,
  type CommissionRuleDraft,
} from "@/lib/commissions.functions";

export const Route = createFileRoute("/_authenticated/admin/comissoes")({
  component: CommissionsPage,
  head: () => ({
    meta: [
      { title: "Comissões · MR Força de Vendas" },
      {
        name: "description",
        content: "Configure percentuais de comissão por marca, categoria, produto e representantes.",
      },
    ],
  }),
});

const emptyRule: CommissionRuleDraft = {
  name: "",
  percent: 0,
  brand: null,
  category: null,
  productErpCode: null,
  sellerErpCodes: [],
  priority: 100,
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: null,
  active: true,
  notes: "",
};

function CommissionsPage() {
  const queryClient = useQueryClient();
  const loadRules = useServerFn(listCommissionRules);
  const loadOptions = useServerFn(listCommissionOptions);
  const saveRule = useServerFn(saveCommissionRule);
  const removeRule = useServerFn(deleteCommissionRule);
  const [creating, setCreating] = useState(false);

  const rulesQuery = useQuery({ queryKey: ["admin", "commission-rules"], queryFn: () => loadRules() });
  const optionsQuery = useQuery({ queryKey: ["admin", "commission-options"], queryFn: () => loadOptions() });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "commission-rules"] });
  };

  const saveMutation = useMutation({
    mutationFn: (rule: CommissionRuleDraft) => saveRule({ data: rule }),
    onSuccess: async () => {
      toast.success("Regra de comissão salva.");
      setCreating(false);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRule({ data: { id } }),
    onSuccess: async () => {
      toast.success("Regra removida.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stats = useMemo(() => {
    const rows = rulesQuery.data ?? [];
    return {
      total: rows.length,
      active: rows.filter((rule) => rule.active).length,
      sellers: new Set(rows.flatMap((rule) => rule.sellerErpCodes)).size,
      average: rows.length > 0 ? rows.reduce((acc, rule) => acc + rule.percent, 0) / rows.length : 0,
    };
  }, [rulesQuery.data]);

  const loading = rulesQuery.isLoading || optionsQuery.isLoading;
  const options = optionsQuery.data;

  return (
    <AdminPage
      title="Comissões"
      description="Defina como cada item do pedido remunera o representante. O cálculo é salvo no pedido no momento da geração."
      actions={
        <Button type="button" className="rounded-xl bg-brand-gradient" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova regra
        </Button>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Regras" value={stats.total.toLocaleString("pt-BR")} />
        <Metric label="Ativas" value={stats.active.toLocaleString("pt-BR")} />
        <Metric label="Representantes específicos" value={stats.sellers.toLocaleString("pt-BR")} />
        <Metric label="Comissão média" value={`${stats.average.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} />
      </section>

      {loading || !options ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {creating && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <BadgePercent className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Nova regra de comissão</h2>
              </div>
              <CommissionRuleForm
                initial={emptyRule}
                options={options}
                saving={saveMutation.isPending}
                onCancel={() => setCreating(false)}
                onSave={(rule) => saveMutation.mutate(rule)}
              />
            </div>
          )}

          {(rulesQuery.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">Nenhuma comissão configurada</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie a primeira regra por marca, categoria, produto ou representantes.
              </p>
            </div>
          ) : (
            (rulesQuery.data ?? []).map((rule) => (
              <CommissionRuleCard
                key={rule.id}
                rule={rule}
                options={options}
                saving={saveMutation.isPending}
                deleting={deleteMutation.isPending}
                onSave={(next) => saveMutation.mutate(next)}
                onDelete={() => deleteMutation.mutate(rule.id)}
              />
            ))
          )}
        </div>
      )}
    </AdminPage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
