/**
 * Único punto de acceso a variables de entorno. Falla temprano y claro
 * si falta algo crítico, en vez de romper en runtime a mitad de un webhook.
 */

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}

export const config = {
  supabase: {
    url: opt("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: opt("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    // Solo se lee dentro de webhooks/crons vía admin client.
    serviceRoleKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  },
  whatsapp: {
    token: () => req("WHATSAPP_TOKEN"),
    phoneNumberId: () => req("WHATSAPP_PHONE_NUMBER_ID"),
    verifyToken: () => req("WHATSAPP_VERIFY_TOKEN"),
    graphVersion: opt("WHATSAPP_GRAPH_VERSION", "v21.0"),
  },
  models: {
    primary: opt("AGENT_MODEL_PRIMARY", "claude-sonnet-4-6"),
    fallback: opt("AGENT_MODEL_FALLBACK", "gpt-4o"),
  },
  tiendanube: {
    clientId: () => req("TIENDANUBE_CLIENT_ID"),
    clientSecret: () => req("TIENDANUBE_CLIENT_SECRET"),
    userAgent: opt("TIENDANUBE_USER_AGENT", "CRM WhatsApp"),
  },
  encryptionKey: () => req("ENCRYPTION_KEY"),
  cronSecret: () => req("CRON_SECRET"),
  appUrl: opt("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  timing: {
    humanPauseMs: num("HUMAN_PAUSE_MS", 12 * 60 * 60 * 1000), // 12 h
    echoDedupMs: num("ECHO_DEDUP_MS", 90 * 1000), // 90 s
  },
} as const;
