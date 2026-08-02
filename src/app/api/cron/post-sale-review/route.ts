import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { enqueueFlowForTrigger } from "@/lib/queue/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seguimiento post-venta (14 dias despues de "delivered"): le preguntamos al
 * cliente si esta todo bien con el producto y, si responde bien, le pedimos
 * una resena. Crea un caso en postventa_casos (tipo "seguimiento") para que
 * el equipo lo vea desde la pantalla de Post-venta, y encola el mensaje via
 * la cola de plantillas (gatillo "review_request"). No manda nada hasta que
 * exista una plantilla de Meta aprobada y activa para ese gatillo en
 * message_templates (mismo mecanismo que el resto de los avisos).
 */
export async function GET(req: NextRequest) {
    if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
    const db = createAdminClient();

  const from = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

const { data: deliveredSends } = await db
  .from("template_sends")
  .select("organization_id, contact_id, variables, sent_at")
  .eq("trigger", "delivered")
  .eq("status", "sent")
  .gte("sent_at", from)
  .lte("sent_at", to);

let queued = 0;
  for (const row of deliveredSends ?? []) {
      const orderNumber = (row.variables as Record<string, string> | null)?.["1"] ?? "";

    const { data: existing } = await db
      .from("postventa_casos")
      .select("id")
      .eq("organization_id", row.organization_id)
      .eq("contact_id", row.contact_id)
      .eq("tipo", "seguimiento")
      .gte("created_at", from)
      .limit(1);
      if (existing?.length) continue;

  const r = await enqueueFlowForTrigger(
    db,
    row.organization_id,
    row.contact_id,
    "review_request",
    orderNumber ? { "1": orderNumber } : {}
    );
    if (!r.queued) continue;
    queued++;

  await db.from("postventa_casos").insert({
    organization_id: row.organization_id,
    contact_id: row.contact_id,
    tipo: "seguimiento",
    estado: "abierto",
    titulo: orderNumber ? `Seguimiento post-venta - pedido ${orderNumber}` : "Seguimiento post-venta",
    fecha_programada: new Date().toISOString(),
    mensaje_enviado_at: new Date().toISOString(),
    resenia_solicitada: true,
  });
  }
  return NextResponse.json({ ok: true, queued });
}
