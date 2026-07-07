import type { SupabaseClient } from "@supabase/supabase-js";

const FRESH_WINDOW_MS = 8 * 60 * 60 * 1000; // ~8 h

/**
 * ¿Es una charla nueva? True si no hubo mensajes REALES en las últimas ~8 h.
 * IGNORA los envíos automáticos (raw.kind = marketing | followup): si lo último
 * que salió fue una plantilla, el agente se presenta igual cuando el cliente
 * responde.
 */
export async function isFreshStart(db: SupabaseClient, conversationId: string): Promise<boolean> {
  const since = new Date(Date.now() - FRESH_WINDOW_MS).toISOString();

  const { data } = await db
    .from("messages")
    .select("id, raw")
    .eq("conversation_id", conversationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  const realMessages = (data ?? []).filter((m) => {
    const kind = (m.raw as any)?.kind;
    return kind !== "marketing" && kind !== "followup";
  });

  // El propio mensaje entrante ya está registrado, así que "nuevo" = ese es el
  // único mensaje real reciente (no hay otro previo dentro de la ventana).
  return realMessages.length <= 1;
}
