import { type NextRequest } from "next/server";
import { config } from "./config";

/**
 * Protege los endpoints de cron. Vercel Cron manda el header:
 *   Authorization: Bearer <CRON_SECRET>
 * Devuelve true si la request está autorizada.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${config.cronSecret()}`;
}
