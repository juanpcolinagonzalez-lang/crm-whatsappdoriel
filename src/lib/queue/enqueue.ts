import type { SupabaseClient } from "@supabase/supabase-js";
import { ONCE_PER_ORDER, type FlowTrigger } from "@/types/domain";

/**
 * Encola los envíos de un gatillo: valida opt-in, aplica el anti-duplicado
 * centralizado y crea las filas en `template_sends`. NINGÚN flujo manda directo:
 * todo pasa por la cola que despacha el cron.
 */
export async function enqueueFlowForTrigger(
  db: SupabaseClient,
  orgId: string,
  contactId: string,
  trigger: FlowTrigger,
  variables: Record<string, string> = {}
): Promise<{ queued: boolean; reason?: string }> {
  // 1) Opt-in obligatorio: solo iniciamos contacto con quien consintió.
  const { data: contact } = await db
    .from("contacts")
    .select("opt_in")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact?.opt_in) return { queued: false, reason: "sin opt-in" };

  // 2) Debe existir una plantilla aprobada para el gatillo.
  const { data: template } = await db
    .from("message_templates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("trigger", trigger)
    .eq("active", true)
    .maybeSingle();
  if (!template) return { queued: false, reason: "sin plantilla para el gatillo" };

  // 3) Anti-duplicado centralizado: 24 h por defecto; 30 días para gatillos que
  //    ocurren una vez por pedido (los webhooks del ecommerce se repiten).
  const windowMs = ONCE_PER_ORDER.includes(trigger)
    ? 720 * 60 * 60 * 1000 // 30 días
    : 24 * 60 * 60 * 1000; // 24 h
  const dedupKey = `${trigger}:${contactId}`;
  const since = new Date(Date.now() - windowMs).toISOString();

  const { data: dup } = await db
    .from("template_sends")
    .select("id")
    .eq("organization_id", orgId)
    .eq("dedup_key", dedupKey)
    .gte("created_at", since)
    .limit(1);
  if (dup?.length) return { queued: false, reason: "duplicado dentro de ventana" };

  // 4) Encolar (send_after = now; los flujos con varios pasos suman espera).
  await db.from("template_sends").insert({
    organization_id: orgId,
    contact_id: contactId,
    template_id: template.id,
    trigger,
    variables,
    dedup_key: dedupKey,
    status: "queued",
  });

  return { queued: true };
}
