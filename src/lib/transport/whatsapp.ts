import { config } from "@/lib/config";
import type { InternalMessage, TemplateComponent, TransportAdapter } from "./types";

/**
 * Adaptador WhatsApp Cloud API (Meta). Toda la lógica específica del proveedor
 * vive acá dentro. Base de la API: https://graph.facebook.com/{version}
 */
export class WhatsAppAdapter implements TransportAdapter {
    private base() {
          return `https://graph.facebook.com/${config.whatsapp.graphVersion}`;
    }
    private headers() {
          return {
                  Authorization: `Bearer ${config.whatsapp.token()}`,
                  "Content-Type": "application/json",
          };
    }

  ensureRecipient(phone: string): string {
        const digits = phone.replace(/\D/g, ""); // E.164 solo dígitos
      // Argentina: WhatsApp exige el "9" despues del codigo de pais (54) para
      // poder enviar mensajes, pero los mensajes entrantes llegan SIN ese "9".
      // Normalizamos aca para que todo el sistema (guardado y envio) use
      // siempre el mismo formato "549...".
      if (digits.startsWith("54") && !digits.startsWith("549")) {
              return "549" + digits.slice(2);
      }
        return digits;
  }

  normalizeInbound(payload: unknown): InternalMessage[] {
        const out: InternalMessage[] = [];
        const body = payload as any;
        const changes = body?.entry?.flatMap((e: any) => e?.changes ?? []) ?? [];

      for (const change of changes) {
              const value = change?.value ?? {};
              const contacts: any[] = value.contacts ?? [];
              const profileName = contacts[0]?.profile?.name ?? null;

          // Mensajes entrantes del cliente.
          for (const m of value.messages ?? []) {
                    out.push(this.toInternal(m, profileName, false));
          }
              // Ecos: mensajes que el negocio mando desde afuera del CRM.
          for (const m of value.message_echoes ?? []) {
                    out.push(this.toInternal(m, profileName, true));
          }
              // Los eventos de estado (sent/delivered/read) no traen messages: se ignoran.
      }
        return out;
  }

  private toInternal(m: any, profileName: string | null, isEcho: boolean): InternalMessage {
        let text: string | null = null;
        let media: InternalMessage["media"] = null;

      if (m.type === "text") text = m.text?.body ?? null;
        else if (m.type === "image") { media = { id: m.image?.id, mimeType: m.image?.mime_type ?? null }; text = m.image?.caption ?? null; }
        else if (m.type === "audio") media = { id: m.audio?.id, mimeType: m.audio?.mime_type ?? null };
        else if (m.type === "document") { media = { id: m.document?.id, mimeType: m.document?.mime_type ?? null }; text = m.document?.caption ?? null; }
        else if (m.type === "video") { media = { id: m.video?.id, mimeType: m.video?.mime_type ?? null }; text = m.video?.caption ?? null; }
        else if (m.type === "button") text = m.button?.text ?? null;
        else if (m.type === "interactive") text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;

      return {
              channel: "whatsapp",
              phone: this.ensureRecipient(m.from ?? m.to ?? ""),
              profileName,
              text,
              media,
              waMessageId: m.id ?? null,
              isEcho,
              timestamp: m.timestamp ? Number(m.timestamp) * 1000 : Date.now(),
      };
  }

    async sendMessage(phone: string, text: string) {
          return this.post({
                  messaging_product: "whatsapp",
                  to: this.ensureRecipient(phone),
                  type: "text",
                  text: { body: text },
          });
    }

  async sendTemplate(phone: string, name: string, language: string, components: TemplateComponent[]) {
        return this.post({
                messaging_product: "whatsapp",
                to: this.ensureRecipient(phone),
                type: "template",
                template: { name, language: { code: language }, components },
        });
  }

  private async post(payload: unknown): Promise<{ id: string }> {
        const res = await fetch(`${this.base()}/${config.whatsapp.phoneNumberId()}/messages`, {
                method: "POST",
                headers: this.headers(),
                body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
                // Nunca tragarse el fallo: el sistema debe saber que NO salio.
          // 131047 = ventana de 24 h cerrada -> el llamador reintenta con plantilla.
          const err = new Error(`WhatsApp send fallo ${res.status}: ${JSON.stringify(data)}`) as Error & { status: number; code?: number };
                err.status = res.status;
                err.code = data?.error?.code;
                throw err;
        }
        return { id: data?.messages?.[0]?.id ?? "" };
  }

  async fetchMedia(mediaId: string): Promise<{ bytes: Buffer; mimeType: string }> {
        // 1) media_id -> URL temporal + mime
      const metaRes = await fetch(`${this.base()}/${mediaId}`, { headers: this.headers() });
        if (!metaRes.ok) throw new Error(`fetchMedia meta fallo ${metaRes.status}`);
        const meta = await metaRes.json();

      // 2) URL temporal -> bytes (la URL de Meta EXPIRA en minutos)
      const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${config.whatsapp.token()}` } });
        if (!bin.ok) throw new Error(`fetchMedia bytes fallo ${bin.status}`);

      return { bytes: Buffer.from(await bin.arrayBuffer()), mimeType: meta.mime_type ?? "application/octet-stream" };
  }
}
