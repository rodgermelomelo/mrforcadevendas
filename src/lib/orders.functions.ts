import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Authority,
  CommercialException,
  CommercialStatus,
  IntegrationStatus,
  Order,
  OrderItemSnapshot,
} from "@/lib/domain/types";

export interface CreateOrderInput {
  customerErpCode: string;
  priceTableCode: string;
  priceLevelLabel: string;
  paymentTerm: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  discountTotal: number;
  total: number;
  orderDiscountPercent: number;
  isBonus: boolean;
  notes: string;
  exceptions: CommercialException[];
  requiredAuthority: Authority | null;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type OrderRow = {
  id: string;
  number: string;
  created_at: string;
  customer_erp_code: string;
  customer_name: string;
  price_table_code: string;
  price_level_label: string;
  payment_term: string;
  seller_name: string;
  subtotal: string | number;
  discount_total: string | number;
  total: string | number;
  order_discount_percent: string | number;
  is_bonus: boolean;
  notes: string;
  status: CommercialStatus;
  integration_status: IntegrationStatus;
  required_authority: Authority | null;
  content_hash: string;
  order_items?: {
    product_erp_code: string;
    product_name: string;
    quantity: number;
    unit_price: string | number;
    discount_percent: string | number;
    total: string | number;
  }[];
  commercial_exceptions?: {
    exception_type: string;
    label: string;
    detail: string;
    authority: Authority;
  }[];
  approval_events?: { created_at: string; action: string; detail: string | null }[];
};

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    createdAt: row.created_at,
    customerId: row.customer_erp_code,
    customerName: row.customer_name,
    priceTableCode: row.price_table_code,
    priceLevelLabel: row.price_level_label,
    paymentTerm: row.payment_term,
    sellerName: row.seller_name,
    items: (row.order_items ?? []).map((i) => ({
      productId: i.product_erp_code,
      erpCode: i.product_erp_code,
      name: i.product_name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      discountPercent: Number(i.discount_percent),
      total: Number(i.total),
    })),
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    total: Number(row.total),
    orderDiscountPercent: Number(row.order_discount_percent),
    isBonus: row.is_bonus,
    notes: row.notes,
    exceptions: (row.commercial_exceptions ?? []).map((e) => ({
      type: e.exception_type as CommercialException["type"],
      label: e.label,
      detail: e.detail,
      authority: e.authority,
    })),
    status: row.status,
    integrationStatus: row.integration_status,
    requiredAuthority: row.required_authority,
    contentHash: row.content_hash,
    history: (row.approval_events ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ at: e.created_at, label: e.action, detail: e.detail ?? undefined })),
  };
}

const ORDER_SELECT =
  "*, order_items(*), commercial_exceptions(*), approval_events(created_at, action, detail)";

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Order[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as OrderRow[]).map(toOrder);
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<Order | null> => {
    const { data: row, error } = await context.supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toOrder(row as unknown as OrderRow) : null;
  });

