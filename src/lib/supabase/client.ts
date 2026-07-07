import { createBrowserClient } from "@supabase/ssr";
import { config } from "@/lib/config";

/** Cliente para Client Components (bandeja en vivo por Realtime). */
export function createClient() {
  return createBrowserClient(config.supabase.url, config.supabase.anonKey);
}
