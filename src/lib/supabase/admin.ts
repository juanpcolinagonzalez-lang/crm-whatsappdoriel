import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Admin client (service_role). BYPASSA RLS.
 * SOLO en webhooks y crons. NUNCA importar en código que corra en el cliente.
 * Toda consulta debe filtrar por organization_id a mano (no hay RLS que proteja).
 */
export function createAdminClient() {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
