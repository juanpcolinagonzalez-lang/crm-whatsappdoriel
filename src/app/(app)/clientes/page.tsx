import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function dateLabel(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ClientesPage({ searchParams }: { searchParams: { q?: string } }) {
    const supabase = createClient();
    const q = (searchParams.q ?? "").trim();

  let query = supabase
      .from("contacts")
      .select("id, profile_name, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

  if (q) {
        const safe = q.replace(/[%,]/g, "");
        query = query.or(`profile_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const { data: contacts } = await query;
    const contactIds = (contacts ?? []).map((c) => c.id);

  const tagsByContact = new Map<string, string[]>();
    if (contactIds.length) {
          const { data: contactTags } = await supabase
            .from("contact_tags")
            .select("contact_id, tag:tags(name)")
            .in("contact_id", contactIds);
          for (const row of contactTags ?? []) {
                  const name = (row as any).tag?.name as string | undefined;
                  if (!name) continue;
                  const list = tagsByContact.get(row.contact_id) ?? [];
                  list.push(name);
                  tagsByContact.set(row.contact_id, list);
          }
    }

  const ordersCountByContact = new Map<string, number>();
    if (contactIds.length) {
          const { data: orders } = await supabase.from("orders").select("contact_id").in("contact_id", contactIds);
          for (const o of orders ?? []) {
                  if (!o.contact_id) continue;
                  ordersCountByContact.set(o.contact_id, (ordersCountByContact.get(o.contact_id) ?? 0) + 1);
          }
    }

  const rows = (contacts ?? []).map((c) => {
        const name = c.profile_name || c.phone;
        return {
                id: c.id,
                name,
                initial: name?.trim().charAt(0).toUpperCase() || "?",
                phone: c.phone,
                tags: tagsByContact.get(c.id) ?? [],
                ordersCount: ordersCountByContact.get(c.id) ?? 0,
                createdAt: dateLabel(c.created_at),
        };
  });

  return (
        <div className="p-6 space-y-6 overflow-y-auto h-screen">
              <header>
                      <h1 className="text-lg font-semibold text-slate-900">Clientes</h1>
                      <p className="text-sm text-slate-500">Todos los contactos que escribieron al negocio.</p>
              </header>
        
              <form className="max-w-sm">
                      <input
                                  type="text"
                                  name="q"
                                  defaultValue={q}
                                  placeholder="Buscar por nombre o teléfono..."
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                                />
              </form>
        
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {rows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      {q
                                      ? "No encontramos clientes que coincidan con esa búsqueda."
                                      : "Todavía no hay clientes. Cuando alguien escriba por WhatsApp, aparece acá."}
                    </div>
                  ) : (
          
                    <table className="w-full text-sm">
                                <thead>
                                              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                                                              <th className="px-4 py-3 font-medium">Nombre</th>
                                                              <th className="px-4 py-3 font-medium">Teléfono</th>
                                                              <th className="px-4 py-3 font-medium">Etiquetas</th>
                                                              <th className="px-4 py-3 font-medium">Pedidos</th>
                                                              <th className="px-4 py-3 font-medium">Alta</th>
                                              </tr>
                                </thead>
                    
                                <tbody>
                                  {rows.map((r) => (
                                      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                                                        <td className="px-4 py-3">
                                                        
                                                                            <Link href={`/clientes/${r.id}`} className="flex items-center gap-3">
                                                                                                  <div className="h-8 w-8 shrink-0 rounded-full bg-teal-100 text-teal-700 grid place-items-center text-xs font-semibold">
                                                                                                    {r.initial}
                                                                                                    </div>
                                                                                                  <span className="text-slate-800">{r.name}</span>
                                                                            </Link>
                                                        </td>
                                      
                                                        <td className="px-4 py-3 text-slate-600">{r.phone}</td>
                                                        <td className="px-4 py-3">
                                                                            <div className="flex flex-wrap gap-1">
                                                                              {r.tags.length === 0 ? (
                                          <span className="text-slate-300">—</span>
                                                              ) : (
                                        
                                                                r.tags.map((t) => (
                                                                                            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                                                                              {t}
                                                                                              </span>
                                                                                          ))
                                                              )}
                                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">{r.ordersCount}</td>
                                                        <td className="px-4 py-3 text-slate-400">{r.createdAt}</td>
                                      </tr>
                                    ))}
                                </tbody>
                    
                    </table>
                      )}
              </div>
        </div>
      );
}
