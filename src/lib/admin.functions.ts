import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseUpload } from "./erp/import.server";
import { 
  analyzeErpFile as analyzeData,
  publishErpFile as publishData,
  getIsAdmin as getIsAdminData,
  getAdminStats as getAdminStatsData
} from "./admin-data.functions";

// Re-export constants/functions from admin-data if they are used by components
// Note: In TanStack Start, we should prefer importing from the final location.
// But to maintain the current import structure in routes, we re-export them here.
export const analyzeErpFile = analyzeData;
export const publishErpFile = publishData;
export const getIsAdmin = getIsAdminData;
export const getAdminStats = getAdminStatsData;

export const getErpBaseRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    content: z.string(),
    type: z.enum(["vendedores", "clientes", "produtos", "precos", "estoque", "grupos", "segmentos", "formas_pagamento", "tabelas_preco"]) 
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrador",
    });
    if (isAdmin !== true) throw new Error("Acesso restrito.");

    const { result } = parseUpload(data.content);
    const { records } = result;

    switch (data.type) {
      case "vendedores": return records.sellers;
      case "clientes": return records.customers;
      case "produtos": return records.products;
      case "precos": return records.prices;
      case "estoque": return records.inventory;
      case "grupos": return records.productGroups;
      case "segmentos": return records.segments;
      case "formas_pagamento": return records.billingMethods;
      case "tabelas_preco": return records.priceTables;
      default: return [];
    }
  });
