/**
 * Contrato del transporte. El CRM es dueño de todo; el canal (WhatsApp,
 * Instagram, ...) vive SOLO detrás de esta interfaz. Cambiar de proveedor
 * debe tocar únicamente el adaptador, nunca la lógica de negocio.
 */

/** Formato interno único al que se normaliza TODO mensaje entrante. */
export type InternalMessage = {
  channel: "whatsapp";
  phone: string; // E.164, solo dígitos
  profileName: string | null;
  text: string | null;
  media: { id: string; mimeType: string | null } | null;
  waMessageId: string | null;
  /** true si es un eco (mensaje que el negocio mandó desde el celular). */
  isEcho: boolean;
  timestamp: number;
};

export type TemplateComponent = {
  type: "body";
  parameters: { type: "text"; text: string }[];
};

export interface TransportAdapter {
  /** Convierte un evento crudo del proveedor en 0..n InternalMessage. */
  normalizeInbound(payload: unknown): InternalMessage[];

  /** Texto libre (solo dentro de la ventana de 24 h). Lanza si el envío falla. */
  sendMessage(phone: string, text: string): Promise<{ id: string }>;

  /** Imagen por URL pública (dentro de la ventana de 24 h). Lanza si el envío falla. */
  sendImage(phone: string, imageUrl: string, caption?: string): Promise<{ id: string }>;

  /** Plantilla aprobada (única forma de escribir fuera de la ventana). */
  sendTemplate(
    phone: string,
    name: string,
    language: string,
    components: TemplateComponent[]
  ): Promise<{ id: string }>;

  /** Descarga media entrante y devuelve los bytes + mime. */
  fetchMedia(mediaId: string): Promise<{ bytes: Buffer; mimeType: string }>;

  /** El destinatario ES el teléfono (no hay concepto de "subscriber"). */
  ensureRecipient(phone: string): string;
}