/** Cria o pedido, grava exceções e o snapshot imutável com hash do conteúdo. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateOrderInput) => input)
  .handler(async ({ data, context }): Promise<Order> => {
    const { supabase, userId } = context;

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("erp_code, trade_name, seller_erp_code, price_table_code")
      .eq("erp_code", data.customerErpCode)
      .maybeSingle();
    if (customerError) throw new Error(customerError.message);
    if (!customer) throw new Error("Cliente inválido ou fora da sua carteira.");
    if (data.items.length === 0) throw new Error("Pedido sem itens.");

    const [{ data: profile }, { data: seller }] = await Promise.all([
      supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      supabase.from("erp_sellers").select("name").eq("erp_code", customer.seller_erp_code).maybeSingle(),
    ]);

    const hasExceptions = data.exceptions.length > 0;
    const status: CommercialStatus = hasExceptions ? "pending_approval" : "auto_approved";
    const integrationStatus: IntegrationStatus = hasExceptions
      ? "not_ready"
      : "awaiting_erp_integration";

    const contentHash = await sha256(
      JSON.stringify({
        customer: customer.erp_code,
        table: data.priceTableCode,
        level: data.priceLevelLabel,
        items: data.items,
        orderDiscountPercent: data.orderDiscountPercent,
        isBonus: data.isBonus,
        total: data.total,
      }),
    );

    const { data: inserted, error: insertError } = await supabase
      .from("orders")
      .insert({
        customer_erp_code: customer.erp_code,
        customer_name: customer.trade_name,
        seller_erp_code: customer.seller_erp_code,
        seller_name: seller?.name ?? profile?.full_name ?? profile?.email ?? "Vendedor",
        created_by: userId,
        price_table_code: data.priceTableCode,
        price_level_label: data.priceLevelLabel,
        payment_term: data.paymentTerm,
        is_bonus: data.isBonus,
        order_discount_percent: data.orderDiscountPercent,
        subtotal: data.subtotal,
        discount_total: data.discountTotal,
        total: data.total,
        notes: data.notes,
        status,
        integration_status: integrationStatus,
        required_authority: data.requiredAuthority,
        content_hash: contentHash,
        confirmed_at: hasExceptions ? null : new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    const orderId = inserted.id;

    const { error: itemsError } = await supabase.from("order_items").insert(
      data.items.map((i) => ({
        order_id: orderId,
        product_erp_code: i.erpCode,
        product_name: i.name,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        discount_percent: i.discountPercent,
        total: i.total,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);

    if (hasExceptions) {
      await supabase.from("commercial_exceptions").insert(
        data.exceptions.map((e) => ({
          order_id: orderId,
          exception_type: e.type,
          label: e.label,
          detail: e.detail,
          authority: e.authority,
        })),
      );
      if (data.requiredAuthority) {
        await supabase
          .from("approval_requests")
          .insert({ order_id: orderId, required_authority: data.requiredAuthority });
      }
    }

    await supabase.from("order_versions").insert({
      order_id: orderId,
      revision: 1,
      content_hash: contentHash,
      snapshot: JSON.parse(
        JSON.stringify({
          customer: customer.erp_code,
          priceTable: data.priceTableCode,
          priceLevel: data.priceLevelLabel,
          paymentTerm: data.paymentTerm,
          items: data.items,
          exceptions: data.exceptions,
          subtotal: data.subtotal,
          discountTotal: data.discountTotal,
          total: data.total,
          capturedAt: new Date().toISOString(),
        }),
      ),

    });

    await supabase.from("approval_events").insert({
      order_id: orderId,
      actor_id: userId,
      action: hasExceptions ? "Enviado para aprovação" : "Auto-aprovado e confirmado",
      detail: hasExceptions
        ? `Exceções: ${data.exceptions.map((e) => e.label).join(", ")}`
        : "Pedido sem exceções comerciais.",
    });

    const { data: row, error: readError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .single();
    if (readError) throw new Error(readError.message);
    return toOrder(row as unknown as OrderRow);
  });

/** Decisão do aprovador: aprovar, reprovar ou devolver para correção (nunca edita itens). */
export const decideOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; decision: "approve" | "reject" | "changes"; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.decision !== "approve" && data.reason.trim().length < 5) {
      throw new Error("Informe o motivo/orientação para o vendedor.");
    }
    const status: CommercialStatus =
      data.decision === "approve" ? "approved" : data.decision === "reject" ? "rejected" : "changes_requested";

    const { error } = await supabase
      .from("orders")
      .update({
        status,
        integration_status: data.decision === "approve" ? "awaiting_erp_integration" : "not_ready",
        confirmed_at: data.decision === "approve" ? new Date().toISOString() : null,
      })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

    await supabase
      .from("approval_requests")
      .update({
        status: data.decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        reason: data.reason || null,
      })
      .eq("order_id", data.orderId)
      .eq("status", "pending");

    await supabase.from("approval_events").insert({
      order_id: data.orderId,
      actor_id: userId,
      action:
        data.decision === "approve"
          ? "Aprovado"
          : data.decision === "reject"
            ? "Reprovado"
            : "Devolvido para correção",
      detail: data.reason || null,
    });

    return { ok: true };
  });

/** Pedidos que aguardam decisão e estão dentro da visibilidade do aprovador. */
export const listApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Order[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as OrderRow[]).map(toOrder);
  });
