"use client";

import { useState } from "react";
import TemplateToggle from "./TemplateToggle";
import TemplateForm from "./TemplateForm";

export type Template = {
  id: string;
  meta_name: string;
  trigger: string;
  language: string;
  category: string;
  body: string;
  active: boolean;
  default_variables?: Record<string, unknown> | null;
};

export default function TemplatesManager({ templates }: { templates: Template[] }) {
  const [editing, setEditing] = useState<Template | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Plantillas de mensajes</h2>
            <p className="text-xs text-slate-500">Mensajes automaticos que Sol puede enviar segun el evento.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
          >
            + Nueva plantilla
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {templates.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Todavia no hay plantillas cargadas.</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{t.meta_name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.trigger}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.language}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.category}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{t.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Editar
                </button>
                <TemplateToggle id={t.id} active={t.active} />
              </div>
            ))
          )}
        </div>
      </section>

      <TemplateForm key={editing?.id ?? "new"} template={editing} onSaved={() => setEditing(null)} />
    </div>
  );
}
