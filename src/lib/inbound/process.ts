import type { SupabaseClient } from "@supabase/supabase-js";
import type { InternalMessage } from "@/lib/transport";
import { getTransport } from "@/lib/transport";
import { runAgent } from "@/lib/agent";
import { isFreshStart } from "./freshStart";
import { config } from "@/lib/config";
import { getOrderStatusLabel } from "@/lib/ecommerce/tiendanube";

/**
 * Camino principal (§1 de PROCESOS.md). Entra un InternalMessage ya normalizado
 * y hace: resolver contacto + conversación canónica -> registrar -> chequear
 * pausa humana -> esperar ráfaga -> freshStart -> correr agente -> enviar y registrar.
 *
 * Recibe el `orgId` ya resuelto (un phone_number_id -> una organización).
 */
export async function processInbound(db: SupabaseClient, orgId: string, msg: InternalMessage): Promise<void> {
      const phoneTail = msg.phone.slice(-8);

  // 1) Contacto (dedup por últimos dígitos; crear si no existe)
  const contact = await resolveContact(db, orgId, msg, phoneTail);

  // 2) Conversación canónica: la MÁS ANTIGUA. Nunca crear otra si ya hay.
  const conversation = await resolveCanonicalConversation(db, orgId, contact.id);

  // ── Ecos: mensaje que el negocio mandó desde el celular ─────────────────
  if (msg.isEcho) {
          await handleEcho(db, orgId, conversation.id, msg);
          return;
  }

  // 3) Registrar SIEMPRE el entrante (media con placeholder que se actualiza)
  const body = msg.media && !msg.text ? "[procesando…]" : msg.text;
      const { data: inserted } = await db
        .from("messages")
        .insert({
                  organization_id: orgId,
                  conversation_id: conversation.id,
                  sender: "customer",
                  body,
                  media_type: msg.media?.mimeType ?? null,
                  wa_message_id: msg.waMessageId,
                  raw: { kind: "inbound" },
        })
        .select("id")
        .single();
      await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

  // TODO(etapa 2): si hay media, descargar -> Storage -> transcribir/leer y
  // actualizar el body (detección de comprobantes de pago, audios).

  // 4) Pausa humana: si un humano intervino hace poco, el bot no responde.
  if (conversation.bot_paused_until && new Date(conversation.bot_paused_until) > new Date()) {
          return; // queda registrado para la bandeja, pero el bot se calla
  }

  // 4.5) Ráfaga de mensajes: si el cliente manda varios mensajes seguidos (cada
  // uno dispara su propia invocación del webhook), esperamos un toque para que
  // el agente los conteste TODOS juntos en una sola respuesta prolija, en vez
  // de contestar cada uno por separado o pisarse entre invocaciones paralelas.
  // Solo sigue de largo la invocación del ÚLTIMO mensaje de la ráfaga: las
  // anteriores se cortan acá (ya quedaron registradas; el agente las va a leer
  // en el historial cuando responda la última).
  if (inserted?.id) {
          await sleep(config.timing.messageDebounceMs);

        const { data: latest } = await db
            .from("messages")
            .select("id")
            .eq("conversation_id", conversation.id)
            .eq("sender", "customer")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latest && latest.id !== inserted.id) {
                  return; // llegó un mensaje más nuevo: esa invocación responde por todos
        }

        // Un humano pudo haber tomado la conversación mientras esperábamos.
        const { data: freshConv } = await db
            .from("conversations")
            .select("bot_paused_until")
            .eq("id", conversation.id)
            .maybeSingle();
          if (freshConv?.bot_paused_until && new Date(freshConv.bot_paused_until) > new Date()) {
                    return;
          }
  }

  // 5) ¿Charla nueva? (ignora envíos automáticos)
  const freshStart = await isFreshStart(db, conversation.id);

  // 6) Correr el agente
  const { data: cfg } = await db
        .from("business_config")
        .select("agent_name, brand_name")
        .eq("organization_id", orgId)
        .maybeSingle();

  // Historial de compras del contacto (memoria de compras previas).
  const { data: pastOrders } = await db
        .from("orders")
        .select("external_id, status_raw, total, created_at")
        .eq("organization_id", orgId)
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(3);

  const purchaseHistory = pastOrders?.length
        ? `Ya compró ${pastOrders.length} ${pastOrders.length === 1 ? "vez" : "veces"} antes. Pedido más reciente: #${pastOrders[0].external_id}, estado ${getOrderStatusLabel(pastOrders[0].status_raw)}${pastOrders[0].total ? `, total $${pastOrders[0].total}` : ""}.`
          : null;

  let reply: string;
      let imageUrl: string | null = null;
      try {
              const result = await runAgent(
                        db,
                  {
                              orgId,
                              agentName: cfg?.agent_name ?? "Asistente",
                              brandName: cfg?.brand_name ?? "la marca",
                              contactName: contact.profile_name,
                              freshStart,
                              purchaseHistory,
                  },
                  { db, orgId, contactId: contact.id, conversationId: conversation.id }
                      );
              reply = result.text;
              imageUrl = result.imageUrl;
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

  // 8) Si el agente encontró la foto de un producto puntual, la manda también.
  if (imageUrl) {
          try {
                    const sentImage = await transport.sendImage(msg.phone, imageUrl);
                    await db.from("messages").insert({
                                organization_id: orgId,
                                conversation_id: conversation.id,
                                sender: "bot",
                                body: null,
                                media_url: imageUrl,
                                media_type: "image",
                                wa_message_id: sentImage.id,
                                raw: { kind: "agent_image" },
                    });
          } catch (err) {
                    console.error("[processInbound] no se pudo enviar la foto del producto:", err);
          }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
}

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
                      // El cliente escribio primero por este canal: consentimiento
                      // implicito para recibir novedades de SU PEDIDO (utility) por aca.
                      opt_in: true,
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
