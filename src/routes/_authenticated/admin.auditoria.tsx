import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { listAuditLogs } from "@/lib/admin-data.functions";
import { formatDateTimeBR } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  component: AuditPage,
  head: () => ({
    meta: [
      { title: "Auditoria · MR Força de Vendas" },
      { name: "description", content: "Histórico sanitizado das alterações administrativas do MR Força de Vendas." },
      { property: "og:title", content: "Auditoria · MR Força de Vendas" },
      { property: "og:description", content: "Quem alterou o quê e quando, sem dados sensíveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 40;

function AuditPage() {
  const load = useServerFn(listAuditLogs);
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ["admin", "audit", page], queryFn: () => load({ data: { page } }) });

  return (
    <AdminPage
      title="Auditoria"
      description="Registro sanitizado: guardamos apenas quem, quando, qual entidade e quais campos mudaram — nunca CNPJ, endereço ou dados financeiros."
    >
      {query.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (query.data?.rows ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((row) => (
            <div key={row.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {row.actorName} · {row.action} em {row.entity}
                </p>
                <span className="text-xs text-muted-foreground">{formatDateTimeBR(row.createdAt)}</span>
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {row.entityId ? `#${row.entityId} · ` : ""}
                {row.detail}
              </p>
            </div>
          ))}
          <Pager page={page} total={query.data?.total ?? 0} size={SIZE} onChange={setPage} />
        </div>
      )}
    </AdminPage>
  );
}
