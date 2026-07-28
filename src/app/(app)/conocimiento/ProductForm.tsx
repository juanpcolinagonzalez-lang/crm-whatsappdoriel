"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveProduct, type ProductFormState } from "./actions";
import type { Product, ProductLine } from "./KnowledgeManager";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
    >
      {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
    </button>
  );
}

export default function ProductForm({
  product,
  lines,
  onSaved,
}: {
  product: Product | null;
  lines: ProductLine[];
  onSaved?: () => void;
}) {
  const initialState: ProductFormState = {};
  const [state, action] = useFormState(saveProduct, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(product);

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
          {isEdit ? `Editar producto: ${product?.name}` : "Nuevo producto"}
        </h2>
        <p className="text-xs text-slate-500">
          Esto es lo que el agente ofrece como verdad: si no esta aca, no lo inventa.
        </p>
      </div>

      <form ref={formRef} action={action} className="p-4 space-y-4">
        {isEdit && <input type="hidden" name="id" value={product!.id} />}

        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Linea de producto</span>
            <select
              name="product_line_id"
              defaultValue={product?.product_line_id ?? ""}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            >
              <option value="" disabled>
                Elegi una linea…
              </option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Nombre</span>
            <input
              name="name"
              defaultValue={product?.name ?? ""}
              required
              placeholder="ej: Lampara Nordica 40cm"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="block text-xs font-medium text-slate-600">Descripcion</span>
          <textarea
            name="description"
            defaultValue={product?.description ?? ""}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Colores</span>
            <input
              name="colors"
              defaultValue={product?.colors ?? ""}
              placeholder="ej: blanco, negro, madera"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="block text-xs font-medium text-slate-600">Precio</span>
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.price ?? ""}
              placeholder="ej: 15000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="block text-xs font-medium text-slate-600">Link</span>
          <input
            name="link"
            defaultValue={product?.link ?? ""}
            placeholder="https://..."
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
