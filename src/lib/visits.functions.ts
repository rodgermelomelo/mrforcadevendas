import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  VISIT_PHOTO_BUCKET,
  VISIT_PHOTO_MAX_BYTES,
  type CreateCustomerVisitInput,
  type CustomerVisit,
  type VisitProofStatus,
  type VisitShelfStatus,
} from "@/lib/visits.types";

const VISIT_SELECT = `
  *,
  customers!customer_visits_customer_erp_code_fkey(erp_code, trade_name, legal_name, city, uf),
  profiles!customer_visits_created_by_fkey(full_name, email)
`;

type VisitRow = {
  id: string;
  customer_erp_code: string;
  seller_erp_code: string;
  visited_at: string;
  visit_reason: string;
  shelf_status: VisitShelfStatus;
  proof_status: VisitProofStatus;
  proof_photo_path: string;
  notes: string;
  routine_interval_days: number;
  next_visit_date: string;
  created_at: string;
  customers?: {
    trade_name: string;
    legal_name: string;
    city: string;
    uf: string;
  } | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type QueryError = { message: string } | null;
type QueryResult<T> = Promise<{ data: T | null; error: QueryError }>;

interface VisitQuery {
  select(columns?: string): VisitQuery;
  eq(column: string, value: unknown): VisitQuery;
  order(column: string, options?: { ascending?: boolean }): VisitQuery;
  limit(count: number): QueryResult<unknown[]>;
  insert(values: unknown): VisitQuery;
  maybeSingle(): QueryResult<unknown>;
  single(): QueryResult<unknown>;
}

interface VisitDatabase {
  from(table: string): VisitQuery;
}

function visitDb(supabase: unknown): VisitDatabase {
  return supabase as VisitDatabase;
}

function addDaysIsoDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function normalizeInterval(value: number) {
  if (!Number.isFinite(value)) return 30;
  return Math.max(7, Math.min(120, Math.round(value)));
}

async function signedPhotoUrl(path: string) {
  if (!path) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage
      .from(VISIT_PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 30);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function toVisit(row: VisitRow): Promise<CustomerVisit> {
  return {
    id: row.id,
    customerErpCode: row.customer_erp_code,
    customerName: row.customers?.trade_name ?? row.customer_erp_code,
    customerLegalName: row.customers?.legal_name ?? "",
    city: row.customers?.city ?? "",
    uf: row.customers?.uf ?? "",
    sellerErpCode: row.seller_erp_code,
    visitedAt: row.visited_at,
    visitReason: row.visit_reason,
    shelfStatus: row.shelf_status,
    proofStatus: row.proof_status,
    proofPhotoPath: row.proof_photo_path,
    proofPhotoUrl: await signedPhotoUrl(row.proof_photo_path),
    notes: row.notes,
    routineIntervalDays: row.routine_interval_days,
    nextVisitDate: row.next_visit_date,
    createdAt: row.created_at,
    createdByName: row.profiles?.full_name || row.profiles?.email || null,
  };
}

async function validateCustomerPortfolio(
  supabase: unknown,
  customerErpCode: string,
  sellerErpCode: string,
) {
  const { data, error } = await visitDb(supabase)
    .from("customer_seller_links")
    .select("customer_erp_code, seller_erp_code")
    .eq("customer_erp_code", customerErpCode)
    .eq("seller_erp_code", sellerErpCode)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cliente inválido ou fora da carteira do representante.");
}

function validateVisitInput(input: CreateCustomerVisitInput) {
  const path = input.proofPhotoPath.trim();
  if (!input.customerErpCode.trim()) throw new Error("Selecione o cliente visitado.");
  if (!input.sellerErpCode.trim()) throw new Error("Representante da carteira não informado.");
  if (!path) throw new Error("A foto da loja ou gôndola é obrigatória para validar a visita.");
  if (!input.proofPhotoMime.startsWith("image/"))
    throw new Error("Envie uma imagem válida da visita.");
  if (input.proofPhotoSize <= 0) throw new Error("A foto enviada está vazia.");
  if (input.proofPhotoSize > VISIT_PHOTO_MAX_BYTES)
    throw new Error("A foto deve ter no máximo 10 MB.");

  return {
    ...input,
    proofPhotoPath: path,
    routineIntervalDays: normalizeInterval(input.routineIntervalDays),
    notes: input.notes.trim(),
    visitReason: input.visitReason.trim() || "rotina",
  };
}

export const listCustomerVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomerVisit[]> => {
    const { data, error } = await visitDb(context.supabase)
      .from("customer_visits")
      .select(VISIT_SELECT)
      .order("visited_at", { ascending: false })
      .limit(250);
    if (error) throw new Error(error.message);

    return Promise.all(((data ?? []) as unknown as VisitRow[]).map((row) => toVisit(row)));
  });

export const createCustomerVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateCustomerVisitInput) => input)
  .handler(async ({ data, context }): Promise<CustomerVisit> => {
    const input = validateVisitInput(data);
    await validateCustomerPortfolio(context.supabase, input.customerErpCode, input.sellerErpCode);

    const visitedAt = input.visitedAt ? new Date(input.visitedAt) : new Date();
    if (Number.isNaN(visitedAt.getTime())) throw new Error("Data da visita inválida.");

    const row = {
      customer_erp_code: input.customerErpCode,
      seller_erp_code: input.sellerErpCode,
      visited_at: visitedAt.toISOString(),
      visit_reason: input.visitReason,
      shelf_status: input.shelfStatus,
      proof_status: "photo_sent" as VisitProofStatus,
      proof_photo_path: input.proofPhotoPath,
      proof_photo_mime: input.proofPhotoMime,
      proof_photo_size: input.proofPhotoSize,
      notes: input.notes,
      routine_interval_days: input.routineIntervalDays,
      next_visit_date: addDaysIsoDate(visitedAt, input.routineIntervalDays),
      created_by: context.userId,
    };

    const { data: inserted, error } = await visitDb(context.supabase)
      .from("customer_visits")
      .insert(row)
      .select(VISIT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    if (!inserted) throw new Error("Não foi possível ler a visita criada.");
    const insertedVisit = inserted as VisitRow;

    await visitDb(context.supabase)
      .from("audit_logs")
      .insert({
        actor_id: context.userId,
        entity: "customer_visits",
        entity_id: insertedVisit.id,
        action: "create",
        detail: {
          customerErpCode: input.customerErpCode,
          sellerErpCode: input.sellerErpCode,
          nextVisitDate: row.next_visit_date,
        },
      });

    return toVisit(insertedVisit);
  });
