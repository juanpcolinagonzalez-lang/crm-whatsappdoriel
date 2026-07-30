"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function orgId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export type LineFormState = { ok?: boolean; error?: string };

export async function saveProductLine(
  _prev: LineFormState,
  formData: FormData
): Promise<LineFormState> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { error: "Sin sesion. Volve a iniciar sesion." };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) return { error: "El nombre de la linea es obligatorio." };

  const payload = { organization_id: org, name, description: description || null };

  const { error } = id
    ? await supabase.from("product_lines").update(payload).eq("id", id).eq("organization_id", org)
    : await supabase.from("product_lines").insert(payload);

  if (error) return { error: "No se pudo guardar la linea de producto." };

  revalidatePath("/conocimiento");
  return { ok: true };
}

export async function deleteProductLine(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { ok: false, error: "No autorizado" };

  const { error } = await supabase.from("product_lines").delete().eq("id", id).eq("organization_id", org);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/conocimiento");
  return { ok: true };
}

export type ProductFormState = { ok?: boolean; error?: string };

export async function saveProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { error: "Sin sesion. Volve a iniciar sesion." };

  const id = String(formData.get("id") ?? "").trim();
  const product_line_id = String(formData.get("product_line_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const colors = String(formData.get("colors") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();

  if (!product_line_id) return { error: "Elegi a que linea de producto pertenece." };
  if (!name) return { error: "El nombre del producto es obligatorio." };

  let price: number | null = null;
  if (priceRaw) {
    const parsed = Number(priceRaw);
    if (Number.isNaN(parsed) || parsed < 0) return { error: "El precio tiene que ser un numero valido." };
    price = parsed;
  }

  const payload = {
    organization_id: org,
    product_line_id,
    name,
    description: description || null,
    colors: colors || null,
    link: link || null,
    price,
  };

  const { error } = id
    ? await supabase.from("products").update(payload).eq("id", id).eq("organization_id", org)
    : await supabase.from("products").insert(payload);

  if (error) return { error: "No se pudo guardar el producto." };

  revalidatePath("/conocimiento");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { ok: false, error: "No autorizado" };

  const { error } = await supabase.from("products").delete().eq("id", id).eq("organization_id", org);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/conocimiento");
  return { ok: true };
}
