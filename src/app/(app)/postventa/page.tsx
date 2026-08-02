import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TabKey = "abiertos" | "en_proceso" | "resueltos" | "seguimientos" | "todos";

const TABS: { key: TabKey; label: string }[] = [
  { key: "abiertos", label: "Abiertos" },
  { key: "en_proceso", label: "En proceso" },
  { key: "resueltos", label: "Resueltos" },
  { key: "seguimientos", label: "Seguimientos" },
  { key: "todos", label: "Todos" },
];

const TIPO_LABEL: Record<string, string> = {
  reclamo: "Reclamo",
  garantia: "Garantia",
  cambio: "Cambio",
  seguimiento: "Seguimiento",
};

const ESTADO_BADGE: Record<string, string> = {
  abierto: "bg-amber-100 text-amber-700",
  en_proceso: "bg-blue-100 text-blue-700",
  resuelto: "bg-green-100 text-green-700",
  cerrado: "bg-slate-100 text-slate-600",
  sin_respuesta: "bg-rose-100 text-rose-700",
};

const ESTADO_LABEL: Record<string, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  sin_respuesta: "Sin respuesta",
};

function dateLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function PostventaPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const tab = (searchParams.tab as TabKey) ?? "abiertos";

  const { data: casos } = await supabase
    .from("postventa_casos")
    .select(
      "id, tipo, estado, titulo, descripcion, fecha_programada, resenia_solicitada, resenia_obtenida, created_at, contact_id, order_id, conversation_id"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const contactIds = [...new Set((casos ?? []).map((c) => c.contact_id).filter(Boolean))] as string[];
  const orderIds = [...new Set((casos ?? []).map((c) => c.order_id).filter(Boolean))] as string[];

  const contactsById = new Map<string, { name: string }>();
  if (contactIds.length) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, profile_name, phone")
      .in("id", contactIds);
    for (const c of contacts ?? []) {
      contactsById.set(c.id, { name: c.profile_name || c.phone });
    }
  }

  const ordersById = new Map<string, { externalId: string }>();
  if (orderIds.length) {
    const { data: orders } = await supabase.from("orders").select("id, external_id").in("id", orderIds);
    for (const o of orders ?? []) {
      ordersById.set(o.id, { externalId: o.external_id });
    }
  }

  const items = (casos ?? []).map((c) => {
    const contact = c.contact_id ? contactsById.get(c.contact_id) : null;
    const order = c.order_id ? ordersById.get(c.order_id) : null;
    return {
      id: c.id,
      tipo: c.tipo,
      tipoLabel: TIPO_LABEL[c.tipo] ?? c.tipo,
      estado: c.estado,
      estadoLabel: ESTADO_LABEL[c.estado] ?? c.estado,
      estadoBadge: ESTADO_BADGE[c.estado] ?? "bg-slate-100 text-slate-600",
      titulo: c.titulo || (c.tipo === "seguimiento" ? "Seguimiento post-compra" : "Caso de post-venta"),
      descripcion: c.descripcion || "",
      clienteNombre: contact?.name ?? "—",
      pedido: order ? `#${order.externalId}` : null,
      fechaProgramada: dateLabel(c.fecha_programada),
      reseniaSolicitada: c.resenia_solicitada,
      reseniaObtenida: c.resenia_obtenida,
      fecha: dateLabel(c.created_at),
      conversationId: c.conversation_id,
    };
  });

  const counts: Record<TabKey, number> = {
    abiertos: items.filter((i) => i.estado === "abierto").length,
    en_proceso: items.filter((i) => i.estado === "en_proceso").length,
    resueltos: items.filter((i) => i.estado === "resuelto" || i.estado === "cerrado").length,
    seguimientos: items.filter((i) => i.tipo === "seguimiento").length,
    todos: items.length,
  };

  const filtered = items.filter((i) => {
    if (tab === "abiertos") return i.estado === "abierto";
    if (tab === "en_proceso") return i.estado === "en_proceso";
    if (tab === "resueltos") return i.estado === "resuelto" || i.estado === "cerrado";
    if (tab === "seguimientos") return i.tipo === "seguimiento";
    return true;
  });

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-screen">
      <header>
        <h1 className="text-lg font-semibold text-slate-900">Post-venta</h1>
        <p className="text-sm text-slate-500">
          Reclamos, cambios, garantias y seguimientos post-compra con pedido de resena.
        </p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/postventa?tab=${t.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key
                ? "bg-teal-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-80">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No hay casos de post-venta en esta vista todavia.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id} className="px-4 py-3 hover:bg-slate-50 transition">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{c.clienteNombre}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {c.tipoLabel}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.estadoBadge}`}>
                        {c.estadoLabel}
                      </span>
                      {c.pedido && (
                        <span className="text-[11px] text-slate-400">Pedido {c.pedido}</span>
                      )}
                      {c.tipo === "seguimiento" && c.reseniaObtenida && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Resena obtenida
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 mt-0.5">{c.titulo}</div>
                    {c.descripcion && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">{c.descripcion}</div>
                    )}
                    {c.tipo === "seguimiento" && c.fechaProgramada && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Envio programado: {c.fechaProgramada}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-slate-400">{c.fecha}</span>
                    {c.conversationId && (
                      <Link href={`/bandeja?c=${c.conversationId}`} className="text-xs text-teal-700 hover:underline">
                        Ver conversacion
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
