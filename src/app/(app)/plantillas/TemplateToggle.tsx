"use client";

import { useState, useTransition } from "react";
import { toggleTemplateActive } from "./actions";

export default function TemplateToggle({ id, active }: { id: string; active: boolean }) {
  const [checked, setChecked] = useState(active);
  const [isPending, startTransition] = useTransition();

  function handleChange() {
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      const result = await toggleTemplateActive(id, next);
      if (!result.ok) {
        setChecked(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleChange}
      disabled={isPending}
      className={
        checked
          ? "shrink-0 text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white"
          : "shrink-0 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600"
      }
    >
      {checked ? "Activa" : "Inactiva"}
    </button>
  );
}
