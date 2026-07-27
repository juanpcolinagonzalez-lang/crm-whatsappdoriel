import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TemplatesManager from "./TemplatesManager";

export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = profile?.organization_id ?? null;

  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, meta_name, trigger, language, category, body, active, default_variables, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const { data: sends } = await supabase
    .from("template_sends")
    .select("id, contact_id, trigger, status, send_after, attempts, last_error, sent_at, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  const contactIds = Array.from(
    new Set((sends ?? []).map((s) => s.contact_id).filter(Boolean) as string[])
  );

  let contactsById: Record<string, { profile_name: string | null; phone: string | null }> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, profile_name, phone")
      .in("id", contactIds);
    for (const c of contacts ?? []) {
      contactsById[c.id] = { profile_name: c.profile_name, phone: c.phone };
    }
  }

  const statusLabel: Record<string, string> = {
    queued: "En cola",
    sent: "Enviado",
    skipped: "Omitido",
    failed: "Fallo",
  };

  const templateList = templates ?? [];
  const sendList = sends ?? [];

  return (
    <div className="h-screen overflow-y-auto">
      <header className="px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <h1 className="text-sm font-semibold text-slate-900">Plantillas y flujos</h1>
      </header>

      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <TemplatesManager templates={templateList} />

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Envios recientes</h2>
            <p className="text-xs text-slate-500">Ultimos 50 envios programados o realizados.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Contacto</th>
                  <th className="px-4 py-2 font-medium">Trigger</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Reintentos</th>
                  <th className="px-4 py-2 font-medium">Programado</th>
                  <th className="px-4 py-2 font-medium">Enviado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sendList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Sin envios todavia.</td>
                  </tr>
                ) : (
                  sendList.map((s) => {
                    const contact = s.contact_id ? contactsById[s.contact_id] : null;
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-2 text-slate-700">{contact?.profile_name || contact?.phone || "-"}</td>
                        <td className="px-4 py-2 text-slate-600">{s.trigger}</td>
                        <td className="px-4 py-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{statusLabel[s.status] || s.status}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{s.attempts}</td>
                        <td className="px-4 py-2 text-slate-500">{s.send_after ? new Date(s.send_after).toLocaleString("es-AR") : "-"}</td>
                        <td className="px-4 py-2 text-slate-500">{s.sent_at ? new Date(s.sent_at).toLocaleString("es-AR") : "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
