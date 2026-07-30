"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveBusinessConfig } from "./actions";

type Cfg = {
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
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
    );
}

export function ConfigForm({ cfg }: { cfg: Cfg }) {
  const [state, action] = useFormState(saveBusinessConfig, null as null | { ok?: boolean; error?: string });
  
  return (
    <form action={action} className="space-y-5">
    <label className="block space-y-1.5">
    <span className="block text-xs font-medium text-slate-600">WhatsApp del dueno (avisos de derivacion a humano)</span>
    <input
      name="owner_notify_phone" defaultValue={cfg.owner_notify_phone ?? ""}
      placeholder="Ej: 5491112345678"
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
    </label>
    
    <label className="block space-y-1.5">
    <span className="block text-xs font-medium text-slate-600">
    Informacion del negocio (JSON: pagos, envios, precios de referencia, politicas)
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
    <span className="text-sm text-slate-700">Seguimiento automatico activado</span>
    </label>
    
    <div className="flex items-center gap-3">
    <Save />
      {state?.ok && <span className="text-sm text-emerald-600">Guardado.</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
    </form>
    );
}
