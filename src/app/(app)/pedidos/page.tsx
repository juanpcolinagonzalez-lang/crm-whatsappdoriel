import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrderStatusLabel } from "@/lib/ecommerce/tiendanube";

export const dynamic = "force-dynamic";

function dateLabel(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function paymentMethodLabel(pm: string | null): string {
    if (!pm) return "—";
    const p = pm.toLowerCase();
    if (p.includes("transfer")) return "Transferencia";
    if (p.includes("offline") || p.includes("cash") || p.includes("efectivo")) return "Efectivo/Offline";
    return "Tarjeta/Pasarela";
}

function estadoBadgeClass(label: string): string {
    if (label.includes("pago pendiente")) return "bg-amber-100 text-amber-700";
    if (label === "enviado" || label === "entregado") return "bg-green-100 text-green-700";
    if (label === "cancelado") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-600";
}

function formatTotal(total: number | null, currency: string | null): string {
    if (total == null) return "—";
    const monto = Number(total).toLocaleString("es-AR");
    return currency && currency !== "ARS" ? `${currency} $ ${monto}` : `$ ${monto}`;
}

export default async function PedidosPage({ searchParams }: { searchParams: { estado?: string } }) {
    const supabase = createClient();
    const estadoFiltro = searchParams.estado ?? "";

  const { data: connection } = await supabase.from("ecommerce_connections").select("platform").maybeSingle();

  const { data: orders } = await supabase
      .from("orders")
      .select("id, external_id, status_raw, payment_method, total, currency, updated_at, created_at, contact_id")
      .order("updated_at", { ascending: false })
      .limit(100);

  const contactIds = [...new Set((orders ?? []).map((o) => o.contact_id).filter(Boolean))] as string[];

  const contactsById = new Map<string, { name: string }>();
    if (contactIds.length) {
          const { data: contacts } = await supabase.from("contacts").select("id, profile_name, phone").in("id", contactIds);
          for (const c of contacts ?? []) {
                  contactsById.set(c.id, { name: c.profile_name || c.phone });
          }
    }

  const conversationByContact = new Map<string, string>();
    if (contactIds.length) {
          const { data: convs } = await supabase
            .from("conversations")
            .select("id, contact_id, created_at")
            .in("contact_id", contactIds)
            .order("created_at", { ascending: true });
          for (const c of convs ?? []) {
                  if (!conversationByContact.has(c.contact_id)) conversationByContact.set(c.contact_id, c.id);
          }
    }

  const allRows = (orders ?? []).map((o) => {
        const estadoLabel = getOrderStatusLabel(o.status_raw);
        const contact = o.contact_id ? contactsById.get(o.contact_id) : null;
        return {
                id: o.id,
                externalId: o.external_id,
                clienteNombre: contact?.name ?? "—",
                estadoLabel,
                badgeClass: estadoBadgeClass(estadoLabel),
                metodoPago: paymentMethodLabel(o.payment_method),
                total: formatTotal(o.total, o.currency),
                fecha: dateLabel(o.updated_at ?? o.created_at),
                conversationId: o.contact_id ? conversationByContact.get(o.contact_id) : undefined,
        };
  });

  const estadosDisponibles = [...new Set(allRows.map((r) => r.estadoLabel))];
    const rows = estadoFiltro ? allRows.filter((r) => r.estadoLabel === estadoFiltro) : allRows;

  const hayConexion = !!connection;

  return (
        <div className="p-6 space-y-6 overflow-y-auto h-screen">
              <header>
                      <h1 className="text-lg font-semibold text-slate-900">Pedidos</h1>
                      <p className="text-sm text-slate-500">Pedidos sincronizados desde la tienda.</p>
              </header>
        
          {estadosDisponibles.length > 0 && (
                  <form className="flex items-center gap-2 max-w-md">
                            <select
                                          name="estado"
                                          defaultValue={estadoFiltro}
                                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                                        >
                                        <option value="">Todos los estados</option>
                              {estadosDisponibles.map((estado) => (
                                                        <option key={estado} value={estado}>
                                                          {estado}
                                                        </option>
                                                      ))}
                            </select>
                            <button
                                          type="submit"
                                          className="shrink-0 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
                                        >
                                        Filtrar
                            </button>
                  </form>
              )}
        
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {!hayConexion ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                                Conectá Tiendanube en Ajustes para sincronizar pedidos.
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      {estadoFiltro
                                      ? "No hay pedidos con ese estado."
                                      : "Todavía no hay pedidos sincronizados. Cuando conectes la tienda y entren pedidos, aparecen acá."}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                                <thead>
                                              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                                                              <th className="px-4 py-3 font-medium">Pedido</th>
                                                              <th className="px-4 py-3 font-medium">Cliente</th>
                                                              <th className="px-4 py-3 font-medium">Estado</th>
                                                              <th className="px-4 py-3 font-medium">Pago</th>
                                                              <th className="px-4 py-3 font-medium">Total</th>
                                                              <th className="px-4 py-3 font-medium">Fecha</th>
                                                              <th className="px-4 py-3 font-medium"></th>
                                              </tr>
                                </thead>
                    
                                <tbody>
                                  {rows.map((r) => (
                                      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                                                        <td className="px-4 py-3 text-slate-800">#{r.externalId}</td>
                                                        <td className="px-4 py-3 text-slate-600">{r.clienteNombre}</td>
                                                        <td className="px-4 py-3">
                                                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${r.badgeClass}`}>
                                                                              {r.estadoLabel}
                                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">{r.metodoPago}</td>
                                                        <td className="px-4 py-3 text-slate-600">{r.total}</td>
                                                        <td className="px-4 py-3 text-slate-400">{r.fecha}</td>
                                                        <td className="px-4 py-3 text-right">
                                                          {r.conversationId && (
                                                              <Link href={`/bandeja?c=${r.conversationId}`} className="text-xs text-teal-700 hover:underline">
                                                                                      Ver conversación
                                                              </Link>
                                                                            )}
                                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                    </table>
                      )}
              </div>
        </div>
      );
}
