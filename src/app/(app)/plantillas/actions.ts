"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FLOW_TRIGGERS, TEMPLATE_CATEGORIES, type FlowTrigger, type TemplateCategory } from "@/types/domain";

async function orgId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export async function toggleTemplateActive(
  id: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { ok: false, error: "No autorizado" };

  const { error } = await supabase
    .from("message_templates")
    .update({ active })
    .eq("id", id)
    .eq("organization_id", org);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/plantillas");
  return { ok: true };
}

export type TemplateFormState = { ok?: boolean; error?: string };

export async function saveTemplate(
  _prev: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  const supabase = createClient();
  const org = await orgId(supabase);
  if (!org) return { error: "Sin sesion. Volve a iniciar sesion." };

  const id = String(formData.get("id") ?? "").trim();
  const trigger = String(formData.get("trigger") ?? "").trim();
  const meta_name = String(formData.get("meta_name") ?? "").trim();
  const language = String(formData.get("language") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const active = formData.get("active") === "on";
  const defaultVariablesRaw = String(formData.get("default_variables") ?? "").trim();

  if (!trigger || !(FLOW_TRIGGERS as string[]).includes(trigger)) {
    return { error: "Elegi un gatillo valido de la lista." };
  }
  if (!meta_name) {
    return { error: "El nombre en Meta (meta_name) es obligatorio." };
  }
  if (!language) {
    return { error: "El idioma es obligatorio y debe coincidir exacto con el aprobado en Meta." };
  }
  if (!category || !(TEMPLATE_CATEGORIES as string[]).includes(category)) {
    return { error: "Elegi una categoria valida (utility o marketing)." };
  }
  if (!body) {
    return { error: "El cuerpo del mensaje (body) es obligatorio." };
  }

  let defaultVariables: Record<string, unknown> = {};
  if (defaultVariablesRaw) {
    try {
      const parsed = JSON.parse(defaultVariablesRaw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { error: 'default_variables debe ser un objeto JSON valido, ej: {"1": "valor"}.' };
      }
      defaultVariables = parsed as Record<string, unknown>;
    } catch {
      return { error: "default_variables no es un JSON valido. Revisa la sintaxis (comillas dobles, sin comas finales)." };
    }
  }

  const payload = {
    organization_id: org,
    trigger: trigger as FlowTrigger,
    meta_name,
    language,
    category: category as TemplateCategory,
    body,
    active,
    default_variables: defaultVariables,
  };

  const { error } = id
    ? await supabase.from("message_templates").update(payload).eq("id", id).eq("organization_id", org)
    : await supabase.from("message_templates").insert(payload);

  if (error) {
    if (error.code === "23505") {
      return {
        error: "Ya existe una plantilla para ese gatillo en esta organizacion. Edita la existente en vez de crear otra.",
      };
    }
    return { error: "No se pudo guardar la plantilla." };
  }

  revalidatePath("/plantillas");
  return { ok: true };
}
