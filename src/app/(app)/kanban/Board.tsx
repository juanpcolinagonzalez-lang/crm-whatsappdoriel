"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveLead } from "./actions";

type Stage = { id: string; label: string; role: string | null; position: number };
type Card = { leadId: string; stageId: string; name: string; phone: string; isUrgent: boolean };

// Color tenue por rol de columna (el label es editable; el color va por rol).
const ROLE_TINT: Record<string, string> = {
  new: "border-slate-300",
  engaged: "border-sky-300",
  interested: "border-teal-300",
  payment_pending: "border-amber-300",
  sold: "border-emerald-400",
  post_sale: "border-orange-300",
  happy: "border-emerald-300",
  lost: "border-rose-300",
};

export function Board({ stages, cards }: { stages: Stage[]; cards: Card[] }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function drop(stageId: string) {
    const leadId = dragging;
    setDragging(null);
    setOver(null);
    if (!leadId) return;
    const card = cards.find((c) => c.leadId === leadId);
    if (!card || card.stageId === stageId) return;
    startTransition(async () => {
      await moveLead(leadId, stageId);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto p-5 h-[calc(100vh-3.5rem)]">
      {stages.map((stage) => {
        const inStage = cards.filter((c) => c.stageId === stage.id);
        const tint = ROLE_TINT[stage.role ?? ""] ?? "border-slate-300";
        return (
          <div
            key={stage.id}
            onDragOver={(e) => { e.preventDefault(); setOver(stage.id); }}
            onDragLeave={() => setOver((o) => (o === stage.id ? null : o))}
            onDrop={() => drop(stage.id)}
            className={`w-64 shrink-0 rounded-xl border bg-white flex flex-col transition ${
              over === stage.id ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200"
            }`}
          >
            <div className={`px-3 py-2.5 border-b-2 ${tint} flex items-center justify-between`}>
              <span className="text-sm font-medium text-slate-700">{stage.label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500">
                {inStage.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[4rem]">
              {inStage.map((card) => (
                <div
                  key={card.leadId}
                  draggable
                  onDragStart={() => setDragging(card.leadId)}
                  onDragEnd={() => setDragging(null)}
                                className={`cursor-grab rounded-lg border p-2.5 shadow-sm transition active:cursor-grabbing ${
                                                  card.isUrgent ? "border-rose-400 ring-1 ring-rose-300 bg-rose-50" : "border-slate-200 bg-white"
                                } ${
                                                  dragging === card.leadId ? "opacity-40" : "hover:border-slate-300"
                                }`}
                >
                              <div className="text-sm font-medium text-slate-800 truncate">{card.isUrgent ? "🔴 " : ""}{card.name}</div>
                  <div className="text-xs text-slate-400">{card.phone}</div>
                </div>
              ))}
              {inStage.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-300">
                  Sin leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
