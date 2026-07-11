"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveBusinessConfig } from "./actions";

type Cfg = {
  agent_name: string;
  brand_name: string;
  base_prompt: string;
  business_info: unknown;
  followup_enabled: boolean;
    owner_notify_phone: string | null;
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

export function ConfigForm({ cfg }: { cfg: Cfg }) {
  const [state, action] = useFormState(saveBusinessConfig, null as null | { ok?: boolean; error?: string });

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
                                         <span className="block text-xs font-medium text-slate-600">WhatsApp del dueño (avisos de derivación a humano)</span>
                                         <input
                                                     name="owner_notify_phone" defaultValue={cfg.owner_notify_phone ?? ""}
                                                     placeholder="Ej: 5491112345678"
                                                     className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                                                   />
                                 </label>

      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-slate-600">Prompt base (identidad, tono, estilo)</span>
        <textarea
          name="base_prompt" defaultValue={cfg.base_prompt} rows={5}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-slate-600">
          Información del negocio (JSON: pagos, envíos, precios de referencia, políticas)
        </span>
        <textarea
          name="business_info"
          defaultValue={JSON.stringify(cfg.business_info ?? {}, null, 2)}
          rows={10}
          spellCheck={false}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="followup_enabled" defaultChecked={cfg.followup_enabled} className="accent-teal-700" />
        <span className="text-sm text-slate-700">Seguimiento automático activado</span>
      </label>

      <div className="flex items-center gap-3">
        <Save />
        {state?.ok && <span className="text-sm text-emerald-600">Guardado.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
