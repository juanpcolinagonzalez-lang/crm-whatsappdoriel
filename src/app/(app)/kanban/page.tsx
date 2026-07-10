import { createClient } from "@/lib/supabase/server";
import { Board } from "./Board";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
    const supabase = createClient();

  const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, label, role, position")
      .order("position", { ascending: true });

  const { data: leads } = await supabase
      .from("leads")
      .select("id, stage_id, is_urgent, contact:contacts(profile_name, phone)")
      .order("is_urgent", { ascending: false })
      .order("last_activity_at", { ascending: false });

  const cards = (leads ?? []).map((l) => {
        const contact = (l as any).contact;
        return {
                leadId: l.id,
                stageId: l.stage_id,
                isUrgent: (l as any).is_urgent ?? false,
                name: contact?.profile_name || contact?.phone || "Sin nombre",
                phone: contact?.phone ?? "",
        };
  });

  return (
        <div className="flex flex-col h-screen">
              <header className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
                      <h1 className="text-sm font-semibold text-slate-900">Tablero de leads</h1>
                      <span className="text-xs text-slate-400">Arrastrá las tarjetas entre columnas</span>
              </header>
          {(stages ?? []).length === 0 ? (
                  <div className="flex-1 grid place-items-center text-sm text-slate-400">
                                                    No hay columnas. Corré <code className="mx-1 rounded bg-slate-100 px-1">seed_organization_defaults</code> para tu organización.
                  </div>
                ) : (
                  <Board stages={stages ?? []} cards={cards} />
                )}
        </div>
      );
}
