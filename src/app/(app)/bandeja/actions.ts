"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTransport } from "@/lib/transport";
import { config } from "@/lib/config";

/**
 * Responder un chat a mano desde la bandeja. Registra como mensaje "humano" y
 * pausa el bot para que no pise al asesor. Envía por WhatsApp (texto libre: solo
 * dentro de la ventana de 24 h; si Meta lo rechaza, se muestra el error).
 */
export async function sendReply(conversationId: string, text: string): Promise<{ error?: string }> {
  const body = text.trim();
  if (!body) return { error: "Escribí algo para enviar." };

  const supabase = createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, organization_id, contact:contacts(phone)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { error: "No encontramos la conversación." };

  const phone = (conv as any).contact?.phone as string;

  try {
    const transport = getTransport("whatsapp");
    const sent = await transport.sendMessage(phone, body);

    await supabase.from("messages").insert({
      organization_id: conv.organization_id,
      conversation_id: conversationId,
      sender: "human",
      body,
      wa_message_id: sent.id,
      raw: { kind: "manual" },
    });

    // Pausa humana: el bot no interviene mientras el asesor atiende.
    await supabase
      .from("conversations")
      .update({
        bot_paused_until: new Date(Date.now() + config.timing.humanPauseMs).toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    revalidatePath("/bandeja");
    return {};
  } catch (err: any) {
    // 131047 = ventana de 24 h cerrada -> hay que mandar una plantilla aprobada.
    if (err?.code === 131047) {
      return { error: "La ventana de 24 h está cerrada. Mandá una plantilla aprobada." };
    }
    return { error: "No se pudo enviar. Reintentá en un momento." };
  }
}


/**
 * Devuelve la conversacion al agente antes de que se cumplan las 12 h de
 * pausa automatica. Se usa cuando el dueno ya resolvio el tema a mano.
 */
export async function reactivateAgent(conversationId: string): Promise<void> {
    const supabase = createClient();
    await supabase.from("conversations").update({ bot_paused_until: null }).eq("id", conversationId);
    revalidatePath("/bandeja");
}
