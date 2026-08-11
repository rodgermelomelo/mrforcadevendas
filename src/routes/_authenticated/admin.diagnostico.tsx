import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { listDiagnosis, updateProduct } from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_authenticated/admin/diagnostico")({
  component: DiagnosisPage,
  head: () => ({
    meta: [
      { title: "Diagnóstico do catálogo · MR Força de Vendas" },
      { name: "description", content: "Classificação dos códigos do ERP: no catálogo, só estoque, só preço, sem preço e afins." },
      { property: "og:title", content: "Diagnóstico do catálogo · MR Força de Vendas" },
      { property: "og:description", content: "Entenda por que um código não aparece no catálogo comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 30;

const LABELS: Record<string, string> = {
  in_catalog: "No catálogo",
  stock_only: "Só estoque",
  price_only: "Só preço",
  no_stock: "Sem estoque",
  negative_stock: "Estoque negativo",
  no_price: "Sem preço",
  unknown_group: "Grupo desconhecido",
  pending: "Pendente",
  inactive: "Inativo",
  manual_release: "Liberado manualmente",
};

function DiagnosisPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listDiagnosis);
  const save = useServerFn(updateProduct);
  const [classification, setClassification] = useState("todos");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["admin", "diagnosis", classification, page],
    queryFn: () => load({ data: { classification, page } }),
  });

  const mutation = useMutation({
    mutationFn: (erpCode: string) => save({ data: { erpCode, released: true, active: true } }),
    onSuccess: async () => {
      toast.success("Código liberado para o catálogo.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "diagnosis"] });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminPage
      title="Diagnóstico do catálogo"
      description="Estoque e preços trazem códigos históricos que não entram automaticamente no catálogo. Aqui você vê a classificação de cada um."
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setClassification("todos");
            setPage(0);
          }}
          className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
            classification === "todos" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
          }`}
        >
          Todos
        </button>
        {(query.data?.summary ?? []).map((s) => (
          <button
            key={s.classification}
            type="button"
            onClick={() => {
              setClassification(s.classification);
              setPage(0);
            }}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
              classification === s.classification
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            {LABELS[s.classification] ?? s.classification} ({s.count.toLocaleString("pt-BR")})
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (query.data?.rows ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum código classificado ainda. O diagnóstico é gerado a cada publicação na Central de Importações.
        </p>
      ) : (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((row) => (
            <div
              key={row.erpCode}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {row.erpCode} {row.name ? `· ${row.name}` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {LABELS[row.classification] ?? row.classification}
                  {row.detail ? ` · ${row.detail}` : ""}
                </p>
              </div>
              {row.inCatalog && !row.released && (
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(row.erpCode)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  <PackageCheck className="h-3.5 w-3.5" /> Liberar no catálogo
                </button>
              )}
              {row.released && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  Liberado
                </span>
              )}
            </div>
          ))}
          <Pager page={page} total={query.data?.total ?? 0} size={SIZE} onChange={setPage} />
        </div>
      )}
    </AdminPage>
  );
}
