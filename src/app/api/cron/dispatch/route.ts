import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { dispatchQueue } from "@/lib/queue/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cada 5 min: despacha la cola de envíos aplicando los gates. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse("unauthorized", { status: 401 });
  const db = createAdminClient();
  const result = await dispatchQueue(db);
  return NextResponse.json({ ok: true, ...result });
}
