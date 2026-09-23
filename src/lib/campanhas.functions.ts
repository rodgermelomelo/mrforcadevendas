import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  loadCampanhas,
  persistCampanha,
  persistRegra,
  removeCampanha,
  removeRegra,
} from "@/lib/campanhas.server";
import type { CampanhaRecord, CampanhaRegra } from "@/lib/campanhas.server";

export type { CampanhaRecord, CampanhaRegra };

export const listCampanhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CampanhaRecord[]> => loadCampanhas(context));

export const saveCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string; nome: string; periodoDe: string | null; periodoAte: string | null; status: string }) => data)
  .handler(async ({ context, data }) => persistCampanha(context, data));

export const deleteCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => removeCampanha(context, data.id));

export const saveRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id?: string;
    campanhaId: string;
    nome: string;
    percentual: number | null;
    categoria: string;
    palavrasChave: string[];
    de: string | null;
    ate: string | null;
    status: string;
  }) => data)
  .handler(async ({ context, data }) => persistRegra(context, data));

export const deleteRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => removeRegra(context, data.id));
