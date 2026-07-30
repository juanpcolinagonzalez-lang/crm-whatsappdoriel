"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
    const [dark, setDark] = useState(false);

  useEffect(() => {
        const stored = localStorage.getItem("doriel-theme");
        setDark(stored === "dark");
  }, []);

  function toggle() {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("doriel-theme", next ? "dark" : "light");
  }

  return (
        <button
                type="button"
                onClick={toggle}
                className="w-full rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between"
              >
              <span>Tema</span>
              <span className="text-xs font-medium">{dark ? "Oscuro" : "Claro"}</span>
        </button>
      );
}
