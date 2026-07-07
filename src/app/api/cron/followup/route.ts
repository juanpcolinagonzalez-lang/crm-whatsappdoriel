import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { enqueueFlowForTrigger } from "@/lib/queue/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seguimiento: contacta leads que quedaron en silencio (~23 h después del último
 * intercambio, aún dentro de la ventana de 24 h). Un solo seguimiento por
 * silencio; no perseguir. Se saltea si ya compró, mandó comprobante, un humano
 * intervino, el chat se cerró, o el seguimiento global está apagado.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
  const db = createAdminClient();

  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

  const { data: convs } = await db
    .from("conversations")
    .select("id, organization_id, contact_id, closed, bot_paused_until, last_message_at")
    .eq("closed", false)
    .gte("last_message_at", from)
    .lte("last_message_at", to);

  let queued = 0;
  for (const c of convs ?? []) {
    // Llave global de seguimiento por organización.
    const { data: cfg } = await db
      .from("business_config").select("followup_enabled")
      .eq("organization_id", c.organization_id).maybeSingle();
    if (!cfg?.followup_enabled) continue;

    // Humano intervino recientemente -> no perseguir.
    if (c.bot_paused_until && new Date(c.bot_paused_until) > new Date()) continue;

    // TODO(etapa 2): saltear si ya compró o mandó comprobante (chequear orders
    // y raw.kind de los últimos mensajes). El enqueue ya evita duplicados.
    const r = await enqueueFlowForTrigger(db, c.organization_id, c.contact_id, "followup");
    if (r.queued) queued++;
  }
  return NextResponse.json({ ok: true, queued });
}
