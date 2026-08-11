import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
