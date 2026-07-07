import type { SupabaseClient } from "@supabase/supabase-js";
import type { StageRole } from "@/types/domain";

/**
 * Único lugar que resuelve la etapa de un lead. Regla dura del pipeline:
 * un proceso automático solo puede AVANZAR una tarjeta (position mayor),
 * nunca devolverla a una columna anterior. Solo un humano arrastra hacia atrás.
 * TODOS los caminos de escritura automática pasan por acá.
 */
export async function advanceLeadToRole(
  db: SupabaseClient,
  orgId: string,
  contactId: string,
  targetRole: StageRole
): Promise<void> {
  const { data: stages } = await db
    .from("pipeline_stages")
    .select("id, role, position")
    .eq("organization_id", orgId)
    .order("position", { ascending: true });

  if (!stages?.length) return;

  const target = stages.find((s) => s.role === targetRole);
  if (!target) return; // el rol no está mapeado a ninguna columna en esta org

  // Aseguramos que exista el lead.
  const { data: lead } = await db
    .from("leads")
    .select("id, stage_id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (!lead) {
    await db.from("leads").insert({
      organization_id: orgId,
      contact_id: contactId,
      stage_id: target.id,
      last_activity_at: now,
    });
    return;
  }

  const current = stages.find((s) => s.id === lead.stage_id);
  const currentPos = current?.position ?? -1;

  // AVANZA, NO RETROCEDE: solo mover si el destino está más adelante.
  if (target.position > currentPos) {
    await db.from("leads").update({ stage_id: target.id, last_activity_at: now }).eq("id", lead.id);
  } else {
    // Igual registramos actividad para que la higiene de leads no lo venza.
    await db.from("leads").update({ last_activity_at: now }).eq("id", lead.id);
  }
}

/** Devuelve el role de la columna donde está hoy el lead (para gates de envío). */
export async function currentRole(
  db: SupabaseClient,
  orgId: string,
  contactId: string
): Promise<StageRole | null> {
  const { data } = await db
    .from("leads")
    .select("stage:pipeline_stages(role)")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle();
  // @ts-expect-error relación anidada
  return data?.stage?.role ?? null;
}
