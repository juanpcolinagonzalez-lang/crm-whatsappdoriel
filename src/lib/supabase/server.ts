import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cliente SSR para Server Components y Server Actions.
 * Respeta RLS: solo ve datos de la organización del usuario logueado.
 */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: CookieToSet[]) => {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Llamado desde un Server Component: el middleware refresca la sesión.
        }
      },
    },
  });
}
