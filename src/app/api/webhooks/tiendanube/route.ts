import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { fetchOrder, getOrderStatusLabel, paymentKind, isMotoShipping, formatShippingAddress } from "@/lib/ecommerce/tiendanube";
import { enqueueFlowForTrigger } from "@/lib/queue/enqueue";
import { dispatchQueue } from "@/lib/queue/dispatch";
import type { FlowTrigger } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const raw = await req.text();

  // 1) Validar HMAC (firmado con el client_secret de la app).
  const signature = req.headers.get("x-linkedstore-hmac-sha256") ?? "";
    const expected = createHmac("sha256", config.tiendanube.clientSecret()).update(raw).digest("hex");
    if (!safeEqual(signature, expected)) {
          return new NextResponse("bad signature", { status: 401 });
    }

  const event = JSON.parse(raw) as { store_id: number; event: string; id: number };
    const db = createAdminClient();

  // 2) Resolver la org por el store_id.
  const { data: conn } = await db
      .from("ecommerce_connections")
      .select("organization_id, access_token_enc")
      .eq("store_id", String(event.store_id))
      .maybeSingle();
    if (!conn) return NextResponse.json({ ok: true });

  try {
        const token = decrypt(conn.access_token_enc);
        const order = await fetchOrder(String(event.store_id), token, String(event.id));

      // 3) Upsert en orders (estado logistico; nunca es columna del Kanban).
      // Se crea el contacto si todavia no existe: el cliente nos dio su
      // telefono al comprar en Tiendanube, aunque no nos haya escrito antes
      // por WhatsApp. Asi TODOS los que compran reciben los avisos de su pedido.
      const contactId = await resolveOrCreateContactByPhone(
              db,
              conn.organization_id,
              order.contact_phone,
              order.shipping_address?.name
            );
        await db.from("orders").upsert(
          {
                    organization_id: conn.organization_id,
                    contact_id: contactId,
                    external_id: String(order.id),
                    status_raw: order.status ?? order.payment_status ?? order.shipping_status,
                    payment_method: paymentKind(order.gateway),
                    total: order.total ? Number(order.total) : null,
                    currency: order.currency,
                    data: order as any,
                    updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,external_id" }
              );

      // 4) Mapear el evento a un gatillo de flujo y encolar (si hay contacto).
      const trigger = mapEventToTrigger(event.event, order);
        if (trigger && contactId) {
                const vars: Record<string, string> = {
                          "1": getOrderStatusLabel(order.status),
                          "2": String(order.id),
                };
                if (trigger === "shipped") {
                          vars["3"] = order.shipping_carrier_name || "Andreani";
                          // Preferimos el link de seguimiento; si todavia no esta, mandamos
                  // el numero como respaldo (mejor eso que nada).
                  vars["4"] = order.shipping_tracking_url || order.shipping_tracking_number || "";
                }
                await enqueueFlowForTrigger(db, conn.organization_id, contactId, trigger, vars);
        }

      // 4.5) Envio en moto: pedido pagado + medio de envio "MOTOMENSAJERIA" ->
      // pedir confirmacion de direccion ANTES de despachar (evita ida y vuelta
      // manual por WhatsApp). Independiente del gatillo principal: puede
      // coexistir con "order_confirmed" en el mismo evento order/paid.
      if (event.event === "order/paid" && contactId && isMotoShipping(order.shipping_option)) {
              const direccion = formatShippingAddress(order.shipping_address);
              if (direccion) {
                        await enqueueFlowForTrigger(db, conn.organization_id, contactId, "confirm_address", {
                                    "1": order.shipping_address?.name || "",
                                    "2": String(order.id),
                                    "3": direccion,
                        });
              }
      }

      // 5) Despachar la cola AHORA (no esperar al cron diario): si se encolo
      // algo, sale en segundos en vez de hasta 24hs. El cron diario queda como
      // red de respaldo/reintento para lo que falle aca.
      try {
              await dispatchQueue(db);
      } catch (dispatchErr) {
              console.error("[webhook tiendanube] error despachando cola:", dispatchErr);
      }
  } catch (err) {
        console.error("[webhook tiendanube] error:", err);
  }

  return NextResponse.json({ ok: true });
}

function mapEventToTrigger(event: string, order: { payment_status?: string; gateway?: string }): FlowTrigger | null {
    switch (event) {
      case "order/paid":
              return "order_confirmed";
      case "order/fulfilled":
      case "order/packed":
              return "shipped";
      case "order/cancelled":
              return "cancelled";
      case "order/created":
              // Pago pendiente solo si es transferencia/offline (doble candado).
        if (order.payment_status === "pending" && paymentKind(order.gateway) !== "gateway") {
                  return "payment_pending";
        }
              return null;
      default:
              return null;
    }
}

/**
 * Busca el contacto por telefono y, si no existe, lo crea a partir de la
 * compra en Tiendanube (con opt-in implicito para avisos de SU PEDIDO,
 * categoria utility). Antes esto solo buscaba: si el cliente compraba sin
 * habernos escrito nunca por WhatsApp, no se le mandaba ningun aviso
 * automatico porque no existia el contacto. Ahora se crea para que TODOS
 * los que compran reciban los avisos (confirmacion, envio, etc).
 */
async function resolveOrCreateContactByPhone(
    db: ReturnType<typeof createAdminClient>,
    orgId: string,
    phone: string | undefined,
    name: string | undefined
  ): Promise<string | null> {
    if (!phone) return null;
    const tail = phone.replace(/\D/g, "").slice(-8);
    if (!tail) return null;

  const { data: existing } = await db
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("phone_tail", tail)
      .maybeSingle();
    if (existing) return existing.id;

  const { data: created } = await db
      .from("contacts")
      .insert({
              organization_id: orgId,
              phone,
              phone_tail: tail,
              profile_name: name || null,
              opt_in: true,
      })
      .select("id")
      .single();
    return created?.id ?? null;
}

function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
}
