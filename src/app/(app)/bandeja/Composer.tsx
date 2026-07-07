"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendReply } from "./actions";

export function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!text.trim()) return;
    setError(null);
    const value = text;
    startTransition(async () => {
      const res = await sendReply(conversationId, value);
      if (res.error) {
        setError(res.error);
      } else {
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Escribí una respuesta… (Enter para enviar)"
          className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
        <button
          onClick={submit}
          disabled={pending || !text.trim()}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
