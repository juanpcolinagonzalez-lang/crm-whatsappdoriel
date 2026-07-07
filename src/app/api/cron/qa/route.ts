import { NextResponse, type NextRequest } from "next/server";
import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { withModelFallback } from "@/lib/agent/models";
import { buildSystemPrompt } from "@/lib/agent/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Revisión nocturna de calidad: evalúa chats reales concluidos contra las
 * instrucciones del agente y deja notas ("en qué falló" / "mejora sugerida").
 * No re-analiza chats sin actividad nueva. EXCLUYE los chats de prueba (nombre
 * con 🧪) y NO le atribuye al agente los envíos automáticos (marcados aparte).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
  const db = createAdminClient();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: convs } = await db
    .from("conversations")
    .select("id, organization_id, contact:contacts(profile_name), last_message_at")
    .gte("last_message_at", since)
    .limit(50);

  let reviewed = 0;
  for (const c of convs ?? []) {
    // Excluir chats de prueba.
    const name = (c as any).contact?.profile_name ?? "";
    if (name.includes("🧪")) continue;

    // Saltear si ya se revisó sin actividad nueva.
    const { data: prev } = await db
      .from("qa_reviews").select("reviewed_at")
      .eq("conversation_id", c.id).order("reviewed_at", { ascending: false }).limit(1).maybeSingle();
    if (prev && new Date(prev.reviewed_at) >= new Date(c.last_message_at ?? 0)) continue;

    const { data: msgs } = await db
      .from("messages").select("sender, body, raw")
      .eq("conversation_id", c.id).order("created_at", { ascending: true }).limit(60);

    // Transcript: los envíos automáticos se etiquetan "aviso del sistema" para
    // que el revisor NO se los atribuya al agente.
    const transcript = (msgs ?? [])
      .filter((m) => m.body)
      .map((m) => {
        const kind = (m.raw as any)?.kind;
        if (kind === "marketing" || kind === "followup") return `[aviso del sistema] ${m.body}`;
        const who = m.sender === "customer" ? "Cliente" : m.sender === "human" ? "Humano" : "Agente";
        return `${who}: ${m.body}`;
      })
      .join("\n");

    const systemPrompt = await buildSystemPrompt(db, {
      orgId: c.organization_id, agentName: "Agente", brandName: "la marca",
      contactName: null, freshStart: false,
    });

    try {
      const { text } = await withModelFallback(async (model) =>
        generateText({
          model,
          system:
            "Evaluás la actuación del AGENTE (no los avisos del sistema) contra sus reglas. " +
            "Devolvé JSON estricto {\"falla\": string|null, \"sugerencia\": string|null}. " +
            "Si el agente cumplió bien, ambos null. Nada de texto fuera del JSON.",
          prompt: `REGLAS:\n${systemPrompt}\n\nCHAT:\n${transcript}`,
        })
      );

      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      await db.from("qa_reviews").insert({
        organization_id: c.organization_id,
        conversation_id: c.id,
        failure: parsed.falla ?? null,
        suggestion: parsed.sugerencia ?? null,
      });
      reviewed++;
    } catch (err) {
      console.error("[cron qa]", err);
    }
  }
  return NextResponse.json({ ok: true, reviewed });
}
