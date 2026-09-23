import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadFonte, persistFonte, removeFonte } from "@/lib/fontes-credito.server";
import type { FonteRegistro, FonteTipo } from "@/lib/fontes-credito.server";

export type { FonteRegistro, FonteTipo };

export const listFonte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipo: FonteTipo }) => data)
  .handler(async ({ context, data }): Promise<FonteRegistro[]> => loadFonte(context, data.tipo));

export const saveFonte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    tipo: FonteTipo;
    id?: string;
    clienteCodigo: string;
    clienteNome: string;
    numero: string;
    valor: number | null;
    status: string;
    data: string | null;
  }) => data)
  .handler(async ({ context, data }) => {
    const { tipo, ...input } = data;
    return persistFonte(context, tipo, input);
  });

export const deleteFonte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipo: FonteTipo; id: string }) => data)
  .handler(async ({ context, data }) => removeFonte(context, data.tipo, data.id));
