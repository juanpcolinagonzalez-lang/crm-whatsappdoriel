"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleNote } from "./actions";

export function NoteToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => start(async () => { await toggleNote(id, !active); router.refresh(); })}
      disabled={pending}
      className={`rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
        active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {active ? "Activa" : "Apagada"}
    </button>
  );
}
