import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { config } from "@/lib/config";

/** Resuelve el proveedor a partir del nombre del modelo. */
function resolveModel(name: string): LanguageModel {
  if (name.startsWith("claude")) return anthropic(name);
  if (name.startsWith("gpt") || name.startsWith("o")) return openai(name);
  // Por defecto, Anthropic.
  return anthropic(name);
}

/** Cadena ordenada: primario primero, respaldo después. */
export function modelChain(): LanguageModel[] {
  return [resolveModel(config.models.primary), resolveModel(config.models.fallback)];
}

const TRANSIENT = ["terminated", "ECONNRESET", "socket", "429", "503", "ETIMEDOUT"];

function isTransient(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return TRANSIENT.some((t) => msg.includes(t));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ejecuta `run` sobre la cadena de modelos. Ante error transitorio, reintenta
 * el mismo modelo con espera creciente; si igual falla, pasa al siguiente
 * proveedor. Si se agota la cadena, propaga el último error (nunca queda mudo
 * en silencio: el llamador decide el fallback final —p.ej. derivar).
 */
export async function withModelFallback<T>(
  run: (model: LanguageModel) => Promise<T>,
  opts: { retriesPerModel?: number } = {}
): Promise<T> {
  const retries = opts.retriesPerModel ?? 2;
  const chain = modelChain();
  let lastError: unknown;

  for (const model of chain) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await run(model);
      } catch (err) {
        lastError = err;
        if (isTransient(err) && attempt < retries) {
          await sleep(300 * Math.pow(2, attempt)); // 300ms, 600ms, 1200ms...
          continue;
        }
        break; // no transitorio o sin reintentos: probar el siguiente modelo
      }
    }
  }
  throw lastError;
}
