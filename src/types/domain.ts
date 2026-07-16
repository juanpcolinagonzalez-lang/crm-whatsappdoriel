/** Tipos del dominio, alineados con los enums de la migración 0001. */

export type UserRole = "admin" | "asesor";

export type StageRole =
    | "new"
  | "engaged"
  | "interested"
  | "payment_pending"
  | "sold"
  | "post_sale"
  | "happy"
  | "lost";

export type MessageSender = "customer" | "bot" | "human";

export type TemplateCategory = "utility" | "marketing";

export type SendStatus = "queued" | "sent" | "skipped" | "failed";

/** Gatillos de flujo automático (§2 de PROCESOS.md). */
export type FlowTrigger =
    | "order_confirmed"
  | "shipped"
  | "cancelled"
  | "payment_pending"
  | "ready_for_pickup"
  | "abandoned_cart"
  | "followup"
  | "confirm_address";

/** Gatillos que ocurren una vez por pedido -> anti-duplicado de 30 días. */
export const ONCE_PER_ORDER: FlowTrigger[] = ["order_confirmed", "shipped", "cancelled", "confirm_address"];

export type BusinessInfo = Record<string, unknown>;
