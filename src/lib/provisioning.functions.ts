import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Provisionamento de usuários de autenticação para representantes do ERP.
 * Cria conta (Supabase Auth), atribui perfil (papel) e vincula ao código do
 * representante — com VALIDAÇÃO antes de salvar. Só administradores.
 */

export const APP_ROLES = [
  "vendedor_externo",
  "vendedor_interno",
  "supervisor",
  "gerente_comercial",
  "administrador",
  "operador_integracao",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "administrador",
  });
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}

async function auditLog(
  context: { supabase: any; userId: string },
  entityId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  try {
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      entity: "auth_provisioning",
      entity_id: entityId,
      action,
      detail: JSON.parse(JSON.stringify(detail)),
    });
  } catch {
    /* auditoria nunca deve quebrar o fluxo */
  }
}

export interface ProvisionItem {
  sellerErpCode: string;
  email: string;
  fullName: string;
  role: string;
}
export interface ProvisionValidation {
  sellerErpCode: string;
  email: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function normalizeItems(input: unknown): ProvisionItem[] {
  const items = (input as { items?: unknown })?.items;
  if (!Array.isArray(items)) throw new Error("Lista de itens inválida.");
  return items.map((raw) => {
    const it = raw as Partial<ProvisionItem>;
    return {
      sellerErpCode: String(it.sellerErpCode ?? "").trim(),
      email: String(it.email ?? "").trim().toLowerCase(),
      fullName: String(it.fullName ?? "").trim(),
      role: String(it.role ?? "vendedor_externo").trim(),
    };
  });
}

async function validateItems(
  context: { supabase: any; userId: string },
  items: ProvisionItem[],
): Promise<ProvisionValidation[]> {
  const [sellersRes, profilesRes, linksRes] = await Promise.all([
    context.supabase.from("erp_sellers").select("erp_code, active"),
    context.supabase.from("profiles").select("email"),
    context.supabase.from("user_erp_seller_links").select("seller_erp_code"),
  ]);
  const sellerCodes = new Set((sellersRes.data ?? []).map((s: any) => s.erp_code));
  const existingEmails = new Set(
    (profilesRes.data ?? []).map((p: any) => String(p.email ?? "").toLowerCase()).filter(Boolean),
  );
  const linkedSellers = new Set((linksRes.data ?? []).map((l: any) => l.seller_erp_code));

  const emailCounts = new Map<string, number>();
  for (const it of items) if (it.email) emailCounts.set(it.email, (emailCounts.get(it.email) ?? 0) + 1);

  return items.map((it) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!it.sellerErpCode || !sellerCodes.has(it.sellerErpCode)) errors.push("Representante inexistente.");
    if (!it.fullName) errors.push("Nome obrigatório.");
    if (!it.email) errors.push("E-mail obrigatório.");
    else if (!EMAIL_RE.test(it.email)) errors.push("E-mail com formato inválido.");
    else if (existingEmails.has(it.email)) errors.push("E-mail já cadastrado no sistema.");
    else if ((emailCounts.get(it.email) ?? 0) > 1) errors.push("E-mail repetido na lista.");
    if (!APP_ROLES.includes(it.role as AppRole)) errors.push("Perfil (papel) inválido.");
    if (it.sellerErpCode && linkedSellers.has(it.sellerErpCode))
      warnings.push("Este representante já possui um usuário vinculado.");
    return { sellerErpCode: it.sellerErpCode, email: it.email, ok: errors.length === 0, errors, warnings };
  });
}

/** Passo 1: valida a lista SEM gravar nada. */
export const validateProvisioning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { items: ProvisionItem[] }) => ({ items: normalizeItems(input) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const results = await validateItems(context, data.items);
    return { results, validCount: results.filter((r) => r.ok).length, total: results.length };
  });

function genTempPassword(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `Mr${rand.slice(0, 10)}!7`;
}

export interface ProvisionResult {
  sellerErpCode: string;
  email: string;
  ok: boolean;
  message?: string;
  tempPassword?: string;
}

/** Passo 2: cria os usuários válidos (revalida no servidor antes de gravar). */
export const provisionSellerUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { items: ProvisionItem[] }) => ({ items: normalizeItems(input) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const validations = await validateItems(context, data.items);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: ProvisionResult[] = [];
    for (let i = 0; i < data.items.length; i += 1) {
      const it = data.items[i]!;
      const v = validations[i]!;
      if (!v.ok) {
        results.push({ sellerErpCode: it.sellerErpCode, email: it.email, ok: false, message: v.errors.join(" ") });
        continue;
      }
      const tempPassword = genTempPassword();
      try {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: it.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: it.fullName },
        });
        if (error || !created?.user) {
          results.push({ sellerErpCode: it.sellerErpCode, email: it.email, ok: false, message: error?.message ?? "Falha ao criar usuário." });
          continue;
        }
        const uid = created.user.id;
        // O trigger handle_new_user cria profile + papel 'vendedor_externo'.
        // Ajusta para o papel escolhido e garante nome/e-mail no profile.
        if (it.role !== "vendedor_externo") {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).eq("role", "vendedor_externo");
        }
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: uid, role: it.role } as never, { onConflict: "user_id,role" });
        await supabaseAdmin.from("profiles").update({ full_name: it.fullName, email: it.email }).eq("id", uid);
        const { error: linkErr } = await supabaseAdmin
          .from("user_erp_seller_links")
          .insert({ user_id: uid, seller_erp_code: it.sellerErpCode });
        if (linkErr && !linkErr.message.includes("duplicate")) {
          results.push({ sellerErpCode: it.sellerErpCode, email: it.email, ok: false, message: `Usuário criado, mas falha no vínculo: ${linkErr.message}` });
          continue;
        }
        await auditLog(context, it.sellerErpCode, "create_user", { email: it.email, role: it.role });
        results.push({ sellerErpCode: it.sellerErpCode, email: it.email, ok: true, tempPassword });
      } catch (e) {
        results.push({ sellerErpCode: it.sellerErpCode, email: it.email, ok: false, message: e instanceof Error ? e.message : "Erro inesperado." });
      }
    }
    return { results, createdCount: results.filter((r) => r.ok).length, total: results.length };
  });
