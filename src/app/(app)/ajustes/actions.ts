"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function orgId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  return data?.organization_id ?? null;
}

export async function saveBusinessConfig(_prev: unknown, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { error: "Sin sesión." };

  const infoRaw = String(formData.get("business_info") ?? "{}");
  let business_info: unknown;
  try {
    business_info = JSON.parse(infoRaw);
  } catch {
    return { error: "La información del negocio no es un JSON válido." };
  }

  const { error } = await supabase
    .from("business_config")
    .update({
      agent_name: String(formData.get("agent_name") ?? ""),
      brand_name: String(formData.get("brand_name") ?? ""),
            owner_notify_phone: String(formData.get("owner_notify_phone") ?? ""),
      base_prompt: String(formData.get("base_prompt") ?? ""),
      business_info,
      followup_enabled: formData.get("followup_enabled") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", org);

  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/ajustes");
  return { ok: true };
}

export async function addNote(formData: FormData): Promise<void> {
  const supabase = createClient();
  const org = await orgId(supabase);
  const body = String(formData.get("body") ?? "").trim();
  if (!org || !body) return;
  await supabase.from("agent_notes").insert({ organization_id: org, body, active: true, source: "owner" });
  revalidatePath("/ajustes");
}

export async function toggleNote(id: string, active: boolean): Promise<void> {
  const supabase = createClient();
  await supabase.from("agent_notes").update({ active }).eq("id", id);
  revalidatePath("/ajustes");
}
