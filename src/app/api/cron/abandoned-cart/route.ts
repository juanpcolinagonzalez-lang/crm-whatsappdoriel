import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { decrypt } from "@/lib/crypto";
import { fetchAbandonedCheckouts } from "@/lib/ecommerce/tiendanube";
import { enqueueFlowForTrigger } from "@/lib/queue/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Carritos abandonados: no tienen webhook, se pollean. OJO con los tiempos
 * REALES de la plataforma: no prometer "aviso a los 20 min" si la API lista el
 * carrito recién a la hora.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
  const db = createAdminClient();

  const { data: conns } = await db
    .from("ecommerce_connections")
    .select("organization_id, store_id, access_token_enc");

  let queued = 0;
  for (const conn of conns ?? []) {
    try {
      const token = decrypt(conn.access_token_enc);
      const carts = await fetchAbandonedCheckouts(conn.store_id, token);
      for (const cart of carts ?? []) {
        const tail = String(cart?.contact_phone ?? "").replace(/\D/g, "").slice(-8);
        if (!tail) continue;
        const { data: contact } = await db
          .from("contacts").select("id")
          .eq("organization_id", conn.organization_id).eq("phone_tail", tail).maybeSingle();
        if (!contact) continue;
        const r = await enqueueFlowForTrigger(db, conn.organization_id, contact.id, "abandoned_cart");
        if (r.queued) queued++;
      }
    } catch (err) {
      console.error("[cron abandoned-cart]", err);
    }
  }
  return NextResponse.json({ ok: true, queued });
}
