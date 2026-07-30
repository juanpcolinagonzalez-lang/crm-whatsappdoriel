"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function orgId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  return data?.organization_id ?? null;
}

export async function savePersonalizacion(_prev: unknown, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { error: "Sin sesión." };

const { error } = await supabase
  .from("business_config")
  .update({
    agent_name: String(formData.get("agent_name") ?? ""),
    brand_name: String(formData.get("brand_name") ?? ""),
    base_prompt: String(formData.get("base_prompt") ?? ""),
    updated_at: new Date().toISOString(),
  })
  .eq("organization_id", org);

if (error) return { error: "No se pudo guardar." };
  revalidatePath("/personalizacion");
  return { ok: true };
}
