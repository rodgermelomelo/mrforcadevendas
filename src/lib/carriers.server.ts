export interface CarrierCity {
  id: string;
  city: string;
  uf: string;
  leadTimeDays: number;
  freightType: string;
}

export interface CarrierRecord {
  id: string;
  name: string;
  taxId: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
  cities: CarrierCity[];
}

type Ctx = { supabase: any; userId: string };

const text = (row: any, key: string, fallback = "") => {
  const value = row?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

export async function assertCarrierAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "administrador",
  });
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}

export async function loadCarriers(context: Ctx): Promise<CarrierRecord[]> {
  const [carriersRes, citiesRes] = await Promise.all([
    context.supabase.from("carriers").select("*").order("name").range(0, 999),
    context.supabase
      .from("carrier_cities")
      .select("*")
      .order("uf")
      .order("city")
      .range(0, 4999),
  ]);

  if (carriersRes.error) throw new Error(carriersRes.error.message);
  if (citiesRes.error) throw new Error(citiesRes.error.message);

  const byCarrier = new Map<string, CarrierCity[]>();
  for (const row of citiesRes.data ?? []) {
    const carrierId = text(row, "carrier_id");
    const list = byCarrier.get(carrierId) ?? [];
    list.push({
      id: text(row, "id"),
      city: text(row, "city"),
      uf: text(row, "uf").toUpperCase(),
      leadTimeDays: Number(row?.lead_time_days ?? 0),
      freightType: text(row, "freight_type", "CIF"),
    });
    byCarrier.set(carrierId, list);
  }

  return (carriersRes.data ?? []).map((row: any): CarrierRecord => {
    const id = text(row, "id");
    return {
      id,
      name: text(row, "name"),
      taxId: text(row, "tax_id"),
      phone: text(row, "phone"),
      email: text(row, "email"),
      notes: text(row, "notes"),
      active: row?.active !== false,
      cities: byCarrier.get(id) ?? [],
    };
  });
}

export async function persistCarrier(
  context: Ctx,
  input: { id?: string | undefined; name: string; taxId: string; phone: string; email: string; notes: string; active: boolean },
) {
  await assertCarrierAdmin(context);
  const payload = {
    name: input.name.trim(),
    tax_id: input.taxId.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    notes: input.notes.trim(),
    active: input.active,
  };
  if (!payload.name) throw new Error("Informe o nome da transportadora.");

  const result = input.id
    ? await context.supabase.from("carriers").update(payload).eq("id", input.id)
    : await context.supabase.from("carriers").insert(payload);
  if (result.error) throw new Error(result.error.message);
  return { ok: true } as const;
}

export async function removeCarrier(context: Ctx, id: string) {
  await assertCarrierAdmin(context);
  const { error } = await context.supabase.from("carriers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true } as const;
}

export async function persistCarrierCity(
  context: Ctx,
  input: { carrierId: string; city: string; uf: string; leadTimeDays: number; freightType: string },
) {
  await assertCarrierAdmin(context);
  const city = input.city.trim();
  const uf = input.uf.trim().toUpperCase();
  if (!city || uf.length !== 2) throw new Error("Informe cidade e UF válidos.");

  const { error } = await context.supabase.from("carrier_cities").insert({
    carrier_id: input.carrierId,
    city,
    uf,
    lead_time_days: Number.isFinite(input.leadTimeDays) ? Math.max(0, input.leadTimeDays) : 0,
    freight_type: input.freightType.trim().toUpperCase() || "CIF",
  });
  if (error) {
    throw new Error(
      error.code === "23505" ? "Esta cidade já está cadastrada para a transportadora." : error.message,
    );
  }
  return { ok: true } as const;
}

export async function removeCarrierCity(context: Ctx, id: string) {
  await assertCarrierAdmin(context);
  const { error } = await context.supabase.from("carrier_cities").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true } as const;
}
