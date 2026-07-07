"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Se suscribe a los cambios en `messages` y refresca la bandeja cuando entra
 * un mensaje nuevo (del cliente, del bot o de otro asesor).
 */
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("bandeja")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
