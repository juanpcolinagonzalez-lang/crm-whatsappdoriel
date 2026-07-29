"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function orgId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  return data?.organization_id ?? null;
}

/**
 * Convierte una nota del QA nocturno en una correccion activa: crea un
 * agent_notes con source "qa" (se inyecta al prompt al instante, regla de oro
 * 9) y marca la revision como resuelta.
 */
export async function convertirEnCorreccion(reviewId: string): Promise<void> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return;

  const { data: review } = await supabase
    .from("qa_reviews")
    .select("suggestion, failure")
    .eq("id", reviewId)
    .maybeSingle();

  const body = (review?.suggestion || review?.failure || "").trim();
  if (body) {
    await supabase.from("agent_notes").insert({ organization_id: org, body, active: true, source: "qa" });
  }
  await supabase.from("qa_reviews").update({ resolved: true }).eq("id", reviewId);
  revalidatePath("/actividad");
}

/** Descarta la nota del QA sin crear una correccion. */
export async function descartar(reviewId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("qa_reviews").update({ resolved: true }).eq("id", reviewId);
  revalidatePath("/actividad");
}
