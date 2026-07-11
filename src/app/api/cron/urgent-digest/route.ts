import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { getTransport } from "@/lib/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
    const db = createAdminClient();

  const { data: configs } = await db
      .from("business_config")
      .select("organization_id, owner_notify_phone")
      .not("owner_notify_phone", "is", null);

  let sent = 0;
    for (const cfg of configs ?? []) {
          if (!cfg.owner_notify_phone) continue;
          try {
                  const { data: leads } = await db
                    .from("leads")
                    .select("id, is_urgent, contact:contacts(profile_name, phone), stage:pipeline_stages(role, label)")
                    .eq("organization_id", cfg.organization_id)
                    .eq("is_urgent", true);

            const abiertos = (leads ?? []).filter((l: any) => {
                      const role = l.stage?.role;
                      return role !== "sold" && role !== "happy" && role !== "lost";
            });

            if (!abiertos.length) continue;

            const lineas = abiertos.slice(0, 15).map((l: any) => {
                      const nombre = l.contact?.profile_name || l.contact?.phone || "Cliente";
                      const etapa = l.stage?.label || "sin etapa";
                      return "- " + nombre + " (" + etapa + ")";
            });

            const texto =
                      "Resumen diario: " + abiertos.length + " reclamo(s) urgente(s) sin resolver\n\n" +
                      lineas.join("\n") +
                      (abiertos.length > 15 ? "\ny " + (abiertos.length - 15) + " mas." : "");

            const transport = getTransport("whatsapp");
                  await transport.sendMessage(cfg.owner_notify_phone, texto);
                  sent++;
          } catch (err) {
                  console.error("[cron urgent-digest]", err);
          }
    }
    return NextResponse.json({ ok: true, sent });
}
