import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseUpload, buildEntities, summarize, publishEntities, sha256Hex } from "./erp/import.server";

/**
 * Funções de servidor para gerenciar as Tabelas de Preço, Representantes,
 * Clientes, Produtos, Usuários, Cadastros e Regras Comerciais.
 */

// Helper para garantir papel de admin
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "administrador",
  });
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrador",
    });
    return data === true;
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const [customers, products, orders, sellers] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("erp_sellers").select("id", { count: "exact", head: true }),
    ]);

    return {
      customers: customers.count ?? 0,
      products: products.count ?? 0,
      orders: orders.count ?? 0,
      sellers: sellers.count ?? 0,
    };
  });

export const analyzeErpFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ content: z.string() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { bytes, result } = parseUpload(data.content);
    const entities = buildEntities(result.records);
    const hash = await sha256Hex(bytes);

    const { data: existing } = await context.supabase
      .from("erp_import_runs")
      .select("id")
      .eq("file_hash", hash)
      .eq("status", "published")
      .maybeSingle();

    return summarize(result, entities, hash, !!existing);
  });

export const publishErpFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ content: z.string() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;

    const { bytes, result } = parseUpload(data.content);
    const entities = buildEntities(result.records);
    const hash = await sha256Hex(bytes);

    // Registra o início
    const { data: run, error: runError } = await supabase
      .from("erp_import_runs")
      .insert({
        created_by: userId,
        file_hash: hash,
        file_version: result.report.layoutVersion,
        parser_version: result.report.parserVersion,
        status: "processing",
        totals: {},
      })
      .select("id")
      .single();

    if (runError) throw new Error(runError.message);

    try {
      const counts = await publishEntities(supabase, entities);

      await supabase
        .from("erp_import_runs")
        .update({
          status: "published",
          finished_at: new Date().toISOString(),
          totals: counts,
        })
        .eq("id", run.id);

      return { publishedAt: new Date().toISOString(), counts };
    } catch (e: any) {
      await supabase
        .from("erp_import_runs")
        .update({ status: "error" })
        .eq("id", run.id);
      
      await supabase.from("erp_import_errors").insert({
        run_id: run.id,
        message: e.message,
      });

      throw e;
    }
  });

