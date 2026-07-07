import { generateText } from "ai";
import { withModelFallback } from "./models";

const REVIEW_TIMEOUT_MS = 6000;

/**
 * El modelo revisa su propio borrador contra las reglas antes de mandarlo.
 * CLAVE: recibe la traza de herramientas; los datos verificados por herramienta
 * NO se tocan ni se ponen en duda. Solo corrige tono, largo, invenciones ajenas
 * a las herramientas y derivaciones faltantes. Con tope de tiempo: si tarda,
 * se manda el borrador original (mejor responder que colgar al cliente).
 */
export async function reviewDraft(params: {
  draft: string;
  toolTrace: string; // resumen de qué herramientas se llamaron y qué devolvieron
  systemPrompt: string;
}): Promise<string> {
  const { draft, toolTrace, systemPrompt } = params;

  const reviewPrompt = `
Sos un revisor de calidad. Revisá el BORRADOR de respuesta contra las reglas del
agente. Corregí SOLO: tono (que suene como una persona real, cálido, 1-3 líneas),
largo (breve, una cosa por vez), formato (texto natural sin markdown ni listas),
e invenciones (datos que NO estén respaldados por las herramientas).

REGLA CRÍTICA: los datos que vienen de las herramientas (abajo) son verdad
verificada. NO los cambies, NO los pongas en duda, NO los borres.

Si el borrador ya cumple, devolvelo igual. Devolvé SOLO el texto final para el
cliente, sin comillas ni explicaciones.

--- REGLAS DEL AGENTE ---
${systemPrompt}

--- TRAZA DE HERRAMIENTAS (verdad verificada) ---
${toolTrace || "(no se usaron herramientas)"}

--- BORRADOR ---
${draft}
`.trim();

  try {
    const timeout = new Promise<string>((_, rej) =>
      setTimeout(() => rej(new Error("review timeout")), REVIEW_TIMEOUT_MS)
    );
    const review = withModelFallback(async (model) => {
      const { text } = await generateText({ model, prompt: reviewPrompt });
      return text.trim();
    }, { retriesPerModel: 0 });

    const result = await Promise.race([review, timeout]);
    return result || draft;
  } catch {
    return draft; // ante cualquier fallo del revisor, va el borrador
  }
}
