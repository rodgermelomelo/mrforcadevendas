import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { avaliarPedidoPorId } from "@/lib/orders/authorization/authorization.server";
import type { AvaliacaoPedido } from "@/lib/orders/authorization/authorization.server";

export type { AvaliacaoPedido };

/** Roda o motor de autorização num pedido (por id) e devolve o resultado. */
export const avaliarPedidoAutorizacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ context, data }): Promise<AvaliacaoPedido | null> =>
    avaliarPedidoPorId(context, data.orderId),
  );
