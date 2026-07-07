import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForToken } from "@/lib/ecommerce/tiendanube";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Callback de OAuth: intercambia el code por el token y lo guarda CIFRADO,
 * asociado a la organización del usuario logueado.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return new NextResponse("falta code", { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", user.id).single();
  if (!profile) return new NextResponse("sin organización", { status: 403 });

  const { storeId, accessToken } = await exchangeCodeForToken(code);

  await supabase.from("ecommerce_connections").upsert({
    organization_id: profile.organization_id,
    platform: "tiendanube",
    store_id: storeId,
    access_token_enc: encrypt(accessToken),
  });

  return NextResponse.redirect(new URL("/ajustes?tiendanube=conectado", req.url));
}
