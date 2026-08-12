import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Stat } from "@/components/shared/stat";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import type { TeamOverview } from "@/lib/team.functions";

type TeamSeller = TeamOverview["sellers"][number];

export interface TeamSellerCardProps {
  seller: TeamSeller;
  canManageGoals: boolean;
  onOpenGoals: (seller: { code: string; name: string }) => void;
}

/** Cartão de desempenho de um representante na visão de equipe. */
export function TeamSellerCard({ seller, canManageGoals, onOpenGoals }: TeamSellerCardProps) {
  return (
    <article className="surface-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{seller.name}</p>
          <p className="text-xs text-muted-foreground">
            {seller.erpCode} · {seller.customerCount.toLocaleString("pt-BR")} clientes ativos
            {seller.users.length > 0 && ` · ${seller.users.join(", ")}`}
            {!seller.active && " · inativo"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenGoals({ code: seller.erpCode, name: seller.name })}
          >
            <Target className="mr-1.5 h-4 w-4" />
            {canManageGoals ? "Metas" : "Ver metas"}
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-3 text-sm">
          <span className="font-semibold tabular-nums">{formatBRL(seller.sold)}</span>
          <span className="text-xs text-muted-foreground">
            {seller.goal > 0
              ? `Meta ${formatBRL(seller.goal)} · ${seller.progress}%`
              : "Meta não definida"}
          </span>
        </div>
        <Progress value={seller.goal > 0 ? Math.min(100, seller.progress) : 0} className="mt-2 h-2" />
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pedidos" value={seller.orderCount.toLocaleString("pt-BR")} />
        <Stat
          label="Em análise"
          value={seller.pendingCount.toLocaleString("pt-BR")}
          tone={seller.pendingCount > 0 ? "warning" : undefined}
        />
        <Stat label="Ticket médio" value={formatBRL(seller.averageTicket)} />
        <Stat
          label="Último pedido"
          value={seller.lastOrderAt ? formatDateTimeBR(seller.lastOrderAt) : "—"}
        />
      </dl>
    </article>
  );
}
