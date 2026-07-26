import { createClient } from "@/lib/supabase/server";
import { PersonalizacionForm } from "./PersonalizacionForm";

export const dynamic = "force-dynamic";

export default async function PersonalizacionPage() {
  const supabase = createClient();

const { data: cfg } = await supabase
  .from("business_config")
  .select("agent_name, brand_name, base_prompt")
  .maybeSingle();

return (
  <div className="h-screen overflow-y-auto">
  <header className="px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
  <h1 className="text-sm font-semibold text-slate-900">Personalizacion</h1>
  </header>
  
  <div className="mx-auto max-w-3xl p-6 space-y-6">
  <section className="rounded-xl border border-slate-200 bg-white p-6">
  <h2 className="text-base font-semibold text-slate-900 mb-1">Identidad del asistente</h2>
  <p className="text-sm text-slate-500 mb-5">
  El nombre, la marca y el tono con el que responde el asistente por WhatsApp. La info
  operativa del negocio (pagos, envios, politicas) se edita en Ajustes.
  </p>
    {cfg ? (
    <PersonalizacionForm cfg={cfg as any} />
    ) : (
    <p className="text-sm text-slate-400">
    No hay configuracion para esta organizacion todavia.
    </p>
  )}
  </section>
  </div>
  </div>
  );
}
