import { config } from "@/lib/config";

/**
 * Conector de Tiendanube. Toda la lógica específica de la plataforma vive acá.
 * Docs: https://tiendanube.github.io/api-documentation/
 */

const API_BASE = "https://api.tiendanube.com/v1";
const AUTH_TOKEN_URL = "https://www.tiendanube.com/apps/authorize/token";

/** URL a la que se manda al dueño para instalar/autorizar la app. */
export function oauthStartUrl(): string {
  const clientId = config.tiendanube.clientId();
  return `https://www.tiendanube.com/apps/${clientId}/authorize`;
}

/** Intercambia el `code` del callback por el access_token permanente + store_id. */
export async function exchangeCodeForToken(code: string): Promise<{ storeId: string; accessToken: string }> {
  const res = await fetch(AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.tiendanube.clientId(),
      client_secret: config.tiendanube.clientSecret(),
      grant_type: "authorization_code",
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Tiendanube token falló ${res.status}: ${JSON.stringify(data)}`);
  return { storeId: String(data.user_id), accessToken: data.access_token };
}

/** Cliente autenticado de la API. El User-Agent es OBLIGATORIO en Tiendanube. */
async function apiGet<T>(storeId: string, token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${storeId}${path}`, {
    headers: {
      Authentication: `bearer ${token}`,
      "User-Agent": config.tiendanube.userAgent,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Tiendanube GET ${path} falló ${res.status}`);
  return res.json() as Promise<T>;
}

export type TiendanubeOrder = {
  id: number;
  contact_phone?: string;
  status?: string;         // open | closed | cancelled
  payment_status?: string; // pending | paid | ...
  shipping_status?: string;
  gateway?: string;        // método de pago crudo
  total?: string;
  currency?: string;
};

export async function fetchOrder(storeId: string, token: string, orderId: string) {
  return apiGet<TiendanubeOrder>(storeId, token, `/orders/${orderId}`);
}

/** Carritos abandonados: no tienen webhook, se pollean por cron. */
export async function fetchAbandonedCheckouts(storeId: string, token: string) {
  return apiGet<any[]>(storeId, token, `/checkouts?status=abandoned`);
}

/**
 * Mapa de labels PROPIO: el estado nunca se muestra crudo. Se traduce al
 * idioma del cliente antes de informarlo (regla de §8 de PROCESOS.md).
 */
const STATUS_LABELS: Record<string, string> = {
  open: "en preparación",
  closed: "completado",
  cancelled: "cancelado",
  pending: "pago pendiente",
  paid: "pago confirmado",
  unpacked: "preparando el envío",
  packed: "empaquetado",
  shipped: "enviado",
  delivered: "entregado",
  fulfilled: "entregado",
};

export function getOrderStatusLabel(raw: string | null | undefined): string {
  if (!raw) return "en revisión";
  return STATUS_LABELS[raw] ?? "en revisión";
}

/**
 * Método de pago normalizado, para el gate de "pago pendiente": el aviso solo
 * sale para pagos por transferencia/offline, nunca tarjeta ni pasarela.
 */
export function paymentKind(gateway: string | null | undefined): "transfer" | "offline" | "gateway" {
  const g = (gateway ?? "").toLowerCase();
  if (g.includes("transf") || g.includes("deposit")) return "transfer";
  if (g.includes("cash") || g.includes("efectivo") || g.includes("offline")) return "offline";
  return "gateway";
}
