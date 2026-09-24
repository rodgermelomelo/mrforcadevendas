import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { avaliarPedidoAutorizacao } from "@/lib/orders/authorization/authorization.functions";

const pillCls: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VERIFICAR: "bg-amber-50 text-amber-700 border-amber-200",
  DIVERGENCIA: "bg-red-50 text-red-700 border-red-200",
  SIM: "bg-sky-50 text-sky-700 border-sky-200",
};

/**
 * Painel de autorização do pedido — roda o motor ao vivo contra as fontes
 * (acordos, campanhas, NFD, sell out, selos, conta corrente) e mostra se o
 * pedido vai para a Logística (OK) ou para a fila de Aprovação.
 */
export function PainelAutorizacao({ orderId }: { orderId: string }) {
  const avaliar = useServerFn(avaliarPedidoAutorizacao);
  const q = useQuery({
    queryKey: ["order", orderId, "autorizacao"],
    queryFn: () => avaliar({ data: { orderId } }),
    staleTime: 30_000,
  });

  const data = q.data;
  const fontes = data ? Object.entries(data.fontes).filter(([, v]) => v) : [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Autorização</h2>
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Avaliando o pedido…
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Não foi possível avaliar este pedido.</p>
      ) : (
        <div className="space-y-4">
          {data.situacao === "OK" ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Liberado para a Logística (sem pendências).
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <ShieldAlert className="h-5 w-5" /> Aguardando aprovação (Josi / gestores).
              </div>
              <ul className="ml-6 list-disc space-y-0.5">
                {data.motivos.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {fontes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fontes.map(([mod, r]) => (
                <span
                  key={mod}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${pillCls[r!.status] ?? "bg-muted text-muted-foreground border-border"}`}
                  title={r!.texto}
                >
                  {mod}: {r!.texto}
                </span>
              ))}
            </div>
          )}

          {data.bonif && fontes.length === 0 && (
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              Bonificado
            </span>
          )}

          <p className="text-xs text-muted-foreground">
            Verde = ok · Amarelo = verificar · Vermelho = divergência · Azul = bonificado. O motor
            compara a observação do pedido com os cadastros de desconto/acordo.
          </p>
        </div>
      )}
    </section>
  );
}
