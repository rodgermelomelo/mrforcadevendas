import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  analyzeErpFile,
  publishErpFile,
  getIsAdmin,
  getAdminStats,
} from "./admin-data.functions"; // Many were likely meant to be unified here
import {
  analyzeErpFile as analyzeErp,
  publishErpFile as publishErp,
  sha256Hex,
  parseUpload,
  buildEntities,
} from "./erp/import.server";

// Re-exporting for backward compatibility if needed, 
// but let's check what's actually in admin.functions.ts first.
// Wait, I already viewed admin.functions.ts and it has analyzeErpFile, publishErpFile, getIsAdmin, getAdminStats.
// I need to add getErpBaseRecords to it.

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
