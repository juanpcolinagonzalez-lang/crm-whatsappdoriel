import type { SupabaseClient } from "@supabase/supabase-js";
import { getTransport } from "@/lib/transport";
import { currentRole } from "@/lib/pipeline/stage";
import type { TemplateComponent } from "@/lib/transport";

const MAX_ATTEMPTS = 5;

/**
 * Procesa la cola de envíos (lo llama el cron cada 5 min). Aplica los GATES
 * justo antes de mandar —es más barato saltear un envío que pedir perdón por un
 * mensaje irrelevante— y NUNCA marca `sent` algo que no salió.
 */
export async function dispatchQueue(db: SupabaseClient): Promise<{ sent: number; skipped: number; failed: number }> {
  const now = new Date().toISOString();
  const { data: pending } = await db
    .from("template_sends")
    .select("*, template:message_templates(meta_name, language, body, default_variables), contact:contacts(phone)")
    .eq("status", "queued")
    .lte("send_after", now)
    .lt("attempts", MAX_ATTEMPTS)
    .order("send_after", { ascending: true })
    .limit(50);

  let sent = 0, skipped = 0, failed = 0;

  for (const row of pending ?? []) {
    // ── Gate de etapa: el contacto debe SEGUIR en la situación que originó el
    //    aviso (ej. "pago pendiente" solo si el lead sigue en esa columna).
    if (row.trigger === "payment_pending") {
      const role = await currentRole(db, row.organization_id, row.contact_id);
      if (role !== "payment_pending") {
        await mark(db, row.id, "skipped", "gate de etapa: ya no aplica");
        skipped++;
        continue;
      }
    }

    // ── Gate de condición del gatillo (doble candado, también al encolar) ──
    if (row.trigger === "payment_pending") {
      const { data: order } = await db
        .from("orders")
        .select("payment_method")
        .eq("organization_id", row.organization_id)
        .eq("contact_id", row.contact_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const pm = order?.payment_method;
      if (pm && pm !== "transfer" && pm !== "offline") {
        await mark(db, row.id, "skipped", "gate de condición: pago no offline");
        skipped++;
        continue;
      }
    }

    // ── Enviar la plantilla ────────────────────────────────────────────
    try {
      const tpl = (row as any).template;
      const phone = (row as any).contact?.phone as string;
      const vars = { ...(tpl?.default_variables ?? {}), ...(row.variables ?? {}) } as Record<string, string>;
      const components = buildComponents(vars);

      const transport = getTransport("whatsapp");
      const res = await transport.sendTemplate(phone, tpl.meta_name, tpl.language, components);

      // Registrar en el chat (sender = bot, marcado marketing) y marcar sent.
      const { data: conv } = await db
        .from("conversations")
        .select("id")
        .eq("organization_id", row.organization_id)
        .eq("contact_id", row.contact_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (conv) {
        await db.from("messages").insert({
          organization_id: row.organization_id,
          conversation_id: conv.id,
          sender: "bot",
          body: renderBody(tpl.body, vars), // copia legible con variables resueltas
          wa_message_id: res.id,
          raw: { kind: "marketing", trigger: row.trigger },
        });
      }

      await db.from("template_sends").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
      sent++;
    } catch (err) {
      // Backoff: sumamos intento y guardamos el motivo. Solo `failed` definitivo
      // al agotar los intentos. NUNCA marcar sent lo que no salió.
      const attempts = (row.attempts ?? 0) + 1;
      const status = attempts >= MAX_ATTEMPTS ? "failed" : "queued";
      const nextAfter = new Date(Date.now() + Math.pow(2, attempts) * 60 * 1000).toISOString();
      await db
        .from("template_sends")
        .update({ attempts, status, last_error: String((err as Error).message), send_after: nextAfter })
        .eq("id", row.id);
      failed++;
    }
  }

  return { sent, skipped, failed };
}

/** Variables posicionales {{1}},{{2}}... en el body de la plantilla de Meta. */
function buildComponents(vars: Record<string, string>): TemplateComponent[] {
  const keys = Object.keys(vars).sort();
  if (!keys.length) return [];
  return [{ type: "body", parameters: keys.map((k) => ({ type: "text", text: String(vars[k]) })) }];
}

/** Resuelve {{1}},{{2}}... en la copia legible que se registra en el chat. */
function renderBody(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, i) => vars[i] ?? vars[String(Number(i))] ?? `{{${i}}}`);
}

async function mark(db: SupabaseClient, id: string, status: string, reason: string) {
  await db.from("template_sends").update({ status, last_error: reason }).eq("id", id);
}
