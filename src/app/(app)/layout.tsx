import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/login/actions";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/inicio", label: "Inicio", hint: "Resumen general" },
  { href: "/bandeja", label: "Bandeja", hint: "Chats en vivo" },
  { href: "/kanban", label: "Tablero", hint: "Leads" },
  { href: "/clientes", label: "Clientes", hint: "Contactos" },
  { href: "/pedidos", label: "Pedidos", hint: "Pedidos de la tienda" },
  { href: "/ajustes", label: "Ajustes", hint: "Agente y negocio" },
  { href: "/personalizacion", label: "Personalizacion", hint: "Identidad del asistente" },
  { href: "/metricas", label: "Metricas", hint: "Rendimiento del agente" },
  { href: "/plantillas", label: "Plantillas", hint: "Mensajes automaticos" },
  { href: "/conocimiento", label: "Conocimiento", hint: "Base de productos" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">CRM - WhatsApp</div>
          <div className="text-xs text-slate-400 mt-0.5">Sala de ventas</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{n.label}</div>
              <div className="text-xs text-slate-400">{n.hint}</div>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <ThemeToggle />
        </div>
        <form action={signOut} className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="px-3 pb-2 text-xs text-slate-400 truncate">{user.email}</div>
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Cerrar sesion
          </button>
        </form>
      </aside>
      <main className="flex-1 min-w-0 dark:bg-slate-950">{children}</main>
    </div>
  );
}
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/login/actions";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/inicio", label: "Inicio", hint: "Resumen general" },
  { href: "/bandeja", label: "Bandeja", hint: "Chats en vivo" },
  { href: "/kanban", label: "Tablero", hint: "Leads" },
  { href: "/clientes", label: "Clientes", hint: "Contactos" },
  { href: "/pedidos", label: "Pedidos", hint: "Pedidos de la tienda" },
  { href: "/ajustes", label: "Ajustes", hint: "Agente y negocio" },
  { href: "/personalizacion", label: "Personalizacion", hint: "Identidad del asistente" },
  { href: "/metricas", label: "Metricas", hint: "Rendimiento del agente" },
  { href: "/plantillas", label: "Plantillas", hint: "Mensajes automaticos" },
  ];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

  return (
        <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
              <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">CRM - WhatsApp</div>
                                <div className="text-xs text-slate-400 mt-0.5">Sala de ventas</div>
                      </div>
                      <nav className="flex-1 p-3 space-y-1">
                        {NAV.map((n) => (
                      <Link
                                      key={n.href}
                                      href={n.href}
                                      className="block rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    >
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{n.label}</div>
                                    <div className="text-xs text-slate-400">{n.hint}</div>
                      </Link>
                    ))}
                      </nav>
                      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                                <ThemeToggle />
                      </div>
                      <form action={signOut} className="p-3 border-t border-slate-200 dark:border-slate-800">
                                <div className="px-3 pb-2 text-xs text-slate-400 truncate">{user.email}</div>
                                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                                            Cerrar sesion
                                </button>
                      </form>
              </aside>
              <main className="flex-1 min-w-0 dark:bg-slate-950">{children}</main>
        </div>
      );
}
