import { config } from "@/lib/config";

/**
 * Conector de Tiendanube. Toda la logica especifica de la plataforma vive aca.
 * Docs: https://tiendanube.github.io/api-documentation/
 */

const API_BASE = "https://api.tiendanube.com/v1";
const AUTH_TOKEN_URL = "https://www.tiendanube.com/apps/authorize/token";

/** URL a la que se manda al dueno para instalar/autorizar la app. */
export function oauthStartUrl(): string {
    const clientId = config.tiendanube.clientId();
    return `https://www.tiendanube.com/apps/${clientId}/authorize`;
}

/** Intercambia el code del callback por el access_token permanente + store_id. */
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
    if (!res.ok) throw new Error(`Tiendanube token fallo ${res.status}: ${JSON.stringify(data)}`);
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
    if (!res.ok) throw new Error(`Tiendanube GET ${path} fallo ${res.status}`);
    return res.json() as Promise<T>;
}

export type TiendanubeOrder = {
    id: number;
    contact_phone?: string;
    status?: string;
    payment_status?: string;
    shipping_status?: string;
    gateway?: string;
    total?: string;
    currency?: string;
    shipping_tracking_number?: string;
    shipping_tracking_url?: string;
    shipping_carrier_name?: string;
};

export async function fetchOrder(storeId: string, token: string, orderId: string) {
    return apiGet<TiendanubeOrder>(storeId, token, `/orders/${orderId}`);
}

export async function fetchAbandonedCheckouts(storeId: string, token: string) {
    return apiGet<any[]>(storeId, token, `/checkouts?status=abandoned`);
}

export type TiendanubeVariant = {
    price?: string;
    promotional_price?: string | null;
    stock?: number | null;
};

export type TiendanubeProduct = {
    id: number;
    name: Record<string, string> | string;
    variants?: TiendanubeVariant[];
};

/** Busca productos por nombre/texto EN VIVO contra el catalogo real de la tienda. */
export async function searchProducts(storeId: string, token: string, query: string) {
    return apiGet<TiendanubeProduct[]>(storeId, token, `/products?q=${encodeURIComponent(query)}&per_page=5`);
}

/** Extrae el nombre en un idioma legible sin importar el formato devuelto por la API. */
export function productName(p: TiendanubeProduct): string {
    if (typeof p.name === "string") return p.name;
    return p.name.es ?? p.name.pt ?? p.name.en ?? Object.values(p.name)[0] ?? "";
}

const STATUS_LABELS: Record<string, string> = {
    open: "en preparacion",
    closed: "completado",
    cancelled: "cancelado",
    pending: "pago pendiente",
    paid: "pago confirmado",
    unpacked: "preparando el envio",
    packed: "empaquetado",
    shipped: "enviado",
    delivered: "entregado",
    fulfilled: "entregado",
};

export function getOrderStatusLabel(raw: string | null | undefined): string {
    if (!raw) return "en revision";
    return STATUS_LABELS[raw] ?? "en revision";
}

export function paymentKind(gateway: string | null | undefined): "transfer" | "offline" | "gateway" {
    const g = (gateway ?? "").toLowerCase();
    if (g.includes("transf") || g.includes("deposit")) return "transfer";
    if (g.includes("cash") || g.includes("efectivo") || g.includes("offline")) return "offline";
    return "gateway";
}
