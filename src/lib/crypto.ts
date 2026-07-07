import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "./config";

/**
 * Cifrado simétrico AES-256-GCM para tokens de terceros (ecommerce, Meta).
 * Formato de salida: base64( iv[12] | authTag[16] | ciphertext ).
 * La llave (ENCRYPTION_KEY) son 32 bytes en hex (64 caracteres).
 */

function key(): Buffer {
  const k = Buffer.from(config.encryptionKey(), "hex");
  if (k.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres). Generá con: openssl rand -hex 32");
  }
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
