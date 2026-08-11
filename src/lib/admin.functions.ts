import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StagingSummary } from "@/lib/erp/import.server";

/** Diz se o usuário autenticado é administrador (usado para exibir a área admin). */
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrador",
    });
    return data === true;
  });

/** Passo 1 — Analisar: parseia o arquivo e devolve o resumo de staging. Não grava nada. */
export const analyzeErpFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { content: string }) => {
    if (typeof input?.content !== "string" || input.content.length === 0) {
      throw new Error("Arquivo vazio ou inválido.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<StagingSummary> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrador",
    });
    if (isAdmin !== true) throw new Error("Acesso restrito a administradores.");

    const { parseUpload, sha256Hex, buildEntities, summarize } = await import("@/lib/erp/import.server");
    const { bytes, result } = parseUpload(data.content);
    const fileHash = await sha256Hex(bytes);
    const entities = result.report.ok
      ? buildEntities(result.records)
      : {
          product_groups: [],
          segments: [],
          billing_methods: [],
          price_tables: [],
          erp_sellers: [],
          products: [],
          product_prices: [],
          inventory_snapshots: [],
          catalog_review: [],
          customers: [],
        };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("erp_import_runs")
      .select("id")
      .eq("file_hash", fileHash)
      .eq("status", "published")
      .limit(1);

    console.log(`[erp-import] analisado hash=${fileHash.slice(0, 12)} ok=${result.report.ok} registros=${result.report.logicalCount}`);
    return summarize(result, entities, fileHash, (prev ?? []).length > 0);
  });

export interface PublishResult {
  runId: string;
  publishedAt: string;
  counts: Record<string, number>;
}

/** Passo 2 — Publicar: upsert idempotente em lotes com registro em erp_import_runs. */
export const publishErpFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { content: string }) => {
    if (typeof input?.content !== "string" || input.content.length === 0) {
      throw new Error("Arquivo vazio ou inválido.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<PublishResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrador",
    });
    if (isAdmin !== true) throw new Error("Acesso restrito a administradores.");

    const { parseUpload, sha256Hex, buildEntities, publishEntities } = await import("@/lib/erp/import.server");
    const { diagnoseCatalog } = await import("@/lib/erp/catalog-diagnosis");
    const { bytes, result } = parseUpload(data.content);
    if (!result.report.ok) throw new Error("Arquivo inválido — importação rejeitada.");

    const fileHash = await sha256Hex(bytes);
    const entities = buildEntities(result.records);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: run, error: runErr } = await supabaseAdmin
      .from("erp_import_runs")
      .insert({
        file_hash: fileHash,
        parser_version: result.report.parserVersion,
        file_version: result.report.layoutVersion,
        status: "publishing",
        totals: JSON.parse(JSON.stringify({ byType: result.report.typeCounts, diagnosis: diagnoseCatalog(result.records) })),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (runErr || !run) throw new Error("Não foi possível registrar a importação.");

    try {
      const counts = await publishEntities(supabaseAdmin as never, entities);
      const publishedAt = new Date().toISOString();
      await supabaseAdmin
        .from("erp_import_runs")
        .update({ status: "published", finished_at: publishedAt })
        .eq("id", run.id);
      console.log(`[erp-import] publicado run=${run.id} hash=${fileHash.slice(0, 12)}`);
      return { runId: run.id, publishedAt, counts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      await supabaseAdmin
        .from("erp_import_runs")
        .update({ status: "failed", finished_at: new Date().toISOString() })
        .eq("id", run.id);
      await supabaseAdmin.from("erp_import_errors").insert({ run_id: run.id, message: msg.slice(0, 500) });
      throw new Error(`Falha na publicação: ${msg}`);
    }
  });
