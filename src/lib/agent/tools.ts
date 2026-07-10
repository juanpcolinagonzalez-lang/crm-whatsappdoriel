import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceLeadToRole } from "@/lib/pipeline/stage";
import { getOrderStatusLabel, searchProducts, productName, productImage } from "@/lib/ecommerce/tiendanube";
import { decrypt } from "@/lib/crypto";

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
          consultar_producto: tool({
                  description:
                            "Consulta precio, stock y disponibilidad de un producto EN VIVO. Usar SIEMPRE antes de informar cualquiera de esos datos; nunca de memoria.",
                  parameters: z.object({
                            consulta: z.string().describe("nombre o descripcion del producto que pide el cliente"),
                  }),
                  execute: async ({ consulta }) => {
                            const { data: conn } = await ctx.db
                              .from("ecommerce_connections")
                              .select("store_id, access_token_enc")
                              .eq("organization_id", ctx.orgId)
                              .eq("platform", "tiendanube")
                              .maybeSingle();
                            if (!conn) return { encontrado: false, motivo: "catalogo no conectado; deriva a una persona" };

                    try {
                                const token = decrypt(conn.access_token_enc);
                                const productos = await searchProducts(conn.store_id, token, consulta);
                                if (!productos.length) {
                                              return { encontrado: false, motivo: "no se encontro ese producto en el catalogo" };
                                }
                                const resultados = productos.slice(0, 3).map((p) => {
                                              const variante = p.variants?.[0];
                                              return {
                                                              nombre: productName(p),
                                                              precio: variante?.promotional_price || variante?.price || null,
                                                              stock: variante?.stock ?? null,
                                                      imagen: productImage(p),
                                              };
                                });
                                return { encontrado: true, resultados };
                    } catch (err) {
                                return { encontrado: false, motivo: "error consultando el catalogo; deriva a una persona" };
                    }
                  },
          }),

          estado_pedido: tool({
                  description:
                            "Consulta el estado de un pedido EN VIVO. Si no devuelve nada, NUNCA digas que el pedido no existe: tranquiliza al cliente (el equipo lo confirma, el seguimiento llega por mail).",
                  parameters: z.object({
                            referencia: z.string().optional().describe("numero de pedido o mail si el cliente lo da"),
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
                                        estado: getOrderStatusLabel(order.status_raw),
                                        pedido: order.external_id,
                            };
                  },
          }),

          derivar_a_persona: tool({
                  description:
                            "Deriva la charla a una persona del equipo. Llamar EN EL MISMO TURNO en que le decis al cliente que lo vas a pasar con alguien.",
                  parameters: z.object({ motivo: z.string() }),
                  execute: async ({ motivo }) => {
                            await ctx.db
                              .from("conversations")
                              .update({ bot_paused_until: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() })
                              .eq("id", ctx.conversationId);
                            return { derivado: true, motivo };
                  },
          }),

          marcar_interes: tool({
                  description:
                            "SILENCIOSO. Llamar cuando hay intencion REAL de compra: pregunta como pagar, envio a su ciudad, stock de un modelo elegido, 'lo quiero', pide el link. NO por un saludo ni una pregunta suelta de precio.",
                  parameters: z.object({}),
                  execute: async () => {
                            await advanceLeadToRole(ctx.db, ctx.orgId, ctx.contactId, "interested");
                            return { ok: true };
                  },
          }),

          abrir_postventa: tool({
                  description:
                            "SILENCIOSO. Llamar SOLO ante un problema real: queja, cambio, garantia, demora, devolucion, producto fallado. Un agradecimiento o una compra NO es un problema.",
                  parameters: z.object({ detalle: z.string() }),
                  execute: async ({ detalle }) => {
                            await advanceLeadToRole(ctx.db, ctx.orgId, ctx.contactId, "post_sale");
                          const urgente = /roto|no (funciona|anda|prende|enciende)|rechazad|estafa|nunca lleg|no lleg|reclamo|urgent|quiero mi dinero|devuelvan|cancelar (mi )?(pedido|compra)|estoy hart/i.test(detalle);
                          if (urgente) {
                                      const { data: lead } = await ctx.db
                                          .from("leads")
                                          .select("id")
                                          .eq("organization_id", ctx.orgId)
                                          .eq("contact_id", ctx.contactId)
                                          .maybeSingle();
                                      if (lead) await ctx.db.from("leads").update({ is_urgent: true }).eq("id", lead.id);
                          }
                                            return { ok: true, detalle, urgente };
                  },
          }),

          marcar_cliente_feliz: tool({
                  description:
                            "SILENCIOSO. Llamar SOLO si el cliente YA recibio el producto y esta conforme. La cortesia de quien todavia espera ('dale, gracias!') no cuenta.",
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
