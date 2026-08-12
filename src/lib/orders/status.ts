import type { CommercialStatus, IntegrationStatus } from "@/lib/domain/types";

export const statusLabel: Record<CommercialStatus, string> = {
  draft: "Rascunho",
  validating: "Validando",
  pending_approval: "Em análise",
  changes_requested: "Devolvido para correção",
  rejected: "Reprovado",
  auto_approved: "Auto-aprovado",
  approved: "Aprovado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

export const integrationLabel: Record<IntegrationStatus, string> = {
  not_ready: "Não elegível",
  awaiting_erp_integration: "Aguardando envio ao ERP",
  sending: "Enviando",
  accepted_by_erp: "Aceito pelo ERP",
  integration_error: "Erro de integração",
};

export function statusTone(status: CommercialStatus): string {
  switch (status) {
    case "confirmed":
    case "approved":
    case "auto_approved":
      return "bg-success/10 text-success border-success/20";
    case "pending_approval":
    case "validating":
      return "bg-warning/10 text-warning border-warning/20";
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "changes_requested":
      return "bg-brand-alt/10 text-brand-alt border-brand-alt/20";
    case "cancelled":
      return "bg-zinc-900/10 text-zinc-700 border-zinc-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
