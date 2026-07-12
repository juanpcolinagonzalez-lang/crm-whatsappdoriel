import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresher } from "./RealtimeRefresher";
import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { reactivateAgent } from "./actions";

export const dynamic = "force-dynamic";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default async function BandejaPage({ searchParams }: { searchParams: { c?: string } }) {
  const supabase = createClient();
  const activeId = searchParams.c ?? null;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, last_message_at, bot_paused_until, contact:contacts(id, profile_name, phone)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const ids = (conversations ?? []).map((c) => c.id);
  const previews = new Map<string, string>();
  if (ids.length) {
    const { data: recent } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(200);
    for (const m of recent ?? []) {
      if (!previews.has(m.conversation_id)) previews.set(m.conversation_id, m.body ?? "");
    }
  }

  // Etiqueta de urgencia: cruzamos los contact_id con leads.is_urgent para
  // marcar en la lista quién necesita atención prioritaria (dolor típico de
  // soporte: reclamos que se pierden entre consultas normales).
  const contactIds = (conversations ?? [])
    .map((c) => (c as any).contact?.id)
    .filter(Boolean);
  const urgentContactIds = new Set<string>();
  if (contactIds.length) {
    const { data: urgentLeads } = await supabase
      .from("leads")
      .select("contact_id")
      .in("contact_id", contactIds)
      .eq("is_urgent", true);
    for (const l of urgentLeads ?? []) urgentContactIds.add((l as any).contact_id);
  }

  const listItems = (conversations ?? []).map((c) => {
    const contact = (c as any).contact;
    return {
      id: c.id,
      name: contact?.profile_name || contact?.phone || "Sin nombre",
      phone: contact?.phone ?? "",
      preview: previews.get(c.id) || "",
      time: timeLabel(c.last_message_at),
      isPaused: !!(c.bot_paused_until && new Date(c.bot_paused_until) > new Date()),
      isUrgent: contact?.id ? urgentContactIds.has(contact.id) : false,
    };
  });
  const urgentCount = listItems.filter((c) => c.isUrgent).length;

  const { data: thread } = activeId
    ? await supabase
        .from("messages")
        .select("id, sender, body, created_at, raw")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200)
    : { data: null };

  const active = (conversations ?? []).find((c) => c.id === activeId);
  const paused = active?.bot_paused_until && new Date(active.bot_paused_until) > new Date();

  // Respuestas rápidas para el asesor humano: se arman con los mismos datos
  // que ya usa el agente (business_info), nunca con texto inventado.
  const { data: cfg } = await supabase.from("business_config").select("business_info").maybeSingle();
  const info = (cfg?.business_info ?? {}) as any;
  const quickReplies = [
    info?.envios?.costo ? { label: "Envío", text: info.envios.costo } : null,
    info?.pagos?.transferencia_deposito ? { label: "Transferencia", text: info.pagos.transferencia_deposito } : null,
    info?.pagos?.tarjetas_bancarias ? { label: "Cuotas", text: info.pagos.tarjetas_bancarias } : null,
    { label: "Gracias", text: "¡Gracias a vos! Cualquier cosa que necesites, escribinos 🙌" },
  ].filter(Boolean) as { label: string; text: string }[];

  return (
    <div className="h-screen flex">
      <RealtimeRefresher />

      <div className="w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-slate-900">Bandeja</h1>
          {urgentCount > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
              {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
            </span>
          )}
        </header>
        <ConversationList conversations={listItems} activeId={activeId} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
        {!active ? (
          <div className="flex-1 grid place-items-center text-sm text-slate-400">
            Elegí una conversación para ver el chat.
          </div>
        ) : (
          <>
            <header className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {(active as any).contact?.profile_name || (active as any).contact?.phone}
                </div>
                <div className="text-xs text-slate-400">{(active as any).contact?.phone}</div>
              </div>
              {paused && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                    Bot en pausa · lo atiende una persona
                  </span>
                  <form action={reactivateAgent.bind(null, active.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-800"
                    >
                      Reactivar agente
                    </button>
                  </form>
                </div>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {(thread ?? []).map((m) => {
                const kind = (m.raw as any)?.kind;
                const isAuto = kind === "marketing" || kind === "followup";
                const fromCustomer = m.sender === "customer";
                return (
                  <div key={m.id} className={`flex ${fromCustomer ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                        fromCustomer
                          ? "bg-white border border-slate-200 text-slate-800"
                          : isAuto
                          ? "bg-slate-200 text-slate-600"
                          : m.sender === "human"
                          ? "bg-teal-700 text-white"
                          : "bg-teal-600/90 text-white"
                      }`}
                    >
                      {isAuto && (
                        <div className="mb-0.5 text-[10px] uppercase tracking-wide opacity-70">Aviso automático</div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className={`mt-1 text-[10px] ${fromCustomer ? "text-slate-400" : "text-white/70"}`}>
                        {timeLabel(m.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Composer conversationId={active.id} quickReplies={quickReplies} />
          </>
        )}
      </div>
    </div>
  );
}
