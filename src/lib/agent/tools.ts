import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceLeadToRole } from "@/lib/pipeline/stage";
import { getOrderStatusLabel } from "@/lib/ecommerce/tiendanube";

export type ToolCtx = {
  db: SupabaseClient;
  orgId: string;
  contactId: string;
  conversationId: string;
};

/**
 * Herramientas del agente. Las de consulta traen datos EN VIVO (regla 2).
 * Las acciones internas son SILENCIOSAS: el agente las llama y responde normal,
 * sin contarle nada al cliente.
 */
export function makeTools(ctx: ToolCtx) {
  return {
    // ── Consultas en vivo ──────────────────────────────────────────────
    consultar_producto: tool({
      description:
        "Consulta precio, stock y disponibilidad de un producto EN VIVO. Usar SIEMPRE antes de informar cualquiera de esos datos; nunca de memoria.",
      parameters: z.object({
        consulta: z.string().describe("nombre o descripción del producto que pide el cliente"),
      }),
      execute: async ({ consulta }) => {
        const { data: conn } = await ctx.db
          .from("ecommerce_connections")
          .select("store_id")
          .eq("organization_id", ctx.orgId)
          .maybeSingle();
        if (!conn) return { encontrado: false, motivo: "catálogo no conectado; derivá a una persona" };
        // TODO(etapa 2): búsqueda real contra la API de Tiendanube (catálogo).
        return { encontrado: false, motivo: "búsqueda de catálogo pendiente de integrar" };
      },
    }),

    estado_pedido: tool({
      description:
        "Consulta el estado de un pedido EN VIVO. Si no devuelve nada, NUNCA digas que el pedido no existe: tranquilizá al cliente (el equipo lo confirma, el seguimiento llega por mail).",
      parameters: z.object({
        referencia: z.string().optional().describe("número de pedido o mail si el cliente lo da"),
      }),
      execute: async ({ referencia }) => {
        const { data: order } = await ctx.db
          .from("orders")
          .select("status_raw, external_id")
          .eq("organization_id", ctx.orgId)
          .eq("contact_id", ctx.contactId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!order) {
          return { encontrado: false, instruccion: "tranquilizar; NO decir que no existe" };
        }
        return {
          encontrado: true,
          estado: getOrderStatusLabel(order.status_raw), // traducido, nunca crudo
          pedido: order.external_id,
        };
      },
    }),

    // ── Acción explícita ───────────────────────────────────────────────
    derivar_a_persona: tool({
      description:
        "Deriva la charla a una persona del equipo. Llamar EN EL MISMO TURNO en que le decís al cliente que lo vas a pasar con alguien.",
      parameters: z.object({ motivo: z.string() }),
      execute: async ({ motivo }) => {
        // Pausa el bot para que no pise a la persona que va a tomar la charla.
        await ctx.db
          .from("conversations")
          .update({ bot_paused_until: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() })
          .eq("id", ctx.conversationId);
        return { derivado: true, motivo };
      },
    }),

    // ── Acciones internas silenciosas (mueven el Kanban) ───────────────
    marcar_interes: tool({
      description:
        "SILENCIOSO. Llamar cuando hay intención REAL de compra: pregunta cómo pagar, envío a su ciudad, stock de un modelo elegido, 'lo quiero', pide el link. NO por un saludo ni una pregunta suelta de precio.",
      parameters: z.object({}),
      execute: async () => {
        await advanceLeadToRole(ctx.db, ctx.orgId, ctx.contactId, "interested");
        return { ok: true };
      },
    }),

    abrir_postventa: tool({
      description:
        "SILENCIOSO. Llamar SOLO ante un problema real: queja, cambio, garantía, demora, devolución, producto fallado. Un agradecimiento o una compra NO es un problema.",
      parameters: z.object({ detalle: z.string() }),
      execute: async ({ detalle }) => {
        await advanceLeadToRole(ctx.db, ctx.orgId, ctx.contactId, "post_sale");
        return { ok: true, detalle };
      },
    }),

    marcar_cliente_feliz: tool({
      description:
        "SILENCIOSO. Llamar SOLO si el cliente YA recibió el producto y está conforme. La cortesía de quien todavía espera ('dale, gracias!') no cuenta.",
      parameters: z.object({}),
      execute: async () => {
        await advanceLeadToRole(ctx.db, ctx.orgId, ctx.contactId, "happy");
        return { ok: true };
      },
    }),

    etiquetar: tool({
      description:
        "SILENCIOSO. Aplica una etiqueta que YA existe. Nunca inventar etiquetas nuevas.",
      parameters: z.object({ etiqueta: z.string() }),
      execute: async ({ etiqueta }) => {
        const { data: tag } = await ctx.db
          .from("tags")
          .select("id")
          .eq("organization_id", ctx.orgId)
          .eq("name", etiqueta)
          .maybeSingle();
        if (!tag) return { ok: false, motivo: "la etiqueta no existe; no se inventa" };
        await ctx.db.from("contact_tags").upsert({ contact_id: ctx.contactId, tag_id: tag.id });
        return { ok: true };
      },
    }),
  };
}
