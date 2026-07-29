import { createClient } from "@/lib/supabase/server";
import { convertirEnCorreccion, descartar } from "./actions";

export const dynamic = "force-dynamic";

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function ActividadPage() {
  const supabase = createClient();

  const { data: reviews } = await supabase
    .from("qa_reviews")
    .select(
      "id, failure, suggestion, resolved, reviewed_at, conversation:conversations(id, contact:contacts(profile_name, phone))"
    )
    .order("reviewed_at", { ascending: false })
    .limit(100);

  const pending = (reviews ?? []).filter((r) => !r.resolved && (r.failure || r.suggestion));
  const resolved = (reviews ?? []).filter((r) => r.resolved).slice(0, 20);

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-screen">
      <header>
        <h1 className="text-lg font-semibold text-slate-900">Actividad del agente</h1>
        <p className="text-sm text-slate-500">
          Revision nocturna de calidad: en que fallo el agente y que correccion sugiere. Convertila en una
          correccion activa o descartala si no aplica.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-medium text-slate-700 mb-2">
          Pendientes{" "}
          {pending.length > 0 && <span className="text-slate-400 font-normal">({pending.length})</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            Sin novedades. El QA nocturno no encontro fallas para revisar.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => {
              const contact = (r as any).conversation?.contact;
              const name = contact?.profile_name || contact?.phone || "Contacto sin nombre";
              const convId = (r as any).conversation?.id;
              return (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-800">{name}</div>
                    <div className="text-xs text-slate-400">{dateLabel(r.reviewed_at)}</div>
                  </div>

                  {r.failure && (
                    <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-700">
                      <span className="text-[10px] uppercase tracking-wide text-rose-400 block mb-0.5">
                        Falla
                      </span>
                      {r.failure}
                    </div>
                  )}
                  {r.suggestion && (
                    <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-sm text-teal-800">
                      <span className="text-[10px] uppercase tracking-wide text-teal-500 block mb-0.5">
                        Sugerencia
                      </span>
                      {r.suggestion}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {convId && (
                      <a
                        href={`/bandeja?c=${convId}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Ver chat
                      </a>
                    )}
                    <form action={convertirEnCorreccion.bind(null, r.id)}>
                      <button className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-800">
                        Convertir en correccion
                      </button>
                    </form>
                    <form action={descartar.bind(null, r.id)}>
                      <button className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100">
                        Descartar
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-700 mb-2">Resueltas recientemente</h2>
        {resolved.length === 0 ? (
          <p className="text-sm text-slate-400">Todavia no resolviste ninguna.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {resolved.map((r) => {
              const contact = (r as any).conversation?.contact;
              const name = contact?.profile_name || contact?.phone || "Contacto sin nombre";
              return (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">{name}</span>
                    <span className="text-xs text-slate-400">{dateLabel(r.reviewed_at)}</span>
                  </div>
                  {(r.failure || r.suggestion) && (
                    <div className="text-slate-400 mt-1">{r.failure || r.suggestion}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
