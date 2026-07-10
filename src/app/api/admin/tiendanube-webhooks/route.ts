import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
* Registra en Tiendanube los webhooks de pedidos que necesita el CRM (pago,
* envio, cancelacion) para que los avisos automaticos por WhatsApp funcionen.
* Se corre a mano, una vez, entrando a esta URL logueado como admin del CRM.
*/
const EVENTS = ["order/created", "order/paid", "order/fulfilled", "order/packed", "order/cancelled"];

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("no autenticado; entra al CRM primero", { status: 401 });

const { data: profile } = await supabase
  .from("profiles").select("organization_id").eq("id", user.id).single();
  if (!profile) return new NextResponse("sin organizacion", { status: 403 });

const db = createAdminClient();
  const { data: conn } = await db
  .from("ecommerce_connections")
  .select("store_id, access_token_enc")
  .eq("organization_id", profile.organization_id)
  .eq("platform", "tiendanube")
  .maybeSingle();
  if (!conn) return NextResponse.json({ ok: false, motivo: "sin conexion de tiendanube para esta organizacion" });

const token = decrypt(conn.access_token_enc);
  const base = `https://api.tiendanube.com/v1/${conn.store_id}`;
  const headers = {
    Authentication: `bearer ${token}`,
    "User-Agent": config.tiendanube.userAgent,
    "Content-Type": "application/json",
  };
  const callbackUrl = `${config.appUrl}/api/webhooks/tiendanube`;

const existingRes = await fetch(`${base}/webhooks`, { headers });
  const existing = existingRes.ok ? await existingRes.json() : [];

const results: any[] = [];
  for (const event of EVENTS) {
    const yaExiste = Array.isArray(existing) && existing.some((w: any) => w.event === event && w.url === callbackUrl);
    if (yaExiste) {
      results.push({ event, ok: true, ya_existia: true });
      continue;
    }
    const res = await fetch(`${base}/webhooks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ event, url: callbackUrl }),
    });
    const data = await res.json().catch(() => ({}));
    results.push({ event, ok: res.ok, data });
  }

return NextResponse.json({ ok: true, store_id: conn.store_id, callbackUrl, results });
}
