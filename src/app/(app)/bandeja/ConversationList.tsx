"use client";

import Link from "next/link";
import { useState } from "react";

export type ConversationListItem = {
  id: string;
  name: string;
  phone: string;
  preview: string;
  time: string;
  isPaused: boolean;
  isUrgent: boolean;
};

/**
 * Lista de conversaciones de la Bandeja con buscador rápido por nombre o
 * teléfono. El filtro es 100% client-side (sin ida y vuelta al servidor) para
 * que sea instantáneo mientras el asesor escribe.
 */
export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: ConversationListItem[];
  activeId: string | null;
}) {
  const [q, setQ] = useState("");

  const term = q.trim().toLowerCase();
  const filtered = term
    ? conversations.filter((c) => (c.name + " " + c.phone).toLowerCase().includes(term))
    : conversations;

  return (
    <>
      <div className="px-3 py-2 border-b border-slate-100">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {conversations.length === 0 && (
          <li className="p-6 text-sm text-slate-400">
            Todavía no hay conversaciones. Cuando un cliente escriba, aparece acá.
          </li>
        )}
        {conversations.length > 0 && filtered.length === 0 && (
          <li className="p-6 text-sm text-slate-400">Sin resultados para esa búsqueda.</li>
        )}
        {filtered.map((c) => {
          const isActive = c.id === activeId;
          return (
            <li key={c.id}>
              <Link
                href={`/bandeja?c=${c.id}`}
                className={`block px-4 py-3 transition ${isActive ? "bg-teal-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {c.isUrgent ? "🔴 " : ""}
                    {c.name}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{c.time}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-slate-500 truncate">{c.preview || "\u2014"}</span>
                  {c.isPaused && (
                    <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Humano
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
