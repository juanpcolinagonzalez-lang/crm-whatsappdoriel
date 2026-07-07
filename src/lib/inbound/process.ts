import type { SupabaseClient } from "@supabase/supabase-js";
import type { InternalMessage } from "@/lib/transport";
import { getTransport } from "@/lib/transport";
import { runAgent } from "@/lib/agent";
import { isFreshStart } from "./freshStart";
import { config } from "@/lib/config";

/**
 * Camino principal (§1 de PROCESOS.md). Entra un InternalMessage ya normalizado
 * y hace: resolver contacto + conversación canónica -> registrar -> chequear
 * pausa humana -> freshStart -> correr agente -> enviar y registrar.
 *
 * Recibe el `orgId` ya resuelto (un phone_number_id -> una organización).
 */
export async function processInbound(db: SupabaseClient, orgId: string, msg: InternalMessage): Promise<void> {
  const phoneTail = msg.phone.slice(-8);

  // 1) Contacto (dedup por últimos dígitos; crear si no existe)
  const contact = await resolveContact(db, orgId, msg, phoneTail);

  // 2) Conversación canónica: la MÁS ANTIGUA. Nunca crear otra si ya hay.
  const conversation = await resolveCanonicalConversation(db, orgId, contact.id);

  // ── Ecos: mensaje que el negocio mandó desde el celular ──────────────
  if (msg.isEcho) {
    await handleEcho(db, orgId, conversation.id, msg);
    return;
  }

  // 3) Registrar SIEMPRE el entrante (media con placeholder que se actualiza)
  const body = msg.media && !msg.text ? "[procesando…]" : msg.text;
  await db.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversation.id,
    sender: "customer",
    body,
    media_type: msg.media?.mimeType ?? null,
    wa_message_id: msg.waMessageId,
    raw: { kind: "inbound" },
  });
  await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

  // TODO(etapa 2): si hay media, descargar -> Storage -> transcribir/leer y
  // actualizar el body (detección de comprobantes de pago, audios).

  // 4) Pausa humana: si un humano intervino hace poco, el bot no responde.
  if (conversation.bot_paused_until && new Date(conversation.bot_paused_until) > new Date()) {
    return; // queda registrado para la bandeja, pero el bot se calla
  }

  // 5) ¿Charla nueva? (ignora envíos automáticos)
  const freshStart = await isFreshStart(db, conversation.id);

  // 6) Correr el agente
  const { data: cfg } = await db
    .from("business_config")
    .select("agent_name, brand_name")
    .eq("organization_id", orgId)
    .maybeSingle();

  let reply: string;
  try {
    const result = await runAgent(
      db,
      {
        orgId,
        agentName: cfg?.agent_name ?? "Asistente",
        brandName: cfg?.brand_name ?? "la marca",
        contactName: contact.profile_name,
        freshStart,
      },
      { db, orgId, contactId: contact.id, conversationId: conversation.id }
    );
    reply = result.text;
  } catch (err) {
    // La cadena de modelos se agotó (sin cuota / caída). No dejamos al cliente
    // colgado: mensaje mínimo y a la bandeja. NO marcamos nada como enviado que
    // no haya salido (el envío de abajo tiene su propio manejo de error).
    console.error("[processInbound] agente sin respuesta:", err);
    reply = "¡Hola! En un momento te responde alguien del equipo.";
  }

  // 7) Enviar y registrar. Si el envío falla, se propaga: nunca registrar como
  // enviado algo que no salió.
  const transport = getTransport(msg.channel);
  const sent = await transport.sendMessage(msg.phone, reply);

  await db.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversation.id,
    sender: "bot",
    body: reply,
    wa_message_id: sent.id,
    raw: { kind: "agent" },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

async function resolveContact(db: SupabaseClient, orgId: string, msg: InternalMessage, phoneTail: string) {
  const { data: existing } = await db
    .from("contacts")
    .select("id, profile_name")
    .eq("organization_id", orgId)
    .eq("phone_tail", phoneTail)
    .maybeSingle();

  if (existing) {
    // Completar el nombre de perfil si no lo teníamos.
    if (!existing.profile_name && msg.profileName) {
      await db.from("contacts").update({ profile_name: msg.profileName }).eq("id", existing.id);
      existing.profile_name = msg.profileName;
    }
    return existing;
  }

  const { data: created } = await db
    .from("contacts")
    .insert({
      organization_id: orgId,
      phone: msg.phone,
      phone_tail: phoneTail,
      profile_name: msg.profileName,
    })
    .select("id, profile_name")
    .single();
  return created!;
}

async function resolveCanonicalConversation(db: SupabaseClient, orgId: string, contactId: string) {
  const { data: existing } = await db
    .from("conversations")
    .select("id, bot_paused_until")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true }) // la MÁS ANTIGUA
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await db
    .from("conversations")
    .insert({ organization_id: orgId, contact_id: contactId, channel: "whatsapp" })
    .select("id, bot_paused_until")
    .single();
  return created!;
}

/**
 * Eco: mensaje que el negocio mandó desde afuera del CRM (app del celular).
 * Se registra como humano y se pausa el bot. Los ecos del PROPIO CRM también
 * llegan: se deduplican por ventana corta contra los últimos salientes.
 */
async function handleEcho(db: SupabaseClient, orgId: string, conversationId: string, msg: InternalMessage) {
  // ¿Es eco de algo que ya mandó el propio CRM/bot? -> deduplicar, no pausar.
  const since = new Date(Date.now() - config.timing.echoDedupMs).toISOString();
  const { data: recentOutbound } = await db
    .from("messages")
    .select("id, body")
    .eq("conversation_id", conversationId)
    .in("sender", ["bot", "human"])
    .gte("created_at", since);

  const isOwnEcho = (recentOutbound ?? []).some((m) => m.body && msg.text && m.body.trim() === msg.text.trim());
  if (isOwnEcho) return; // ya está registrado; no duplicar ni pausar

  // Eco real desde el celular: registrar como humano y pausar el bot.
  await db.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    sender: "human",
    body: msg.text ?? "[media]",
    wa_message_id: msg.waMessageId,
    raw: { kind: "echo" },
  });
  await db
    .from("conversations")
    .update({ bot_paused_until: new Date(Date.now() + config.timing.humanPauseMs).toISOString() })
    .eq("id", conversationId);
}
