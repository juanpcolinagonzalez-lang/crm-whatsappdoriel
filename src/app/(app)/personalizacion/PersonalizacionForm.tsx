"use client";

import { useFormState, useFormStatus } from "react-dom";
import { savePersonalizacion } from "./actions";

type Cfg = {
  agent_name: string;
  brand_name: string;
  base_prompt: string;
};

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
    );
}

export function PersonalizacionForm({ cfg }: { cfg: Cfg }) {
  const [state, action] = useFormState(savePersonalizacion, null as null | { ok?: boolean; error?: string });
  
  return (
    <form action={action} className="space-y-5">
    <div className="grid grid-cols-2 gap-4">
    <label className="space-y-1.5">
    <span className="block text-xs font-medium text-slate-600">Nombre del asistente</span>
    <input
      name="agent_name" defaultValue={cfg.agent_name}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
    </label>
    <label className="space-y-1.5">
    <span className="block text-xs font-medium text-slate-600">Marca</span>
    <input
      name="brand_name" defaultValue={cfg.brand_name}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
    </label>
    </div>
    
    <label className="block space-y-1.5">
    <span className="block text-xs font-medium text-slate-600">Tono y personalidad (system prompt)</span>
    <textarea
      name="base_prompt" defaultValue={cfg.base_prompt} rows={8}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
    </label>
    
    <div className="flex items-center gap-3">
    <Save />
      {state?.ok && <span className="text-sm text-emerald-600">Guardado.</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
    </form>
    );
}
