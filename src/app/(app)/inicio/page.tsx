import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_ROLES = new Set(["sold", "happy", "lost"]);

function dayKey(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
    const d = new Date(key + "T00:00:00Z");
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

function timeLabel(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
          : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default async function InicioPage() {
    const supabase = createClient();

  const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const since14 = new Date(Date.now() - 14 * DAY_MS).toISOString();
    const nowIso = new Date().toISOString();

  const [
    { data: recentMsgs },
    { data: leads },
    { count: conversationsTotal },
    { count: conversationsHumano },
    { data: chartMsgs },
    { data: recentConversations },
    { data: qaRecent },
    { data: notesRecent },
      ] = await Promise.all([
        supabase.from("messages").select("conversation_id").gte("created_at", since30).limit(10000),
        supabase.from("leads").select("id, stage:pipeline_stages(role)"),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .gt("bot_paused_until", nowIso),
        supabase
          .from("messages")
          .select("created_at")
          .eq("sender", "customer")
          .gte("created_at", since14)
          .limit(10000),
        supabase
          .from("conversations")
          .select("id, last_message_at, bot_paused_until, contact:contacts(profile_name, phone)")
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(5),
        supabase
          .from("qa_reviews")
          .select("failure, suggestion, reviewed_at")
          .order("reviewed_at", { ascending: false })
          .limit(5),
        supabase
          .from("agent_notes")
          .select("body, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

  const activeThreads30 = new Set((recentMsgs ?? []).map((m) => m.conversation_id)).size;

  const openLeads = (leads ?? []).filter((l) => {
        const role = (l as any).stage?.role as string | null | undefined;
        return !role || !CLOSED_ROLES.has(role);
  }).length;

  const humano = conversationsHumano ?? 0;
    const bot = (conversationsTotal ?? 0) - humano;

  const buckets = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
          const key = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
          buckets.set(key, 0);
    }
    for (const m of chartMsgs ?? []) {
          const key = dayKey(m.created_at);
          if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const chartData = [...buckets.entries()].map(([key, value]) => ({ key, label: dayLabel(key), value }));
    const maxValue = Math.max(1, ...chartData.map((d) => d.value));

  const lastConversations = (recentConversations ?? []).map((c) => {
        const contact = (c as any).contact;
        const name = contact?.profile_name || contact?.phone || "Sin nombre";
        return {
                id: c.id,
                name,
                initial: name.trim().charAt(0).toUpperCase() || "?",
                time: timeLabel(c.last_message_at),
                isPaused: !!(c.bot_paused_until && new Date(c.bot_paused_until) > new Date()),
        };
  });

  const hasQa = (qaRecent ?? []).length > 0;
    const noteItems = hasQa
      ? (qaRecent ?? []).map((q, i) => ({
                key: `qa-${i}`,
                text: q.failure ?? q.suggestion ?? "",
                extra: q.suggestion && q.failure ? q.suggestion : null,
      }))
          : (notesRecent ?? []).map((n, i) => ({ key: `note-${i}`, text: n.body, extra: null as string | null }));
    const latestNoteDate = hasQa ? qaRecent?.[0]?.reviewed_at ?? null : notesRecent?.[0]?.created_at ?? null;
    const notesLabel = hasQa ? "Revisión nocturna" : "Notas del dueño";
    const notesDate = latestNoteDate
      ? new Date(latestNoteDate).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
          : null;

  const stats = [
    {
            label: "Conversaciones (30 días)",
            value: activeThreads30,
            hint: "Hilos con actividad en los últimos 30 días",
    },
    {
            label: "Leads abiertos",
            value: openLeads,
            hint: "Tarjetas activas en el tablero",
    },
    {
            label: "Conversaciones activas",
            value: conversationsTotal ?? 0,
            hint: `${bot} bot · ${humano} humano`,
    },
      ];

  return (
        <div className="p-6 space-y-6 overflow-y-auto h-screen">
              <header>
                      <h1 className="text-lg font-semibold text-slate-900">Inicio</h1>
                      <p className="text-sm text-slate-500">Resumen de la actividad del agente y del tablero de leads.</p>
              </header>
        
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stats.map((s) => (
                    <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="text-xs text-slate-400">{s.label}</div>
                                <div className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</div>
                                <div className="mt-1 text-xs text-slate-400">{s.hint}</div>
                    </div>
                  ))}
              </div>
        
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
                                <h2 className="text-sm font-medium text-slate-700 mb-4">Conversaciones por día (14 días)</h2>
                                <div className="flex items-end gap-2 h-40">
                                  {chartData.map((d) => (
                        <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                        <div
                                                            className="w-full rounded-t bg-teal-600"
                                                            style={{ height: `${Math.max(4, (d.value / maxValue) * 100)}%` }}
                                                            title={`${d.value} mensajes`}
                                                          />
                                        <span className="text-[10px] text-slate-400">{d.label}</span>
                        </div>
                      ))}
                                </div>
                      </div>
              
                      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col">
                                <div className="flex items-center justify-between mb-3">
                                            <h2 className="text-sm font-medium text-slate-700">Últimas conversaciones</h2>
                                            <Link href="/bandeja" className="text-xs text-teal-700 hover:underline">
                                                          Ver todas →
                                            </Link>
                                </div>
                        {lastConversations.length === 0 ? (
                      <p className="text-sm text-slate-400">Todavía no hay conversaciones.</p>
                    ) : (
                      <ul className="space-y-3">
                        {lastConversations.map((c) => (
                                        <li key={c.id} className="flex items-center gap-3">
                                                          <div className="h-8 w-8 shrink-0 rounded-full bg-teal-100 text-teal-700 grid place-items-center text-xs font-semibold">
                                                            {c.initial}
                                                          </div>
                                                          <div className="min-w-0 flex-1">
                                                                              <div className="text-sm text-slate-800 truncate">{c.name}</div>
                                                                              <div className="text-xs text-slate-400">{c.time}</div>
                                                          </div>
                                          {c.isPaused && (
                                                              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                                                                    Humano
                                                              </span>
                                                          )}
                                        </li>
                                      ))}
                      </ul>
                                )}
                      </div>
              </div>
        
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h2 className="text-sm font-medium text-slate-700">Notas del agente</h2>
                      <p className="text-xs text-slate-400 mb-3">
                        {notesDate ? `${notesLabel} · ${notesDate} · ${noteItems.length} notas` : "Todavía no hay notas registradas."}
                      </p>
                {noteItems.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin novedades por ahora.</p>
                  ) : (
                    <ul className="space-y-2">
                      {noteItems.map((n) => (
                                    <li key={n.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                      {n.text}
                                      {n.extra && <div className="mt-1 text-slate-400">{n.extra}</div>}
                                    </li>
                                  ))}
                    </ul>
                      )}
              </div>
        </div>
      );
}
