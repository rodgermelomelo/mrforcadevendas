import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listSegmentImportAudit } from "@/lib/admin-data.functions";
import { formatDateTimeBR } from "@/lib/pricing";
import {
  SEGMENT_REASON_LABELS,
  SEGMENT_STATUS_LABELS,
  type SegmentAuditStatus,
} from "@/lib/erp/customer-segments";

export const Route = createFileRoute("/_authenticated/admin/auditoria-segmentos")({
  component: SegmentAuditPage,
  head: () => ({
    meta: [
      { title: "Auditoria de segmentos · MR Força de Vendas" },
      {
        name: "description",
        content: "Acompanhe quais clientes tiveram o segmento atualizado pelo importador do ERP e quais falharam.",
      },
      { property: "og:title", content: "Auditoria de segmentos · MR Força de Vendas" },
      {
        property: "og:description",
        content: "Resultado por cliente do importador de segmentos, com logs sanitizados e sem dados sensíveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_ORDER: SegmentAuditStatus[] = ["updated", "unchanged", "skipped", "failed"];

const STATUS_STYLES: Record<string, string> = {
  updated: "bg-primary/10 text-primary border-primary/25",
  unchanged: "bg-muted text-muted-foreground border-border",
  skipped: "bg-amber-500/10 text-amber-600 border-amber-500/25",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        STATUS_STYLES[status] ?? STATUS_STYLES["unchanged"]
      }`}
    >
      {SEGMENT_STATUS_LABELS[status as SegmentAuditStatus] ?? status}
    </span>
  );
}

function SegmentAuditPage() {
  const load = useServerFn(listSegmentImportAudit);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "segment-audit", runId, status, search, page],
    queryFn: () => load({ data: { runId, status, search, page } }),
    placeholderData: (prev) => prev,
  });

  const data = query.data;
  const segmentName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data?.segmentNames ?? []) map.set(s.code, s.name);
    return map;
  }, [data?.segmentNames]);

  const describeSegment = (code: string | null) =>
    !code ? "—" : segmentName.has(code) ? `${code} · ${segmentName.get(code)}` : code;

  const totalPages = Math.max(1, Math.ceil((data?.totalRows ?? 0) / (data?.pageSize ?? 50)));

  return (
    <AdminPage
      title="Auditoria de segmentos"
      description="Resultado do importador de segmentos por cliente. Registramos apenas o código do cliente, o segmento anterior, o novo e o motivo — nunca razão social, CNPJ, endereço ou telefone."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Logs sanitizados: nenhum dado pessoal do cliente é gravado nesta trilha. Cada publicação do{" "}
            <strong>dados.txt</strong> gera um novo lote de auditoria.
          </p>
        </div>

        {/* Filtros */}
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Buscar por código do cliente
            </label>
            <Input
              value={search}
              placeholder="Ex.: 001234"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Importação
            </label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={data?.selectedRunId ?? ""}
              onChange={(e) => {
                setRunId(e.target.value || null);
                setPage(1);
              }}
            >
              {(data?.runs ?? []).length === 0 && <option value="">Nenhuma importação com segmentos</option>}
              {(data?.runs ?? []).map((run) => (
                <option key={run.id} value={run.id}>
                  {formatDateTimeBR(run.finishedAt ?? run.startedAt)} · {run.entries.toLocaleString("pt-BR")} clientes
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Totais / filtro por situação */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATUS_ORDER.map((key) => {
            const active = status === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatus(active ? null : key);
                  setPage(1);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {SEGMENT_STATUS_LABELS[key]}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {(data?.totals?.[key] ?? 0).toLocaleString("pt-BR")}
                </p>
              </button>
            );
          })}
        </div>

        {/* Lista */}
        {query.isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (data?.rows ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {(data?.runs ?? []).length === 0
              ? "Nenhuma importação de segmentos registrada ainda. Publique o dados.txt na Central de Importações."
              : "Nenhum registro para os filtros selecionados."}
          </p>
        ) : (
          <div className="space-y-2">
            {(data?.rows ?? []).map((row) => (
              <div key={row.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={row.status} />
                    <p className="text-sm font-semibold">Cliente {row.customerErpCode}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTimeBR(row.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {describeSegment(row.previousSegmentCode)} → {describeSegment(row.newSegmentCode)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {SEGMENT_REASON_LABELS[row.reason] ?? row.reason}
                </p>
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-xs text-muted-foreground">
                Página {data?.page ?? 1} de {totalPages} · {(data?.totalRows ?? 0).toLocaleString("pt-BR")} registros
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(data?.page ?? 1) <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(data?.page ?? 1) >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
