import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTransport } from "@/lib/transport";
import { processInbound } from "@/lib/inbound/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET = handshake de verificación de Meta. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === config.whatsapp.verifyToken()) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/**
 * POST = eventos. SIEMPRE responde 200 (aunque falle internamente): si se
 * responde error, Meta reintenta y duplica mensajes. La idempotencia es propia.
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const db = createAdminClient();
    const transport = getTransport("whatsapp");
    const messages = transport.normalizeInbound(payload);

    // Resolver la org por el phone_number_id del payload (multi-tenant).
    const phoneNumberId = extractPhoneNumberId(payload);
    const orgId = await resolveOrg(db, phoneNumberId);

    if (orgId) {
      for (const msg of messages) {
        // Idempotencia: si ya registramos ese wa_message_id, saltear.
        if (msg.waMessageId && (await alreadySeen(db, orgId, msg.waMessageId))) continue;
        await processInbound(db, orgId, msg);
      }
    }
  } catch (err) {
    console.error("[webhook whatsapp] error interno:", err);
  }

  return NextResponse.json({ ok: true });
}

function extractPhoneNumberId(payload: unknown): string | null {
  const body = payload as any;
  return body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
}

async function resolveOrg(db: ReturnType<typeof createAdminClient>, phoneNumberId: string | null): Promise<string | null> {
  if (phoneNumberId) {
    const { data } = await db
      .from("business_config")
      .select("organization_id")
      .eq("wa_phone_number_id", phoneNumberId)
      .maybeSingle();
    if (data) return data.organization_id;
  }
  // Fallback single-tenant: si hay una sola org, usar esa.
  const { data: orgs } = await db.from("organizations").select("id").limit(2);
  return orgs?.length === 1 ? orgs[0].id : null;
}

async function alreadySeen(db: ReturnType<typeof createAdminClient>, orgId: string, waMessageId: string): Promise<boolean> {
  const { data } = await db
    .from("messages")
    .select("id")
    .eq("organization_id", orgId)
    .eq("wa_message_id", waMessageId)
    .limit(1);
  return !!data?.length;
}
