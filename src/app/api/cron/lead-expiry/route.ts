import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { advanceLeadToRole } from "@/lib/pipeline/stage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Higiene del Kanban: mueve a Perdido/Frío los leads sin actividad tras el plazo
 * configurado por columna. NUNCA vence a quien compró: antes de vencer,
 * reconcilia contra pedidos reales (si hay orden, va a Vendido, no a Perdido).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
  const db = createAdminClient();

  const { data: leads } = await db
    .from("leads")
    .select("id, organization_id, contact_id, last_activity_at, stage:pipeline_stages(role, expire_after_days)");

  let expired = 0, rescued = 0;
  for (const lead of leads ?? []) {
    const stage = (lead as any).stage;
    if (!stage?.expire_after_days) continue;
    const deadline = new Date(lead.last_activity_at).getTime() + stage.expire_after_days * 86400000;
    if (Date.now() < deadline) continue;
    if (stage.role === "sold" || stage.role === "happy" || stage.role === "lost") continue;

    // Reconciliar: ¿tiene un pedido real? -> rescatar a Vendido.
    const { data: order } = await db
      .from("orders").select("id")
      .eq("organization_id", lead.organization_id).eq("contact_id", lead.contact_id).limit(1).maybeSingle();

    if (order) {
      await advanceLeadToRole(db, lead.organization_id, lead.contact_id, "sold");
      rescued++;
    } else {
      // "lost" está al final del pipeline: advanceLeadToRole lo permite (avanza).
      await advanceLeadToRole(db, lead.organization_id, lead.contact_id, "lost");
      expired++;
    }
  }
  return NextResponse.json({ ok: true, expired, rescued });
}
