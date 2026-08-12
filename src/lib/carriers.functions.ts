import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  loadCarriers,
  persistCarrier,
  persistCarrierCity,
  removeCarrier,
  removeCarrierCity,
} from "@/lib/carriers.server";
import type { CarrierCity, CarrierRecord } from "@/lib/carriers.server";

export type { CarrierCity, CarrierRecord };

export const listCarriers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CarrierRecord[]> => loadCarriers(context));

export const saveCarrier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id?: string;
    name: string;
    taxId: string;
    phone: string;
    email: string;
    notes: string;
    active: boolean;
  }) => data)
  .handler(async ({ context, data }) => persistCarrier(context, data));

export const deleteCarrier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => removeCarrier(context, data.id));

export const addCarrierCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    carrierId: string;
    city: string;
    uf: string;
    leadTimeDays: number;
    freightType: string;
  }) => data)
  .handler(async ({ context, data }) => persistCarrierCity(context, data));

export const deleteCarrierCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => removeCarrierCity(context, data.id));
