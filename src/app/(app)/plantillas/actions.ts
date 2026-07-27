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

export async function toggleTemplateActive(
  id: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { ok: false, error: "No autorizado" };

  const { error } = await supabase
    .from("message_templates")
    .update({ active })
    .eq("id", id)
    .eq("organization_id", org);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/plantillas");
  return { ok: true };
}
