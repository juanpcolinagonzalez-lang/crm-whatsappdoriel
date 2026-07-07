import { NextResponse } from "next/server";
import { oauthStartUrl } from "@/lib/ecommerce/tiendanube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manda al dueño a instalar/autorizar la app en Tiendanube. */
export async function GET() {
  return NextResponse.redirect(oauthStartUrl());
}
