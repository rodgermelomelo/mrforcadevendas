import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAcordos, persistAcordo, removeAcordo } from "@/lib/acordos.server";
import type { AcordoRecord } from "@/lib/acordos.server";

export type { AcordoRecord };

export const listAcordos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AcordoRecord[]> => loadAcordos(context));

export const saveAcordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id?: string;
    clienteCodigo: string;
    clienteNome: string;
    percentual: number | null;
    forma: string;
    vigenciaDe: string | null;
    vigenciaAte: string | null;
    status: string;
  }) => data)
  .handler(async ({ context, data }) => persistAcordo(context, data));

export const deleteAcordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => removeAcordo(context, data.id));
