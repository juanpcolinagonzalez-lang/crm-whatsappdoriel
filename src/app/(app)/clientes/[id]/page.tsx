import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrderStatusLabel } from "@/lib/ecommerce/tiendanube";

export const dynamic = "force-dynamic";

function dateLabel(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
    const supabase = createClient();

  const { data: contact } = await supabase
      .from("contacts")
      .select("id, profile_name, phone, opt_in, created_at")
      .eq("id", params.id)
      .maybeSingle();

  if (!contact) notFound();

  const [{ data: tagRows }, { data: orders }, { data: canonicalConv }] = await Promise.all([
        supabase.from("contact_tags").select("tag:tags(name)").eq("contact_id", contact.id),
        supabase
          .from("orders")
          .select("id, external_id, status_raw, total, currency, created_at")
          .eq("contact_id", contact.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("conversations")
          .select("id")
          .eq("contact_id", contact.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

  const tags = (tagRows ?? []).map((r) => (r as any).tag?.name as string | undefined).filter(Boolean) as string[];
    const name = contact.profile_name || contact.phone;
    const initial = name?.trim().charAt(0).toUpperCase() || "?";

  return (
        <div className="p-6 space-y-6 overflow-y-auto h-screen max-w-3xl">
              <Link href="/clientes" className="text-xs text-teal-700 hover:underline">
                      ← Volver a Clientes
              </Link>
        
              <header className="flex items-center gap-4">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-teal-100 text-teal-700 grid place-items-center text-lg font-semibold">
                        {initial}
                      </div>
                      <div>
                                <h1 className="text-lg font-semibold text-slate-900">{name}</h1>
                                <p className="text-sm text-slate-500">{contact.phone}</p>
                      </div>
              </header>
        
              <div className="grid grid-cols-2 gap-3 max-w-md">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="text-xs text-slate-400">Opt-in</div>
                                <div className="mt-1 text-sm font-medium text-slate-800">{contact.opt_in ? "Sí" : "No"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="text-xs text-slate-400">Cliente desde</div>
                                <div className="mt-1 text-sm font-medium text-slate-800">{dateLabel(contact.created_at)}</div>
                      </div>
              </div>
        
              <div>
                      <h2 className="text-sm font-medium text-slate-700 mb-2">Etiquetas</h2>
                {tags.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin etiquetas.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                                    <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                      {t}
                                    </span>
                                  ))}
                    </div>
                      )}
              </div>
        
          {canonicalConv?.id && (
                  <Link
                              href={`/bandeja?c=${canonicalConv.id}`}
                              className="inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
                            >
                            Ver conversación
                  </Link>
              )}
        
              <div>
                      <h2 className="text-sm font-medium text-slate-700 mb-2">Pedidos</h2>
                {(orders ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400">Todavía no tiene pedidos.</p>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <table className="w-full text-sm">
                                              <thead>
                                                              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                                                                                <th className="px-4 py-3 font-medium">Pedido</th>
                                                                                <th className="px-4 py-3 font-medium">Estado</th>
                                                                                <th className="px-4 py-3 font-medium">Total</th>
                                                                                <th className="px-4 py-3 font-medium">Fecha</th>
                                                              </tr>
                                              </thead>
                                
                                              <tbody>
                                                {(orders ?? []).map((o) => (
                                        <tr key={o.id} className="border-b border-slate-100 last:border-0">
                                                            <td className="px-4 py-3 text-slate-800">#{o.external_id}</td>
                                                            <td className="px-4 py-3 text-slate-600 capitalize">{getOrderStatusLabel(o.status_raw)}</td>
                                                            <td className="px-4 py-3 text-slate-600">{o.total ? `${o.currency ?? ""} ${o.total}` : "—"}</td>
                                                            <td className="px-4 py-3 text-slate-400">{dateLabel(o.created_at)}</td>
                                        </tr>
                                      ))}
                                              </tbody>
                                </table>
                    </div>
                      )}
              </div>
        </div>
      );
}
