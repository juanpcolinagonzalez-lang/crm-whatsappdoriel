"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveTemplate, type TemplateFormState } from "./actions";
import type { Template } from "./TemplatesManager";
import { FLOW_TRIGGERS, TEMPLATE_CATEGORIES } from "@/types/domain";

const TRIGGER_LABELS: Record<string, string> = {
  order_confirmed: "Pedido confirmado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  payment_pending: "Pago pendiente",
  ready_for_pickup: "Listo para retirar",
  abandoned_cart: "Carrito abandonado",
  followup: "Seguimiento",
  confirm_address: "Confirmar direccion",
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
    >
      {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear plantilla"}
    </button>
  );
}

export default function TemplateForm({
  template,
  onSaved,
}: {
  template: Template | null;
  onSaved?: () => void;
}) {
  const initialState: TemplateFormState = {};
  const [state, action] = useFormState(saveTemplate, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(template);

  useEffect(() => {
    if (state.ok) {
      onSaved?.();
      if (!isEdit) formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const defaultVarsText =
    template?.default_variables && Object.keys(template.default_variables).length > 0
      ? JSON.stringify(template.default_variables, null, 2)
      : "";

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">
          {isEdit ? `Editar plantilla: ${template?.meta_name}` : "Nueva plantilla"}
        </h2>
        <p className="text-xs text-slate-500">
          Los datos tienen que coincidir exactamente con la plantilla aprobada en Meta.
        </p>
      </div>

      <form ref={formRef} action={action} className="p-4 space-y-4">
        {isEdit && <input type="hidden" name="id" value={template!.id} />}

        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Gatillo (trigger)</span>
            <select
              name="trigger"
              defaultValue={template?.trigger ?? ""}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            >
              <option value="" disabled>
                Elegi un gatillo…
              </option>
              {FLOW_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABELS[t] ?? t} ({t})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Nombre en Meta (meta_name)</span>
            <input
              name="meta_name"
              defaultValue={template?.meta_name ?? ""}
              required
              placeholder="ej: pedido_confirmado_v1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Idioma</span>
            <input
              name="language"
              defaultValue={template?.language ?? ""}
              required
              placeholder="es_AR"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
            <span className="block text-[11px] text-amber-600">
              Debe coincidir exacto con el idioma aprobado en Meta: "es" y "es_AR" son valores distintos.
            </span>
          </label>

          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Categoria</span>
            <select
              name="category"
              defaultValue={template?.category ?? ""}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            >
              <option value="" disabled>
                Elegi una categoria…
              </option>
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "utility" ? "Utility" : "Marketing"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="block text-xs font-medium text-slate-600">Cuerpo del mensaje (body)</span>
          <textarea
            name="body"
            defaultValue={template?.body ?? ""}
            required
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          />
          <span className="block text-[11px] text-slate-500">
            {"Las variables van como {{1}}, {{2}}, etc, en el mismo orden que en la plantilla aprobada en Meta."}
          </span>
        </label>

        <label className="space-y-1.5 block">
          <span className="block text-xs font-medium text-slate-600">
            Variables por defecto (default_variables) — JSON opcional
          </span>
          <textarea
            name="default_variables"
            defaultValue={defaultVarsText}
            rows={3}
            placeholder='{"1": "cupon10"}'
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          />
          <span className="block text-[11px] text-slate-500">
            Opcional. Si lo completas, tiene que ser un JSON valido (ej: valores fijos como un cupon).
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={template?.active ?? true}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600/20"
          />
          <span className="text-xs font-medium text-slate-600">Activa</span>
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
