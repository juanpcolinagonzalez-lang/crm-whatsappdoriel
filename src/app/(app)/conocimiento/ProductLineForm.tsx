"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveProductLine, type LineFormState } from "./actions";
import type { ProductLine } from "./KnowledgeManager";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
    >
      {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear linea"}
    </button>
  );
}

export default function ProductLineForm({
  line,
  onSaved,
}: {
  line: ProductLine | null;
  onSaved?: () => void;
}) {
  const initialState: LineFormState = {};
  const [state, action] = useFormState(saveProductLine, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(line);

  useEffect(() => {
    if (state.ok) {
      onSaved?.();
      if (!isEdit) formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">
          {isEdit ? `Editar linea: ${line?.name}` : "Nueva linea de producto"}
        </h2>
      </div>

      <form ref={formRef} action={action} className="p-4 space-y-4">
        {isEdit && <input type="hidden" name="id" value={line!.id} />}

        <label className="space-y-1.5 block">
          <span className="block text-xs font-medium text-slate-600">Nombre</span>
          <input
            name="name"
            defaultValue={line?.name ?? ""}
            required
            placeholder="ej: Lamparas"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="block text-xs font-medium text-slate-600">Descripcion</span>
          <textarea
            name="description"
            defaultValue={line?.description ?? ""}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          />
        </label>

        <div className="flex items-center gap-3">
          <SubmitButton isEdit={isEdit} />
          {state.ok && <span className="text-sm text-emerald-600">Guardado.</span>}
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </section>
  );
}
