import { WhatsAppAdapter } from "./whatsapp";
import type { TransportAdapter } from "./types";

export type { InternalMessage, TransportAdapter, TemplateComponent } from "./types";

/**
 * Único lugar donde se elige el canal. El resto del sistema pide `getTransport()`
 * y programa contra la interfaz, nunca contra WhatsApp directamente.
 */
export function getTransport(channel: string = "whatsapp"): TransportAdapter {
  switch (channel) {
    case "whatsapp":
      return new WhatsAppAdapter();
    default:
      throw new Error(`Canal no soportado: ${channel}`);
  }
}
