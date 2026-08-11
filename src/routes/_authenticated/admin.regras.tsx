import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import {
  listApprovalRules,
  saveApprovalRule,
  deleteApprovalRule,
  type ApprovalRuleRow,
  type AppRole,
} from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_authenticated/admin/regras")({
  component: RulesPage,
  head: () => ({
    meta: [
      { title: "Regras comerciais · MR Força de Vendas" },
      { name: "description", content: "Matriz configurável de aprovação por tipo de exceção, faixa de desconto e autoridade." },
      { property: "og:title", content: "Regras comerciais · MR Força de Vendas" },
      { property: "og:description", content: "Configure quem aprova cada exceção comercial dos pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EXCEPTIONS: { value: string; label: string }[] = [
  { value: "discount_item", label: "Desconto por item" },
  { value: "discount_order", label: "Desconto no pedido" },
  { value: "insufficient_stock", label: "Estoque insuficiente" },
  { value: "non_standard_terms", label: "Condição fora do padrão" },
  { value: "below_minimum", label: "Abaixo do valor mínimo" },
  { value: "restricted_customer", label: "Cliente com restrição" },
  { value: "credit_limit_exceeded", label: "Limite de crédito excedido" },
  { value: "bonus_order", label: "Bonificação" },
];

const AUTHORITIES: { value: AppRole; label: string }[] = [
  { value: "supervisor", label: "Supervisor" },
  { value: "gerente_comercial", label: "Gerente comercial" },
  { value: "administrador", label: "Administrador" },
];

const emptyRule = {
  exceptionType: "discount_item",
  minPercent: null as number | null,
  maxPercent: null as number | null,
  minAmount: null as number | null,
  maxAmount: null as number | null,
  authority: "supervisor" as AppRole,
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: null as string | null,
  active: true,
};

function RulesPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listApprovalRules);
  const save = useServerFn(saveApprovalRule);
  const remove = useServerFn(deleteApprovalRule);
  const [creating, setCreating] = useState(false);

  const query = useQuery({ queryKey: ["admin", "rules"], queryFn: () => load() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "rules"] });

  const saveMutation = useMutation({
    mutationFn: (input: Parameters<typeof save>[0]["data"]) => save({ data: input }),
    onSuccess: async () => {
      toast.success("Regra salva.");
      setCreating(false);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: async () => {
      toast.success("Regra removida.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminPage
      title="Regras comerciais"
      description="Matriz de aprovação em banco. Quando um pedido tem várias exceções, ele vai direto para a maior autoridade envolvida."
      actions={
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nova regra
        </button>
      }
    >
      {creating && (
        <RuleForm
          initial={{ ...emptyRule }}
          saving={saveMutation.isPending}
          onCancel={() => setCreating(false)}
          onSave={(rule) => saveMutation.mutate(rule)}
        />
      )}

      {query.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(query.data ?? []).map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              saving={saveMutation.isPending}
              deleting={deleteMutation.isPending}
              onSave={(next) => saveMutation.mutate({ ...next, id: rule.id })}
              onDelete={() => deleteMutation.mutate(rule.id)}
            />
          ))}
        </div>
      )}
    </AdminPage>
  );
}

type RuleDraft = typeof emptyRule;

function RuleCard({
  rule,
  saving,
  deleting,
  onSave,
  onDelete,
}: {
  rule: ApprovalRuleRow;
  saving: boolean;
  deleting: boolean;
  onSave: (rule: RuleDraft) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label = EXCEPTIONS.find((e) => e.value === rule.exceptionType)?.label ?? rule.exceptionType;
  const range =
    rule.minPercent !== null || rule.maxPercent !== null
      ? `${rule.minPercent ?? 0}% a ${rule.maxPercent === null ? "∞" : `${rule.maxPercent}%`}`
      : "qualquer valor";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 text-left">
          <p className="font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">
            {range} · autoridade: {AUTHORITIES.find((a) => a.value === rule.authority)?.label ?? rule.authority} ·{" "}
            {rule.active ? "ativa" : "inativa"}
          </p>
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remover
        </button>
      </div>
      {open && (
        <RuleForm
          initial={{
            exceptionType: rule.exceptionType,
            minPercent: rule.minPercent,
            maxPercent: rule.maxPercent,
            minAmount: rule.minAmount,
            maxAmount: rule.maxAmount,
            authority: rule.authority,
            validFrom: rule.validFrom,
            validTo: rule.validTo,
            active: rule.active,
          }}
          saving={saving}
          onCancel={() => setOpen(false)}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function RuleForm({
  initial,
  saving,
  onCancel,
  onSave,
}: {
  initial: RuleDraft;
  saving: boolean;
  onCancel: () => void;
  onSave: (rule: RuleDraft) => void;
}) {
  const [form, setForm] = useState<RuleDraft>(initial);
  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";
  const num = (value: string) => (value === "" ? null : Number(value));

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1">
          <span className={labelCls}>Tipo de exceção</span>
          <select
            className={field}
            value={form.exceptionType}
            onChange={(e) => setForm({ ...form, exceptionType: e.target.value })}
          >
            {EXCEPTIONS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Autoridade</span>
          <select
            className={field}
            value={form.authority}
            onChange={(e) => setForm({ ...form, authority: e.target.value as AppRole })}
          >
            {AUTHORITIES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Vigência a partir de</span>
          <input
            type="date"
            className={field}
            value={form.validFrom}
            onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>% mínimo</span>
          <input
            type="number"
            step="0.01"
            className={field}
            value={form.minPercent ?? ""}
            onChange={(e) => setForm({ ...form, minPercent: num(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>% máximo (vazio = sem teto)</span>
          <input
            type="number"
            step="0.01"
            className={field}
            value={form.maxPercent ?? ""}
            onChange={(e) => setForm({ ...form, maxPercent: num(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Valor mínimo (R$)</span>
          <input
            type="number"
            step="0.01"
            className={field}
            value={form.minAmount ?? ""}
            onChange={(e) => setForm({ ...form, minAmount: num(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Valor máximo (R$)</span>
          <input
            type="number"
            step="0.01"
            className={field}
            value={form.maxAmount ?? ""}
            onChange={(e) => setForm({ ...form, maxAmount: num(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Vigência até (opcional)</span>
          <input
            type="date"
            className={field}
            value={form.validTo ?? ""}
            onChange={(e) => setForm({ ...form, validTo: e.target.value || null })}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Regra ativa
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(form)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar regra
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">
          Cancelar
        </button>
      </div>
    </div>
  );
}
