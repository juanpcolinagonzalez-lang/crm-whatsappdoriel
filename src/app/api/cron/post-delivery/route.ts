import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { enqueueFlowForTrigger } from "@/lib/queue/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Post-entrega: Tiendanube no manda un webhook de "entregado", asi que
 * estimamos la entrega por tiempo transcurrido desde que se mando el aviso
 * de "shipped" (el negocio promete 3 a 5 dias habiles de entrega). Buscamos
 * envios de "shipped" ya mandados hace entre 5 y 8 dias y encolamos
 * "delivered". El anti-duplicado de enqueueFlowForTrigger evita mandarlo
 * dos veces si el cron vuelve a ver el mismo envio.
 */
export async function GET(req: NextRequest) {
    if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
    const db = createAdminClient();

  const from = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: shippedSends } = await db
      .from("template_sends")
      .select("organization_id, contact_id, variables, sent_at")
      .eq("trigger", "shipped")
      .eq("status", "sent")
      .gte("sent_at", from)
      .lte("sent_at", to);

  let queued = 0;
    for (const row of shippedSends ?? []) {
          const orderId = (row.variables as Record<string, string> | null)?.["2"] ?? "";
          const r = await enqueueFlowForTrigger(db, row.organization_id, row.contact_id, "delivered", { "1": orderId });
          if (r.queued) queued++;
    }
    return NextResponse.json({ ok: true, queued });
}
