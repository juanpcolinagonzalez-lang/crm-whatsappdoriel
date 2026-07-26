import { createClient } from "@/lib/supabase/server";
import { ConfigForm } from "./ConfigForm";
import { NoteToggle } from "./NoteToggle";
import { addNote } from "./actions";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const supabase = createClient();

const { data: cfg } = await supabase
  .from("business_config")
  .select("business_info, followup_enabled, owner_notify_phone")
  .maybeSingle();

const { data: notes } = await supabase
  .from("agent_notes")
  .select("id, body, active, created_at")
  .order("created_at", { ascending: false });

return (
  <div className="h-screen overflow-y-auto">
  <header className="px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
  <h1 className="text-sm font-semibold text-slate-900">Ajustes</h1>
  </header>
  
  <div className="mx-auto max-w-3xl p-6 space-y-8">
  <section className="rounded-xl border border-slate-200 bg-white p-6">
  <h2 className="text-base font-semibold text-slate-900 mb-1">Informacion del negocio</h2>
  <p className="text-sm text-slate-500 mb-5">
  Pagos, envios y politicas del negocio. El nombre, la marca y el tono del asistente se editan
  ahora en Personalizacion.
  </p>
    {cfg ? (
    <ConfigForm cfg={cfg as any} />
    ) : (
    <p className="text-sm text-slate-400">
    No hay configuracion para esta organizacion todavia.
    </p>
  )}
  </section>
  
  <section className="rounded-xl border border-slate-200 bg-white p-6">
  <h2 className="text-base font-semibold text-slate-900 mb-1">Notas de correccion</h2>
  <p className="text-sm text-slate-500 mb-5">
  Correcciones puntuales que se inyectan en el prompt al instante. Apaga las que ya no apliquen
  (promos que terminaron, avisos temporales).
  </p>
  
  <form action={addNote} className="flex gap-2 mb-5">
  <input
    name="body" placeholder="Ej: esta semana el envio a CABA es gratis"
    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
    />
  <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900">
  Agregar
  </button>
  </form>
  
  <ul className="divide-y divide-slate-100">
    {(notes ?? []).length === 0 && (
    <li className="py-3 text-sm text-slate-400">Sin notas todavia.</li>
  )}
    {(notes ?? []).map((n) => (
    <li key={n.id} className="flex items-start justify-between gap-3 py-3">
    <span className={`text-sm ${n.active ? "text-slate-700" : "text-slate-400 line-through"}`}>
      {n.body}
    </span>
    <NoteToggle id={n.id} active={n.active} />
    </li>
    ))}
  </ul>
  </section>
  </div>
  </div>
  );
}
