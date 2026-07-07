import type { SupabaseClient } from "@supabase/supabase-js";
import { HARD_RULES } from "./rules";

export type AgentContext = {
  orgId: string;
  agentName: string;
  brandName: string;
  contactName: string | null;
  freshStart: boolean; // ¿charla nueva? (ignora envíos automáticos)
};

/**
 * Arma el prompt de sistema uniendo las tres capas de conocimiento:
 *   base_prompt + business_info (config editable)  ← datos
 *   notas activas del dueño                         ← corrección inmediata
 *   reglas duras                                    ← código, inamovibles
 * Una sola verdad: si una nota contradice la config, es un bug (unificar).
 */
export async function buildSystemPrompt(db: SupabaseClient, ctx: AgentContext): Promise<string> {
  const [{ data: cfg }, { data: notes }] = await Promise.all([
    db.from("business_config").select("base_prompt, business_info").eq("organization_id", ctx.orgId).maybeSingle(),
    db.from("agent_notes").select("body").eq("organization_id", ctx.orgId).eq("active", true),
  ]);

  const activeNotes = (notes ?? []).map((n) => `- ${n.body}`).join("\n") || "(sin notas activas)";
  const businessInfo = JSON.stringify(cfg?.business_info ?? {}, null, 2);

  const presentation = ctx.freshStart
    ? ctx.contactName
      ? `Es una charla nueva. Saludá a ${ctx.contactName} por su nombre y presentate una sola vez. No le preguntes el nombre: ya lo sabés.`
      : `Es una charla nueva. Presentate una sola vez.`
    : `NO es una charla nueva. No te re-presentes; seguí la conversación.`;

  return `
Sos ${ctx.agentName}, del equipo de ${ctx.brandName}. Atendés clientes por WhatsApp.

${cfg?.base_prompt || ""}

INFORMACIÓN DEL NEGOCIO (única fuente de verdad de políticas, precios de
referencia, medios de pago, envíos):
${businessInfo}

NOTAS ACTIVAS DEL DUEÑO (correcciones que aplican YA, respetalas al pie):
${activeNotes}

PRESENTACIÓN: ${presentation}

${HARD_RULES}
`.trim();
}
