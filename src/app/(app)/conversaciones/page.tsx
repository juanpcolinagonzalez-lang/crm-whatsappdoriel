import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

type TabKey = "todas" | "urgentes" | "pausadas" | "activas";

const TABS: { key: TabKey; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "urgentes", label: "Urgentes" },
  { key: "pausadas", label: "Bot en pausa" },
  { key: "activas", label: "Bot activo" },
];

export default async function ConversacionesPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const tab = (searchParams.tab as TabKey) ?? "todas";

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, last_message_at, bot_paused_until, contact:contacts(id, profile_name, phone)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const ids = (conversations ?? []).map((c) => c.id);
  const previews = new Map<string, string>();
  if (ids.length) {
    const { data: recent } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(400);
    for (const m of recent ?? []) {
      if (!previews.has(m.conversation_id)) previews.set(m.conversation_id, m.body ?? "");
    }
  }

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

  const now = new Date();
  const items = (conversations ?? []).map((c) => {
    const contact = (c as any).contact;
    const isPaused = !!(c.bot_paused_until && new Date(c.bot_paused_until) > now);
    return {
      id: c.id,
      name: contact?.profile_name || contact?.phone || "Sin nombre",
      phone: contact?.phone ?? "",
      preview: previews.get(c.id) || "",
      time: timeLabel(c.last_message_at),
      isPaused,
      isUrgent: contact?.id ? urgentContactIds.has(contact.id) : false,
    };
  });

  const counts: Record<TabKey, number> = {
    todas: items.length,
    urgentes: items.filter((i) => i.isUrgent).length,
    pausadas: items.filter((i) => i.isPaused).length,
    activas: items.filter((i) => !i.isPaused).length,
  };

  const filtered = items.filter((i) => {
    if (tab === "urgentes") return i.isUrgent;
    if (tab === "pausadas") return i.isPaused;
    if (tab === "activas") return !i.isPaused;
    return true;
  });

  return (
    <div className="h-screen flex flex-col">
      <header className="px-6 py-4 border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Conversaciones</h1>
        <p className="text-sm text-slate-400 mt-0.5">Todos los hilos de WhatsApp, con conteo por estado.</p>
      </header>

      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/conversaciones?tab=${t.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key
                ? "bg-teal-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-80">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        {filtered.length === 0 ? (
          <div className="grid place-items-center h-full text-sm text-slate-400">
            No hay conversaciones en esta vista.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/bandeja?c=${c.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {c.name}
                      </span>
                      {c.isUrgent && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                          Urgente
                        </span>
                      )}
                      {c.isPaused && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Bot en pausa
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {c.preview || "Sin mensajes todavia"}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-400">{c.time}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
