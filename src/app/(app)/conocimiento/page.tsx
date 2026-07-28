import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KnowledgeManager from "./KnowledgeManager";

export const dynamic = "force-dynamic";

export default async function ConocimientoPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = profile?.organization_id ?? null;

  const { data: lines } = await supabase
    .from("product_lines")
    .select("id, name, description, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("id, product_line_id, name, description, colors, link, price, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  return (
    <div className="h-screen overflow-y-auto">
      <header className="px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <h1 className="text-sm font-semibold text-slate-900">Conocimiento</h1>
        <p className="text-xs text-slate-500">
          Base de productos que consulta el agente antes de responder. Si no esta aca, no lo inventa.
        </p>
      </header>

      <div className="mx-auto max-w-6xl p-6">
        <KnowledgeManager lines={lines ?? []} products={products ?? []} />
      </div>
    </div>
  );
}
