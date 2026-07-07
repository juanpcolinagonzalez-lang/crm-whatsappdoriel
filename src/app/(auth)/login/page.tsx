"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signIn } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
    >
      {pending ? "Ingresando…" : "Ingresar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signIn, null as null | { error: string });

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="hidden lg:flex flex-col justify-between bg-teal-900 p-12 text-teal-50">
        <div className="text-sm font-medium tracking-wide text-teal-300">CRM · WhatsApp</div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight">
            Todas tus ventas por WhatsApp, en una sola bandeja.
          </h1>
          <p className="text-teal-200/80 text-sm leading-relaxed">
            Chats en vivo, tablero de leads y un asistente que atiende solo cuando vos no estás.
          </p>
        </div>
        <div className="text-xs text-teal-400/70">Acceso solo para el equipo.</div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-8">
        <form action={formAction} className="w-full max-w-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">Ingresar</h2>
            <p className="text-sm text-slate-500">Entrá con tu cuenta del equipo.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-slate-600">Mail</label>
              <input
                id="email" name="email" type="email" required autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-slate-600">Contraseña</label>
              <input
                id="password" name="password" type="password" required autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </div>
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <SubmitButton />
        </form>
      </div>
    </main>
  );
}
