import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommissionRuleForm } from "@/components/admin/commission-rule-form";
import type {
  CommissionOptions,
  CommissionRuleDraft,
  CommissionRuleRow,
} from "@/lib/commissions.functions";

export interface CommissionRuleCardProps {
  rule: CommissionRuleRow;
  options: CommissionOptions;
  saving: boolean;
  deleting: boolean;
  onSave: (rule: CommissionRuleDraft) => void;
  onDelete: () => void;
}

function scopeLabel(rule: CommissionRuleRow) {
  if (rule.productErpCode) {
    return `Produto ${rule.productErpCode}${rule.productName ? ` · ${rule.productName}` : ""}`;
  }
  if (rule.brand && rule.category) return `${rule.brand} · ${rule.category}`;
  if (rule.category) return `Categoria ${rule.category}`;
  if (rule.brand) return `Marca ${rule.brand}`;
  return "Regra geral";
}

function statusLabel(rule: CommissionRuleRow) {
  const period = rule.validTo ? `${rule.validFrom} ate ${rule.validTo}` : `desde ${rule.validFrom}`;
  return `${rule.active ? "ativa" : "inativa"} · ${period} · prioridade ${rule.priority}`;
}

export function CommissionRuleCard({
  rule,
  options,
  saving,
  deleting,
  onSave,
  onDelete,
}: CommissionRuleCardProps) {
  const [open, setOpen] = useState(false);
  const sellerText =
    rule.sellerLabels.length === 0 ? "todos os representantes" : `${rule.sellerLabels.length} representante(s)`;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{rule.name}</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {rule.percent.toLocaleString("pt-BR")}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{scopeLabel(rule)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sellerText} · {statusLabel(rule)}
          </p>
        </button>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(!open)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={deleting}
            className="rounded-xl border-destructive/40 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Remover
          </Button>
        </div>
      </div>

      {rule.notes && <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{rule.notes}</p>}

      {open && (
        <CommissionRuleForm
          initial={{
            id: rule.id,
            name: rule.name,
            percent: rule.percent,
            brand: rule.brand,
            category: rule.category,
            productErpCode: rule.productErpCode,
            sellerErpCodes: rule.sellerErpCodes,
            priority: rule.priority,
            validFrom: rule.validFrom,
            validTo: rule.validTo,
            active: rule.active,
            notes: rule.notes,
          }}
          options={options}
          saving={saving}
          onCancel={() => setOpen(false)}
          onSave={onSave}
        />
      )}
    </article>
  );
}
