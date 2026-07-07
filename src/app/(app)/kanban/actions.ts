"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Mover un lead de columna a mano. Un humano arrastrando SÍ puede mover en
 * cualquier dirección (la regla "avanza, no retrocede" es solo para los procesos
 * automáticos, ver lib/pipeline/stage.ts).
 */
export async function moveLead(leadId: string, stageId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("leads")
    .update({ stage_id: stageId, last_activity_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { error: "No se pudo mover la tarjeta." };
  revalidatePath("/kanban");
  return {};
}
