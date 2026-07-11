import { generateText } from "ai";
import { withModelFallback } from "./models";

const REVIEW_TIMEOUT_MS = 9000;

const FALLBACK_MESSAGE = "Dejame confirmarlo con el equipo y te escribo en un toque ";

const INTERNAL_LEAK_PATTERNS = /(borrador|regla\s*\d|reglas del agente|revisor|traza de herramientas|no se usaron herramientas|invenciones|no puedo devolver|systemPrompt)/i;

/**
* El modelo revisa su propio borrador contra las reglas antes de mandarlo.
* CLAVE: recibe la traza de herramientas; los datos verificados por herramienta
* NO se tocan ni se ponen en duda. Solo corrige tono, largo, invenciones ajenas
* a las herramientas y derivaciones faltantes. Con tope de tiempo: si tarda,
* se manda el borrador original (mejor responder que colgar al cliente).
* RED DE SEGURIDAD: si la revision devuelve un comentario interno en vez de un
* mensaje para el cliente (habla de reglas, herramientas, borrador, etc), se
* descarta y se manda un mensaje generico seguro en su lugar.
*/
export async function reviewDraft(params: {
  draft: string;
  toolTrace: string;
  systemPrompt: string;
}): Promise<string> {
  const { draft, toolTrace, systemPrompt } = params;

const reviewPrompt = `
Sos un editor invisible. Tu UNICA salida es el mensaje de WhatsApp que le va a
llegar TAL CUAL al cliente. Nunca le hablas a nadie sobre el borrador, nunca
explicas que esta mal, nunca mencionas "reglas", "revisor", "herramientas" ni
nada interno: si escribis algo asi, ese texto se envia tal cual al cliente y
arruina la conversacion. Prohibido rechazar la tarea o pedir aclaraciones:
SIEMPRE devolves un mensaje breve y calido, nunca un analisis.

Corregi el BORRADOR para que cumpla las reglas del agente: tono calido de 1 a
3 lineas, sin markdown ni listas. Si el borrador afirma un precio, stock,
disponibilidad o cualquier dato que NO este respaldado por la TRAZA DE
HERRAMIENTAS de abajo, saca esa parte especifica y reemplazala por una frase
corta ofreciendo confirmarlo con el equipo (sin explicar por que ni mencionar
que era un dato no verificado). Los datos que SI vienen en la traza son verdad
verificada: no los toques ni los pongas en duda.

Si el borrador ya cumple todo, devolvelo igual, sin cambios.

Devolve EXCLUSIVAMENTE el mensaje final para el cliente. Nada mas: sin
comillas, sin explicaciones, sin encabezados.

--- REGLAS DEL AGENTE (uso interno, no las repitas) ---
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

  if (!result || INTERNAL_LEAK_PATTERNS.test(result)) {
    return FALLBACK_MESSAGE;
  }

  return result;
} catch {
  if (INTERNAL_LEAK_PATTERNS.test(draft)) return FALLBACK_MESSAGE;
  return draft;
}
}
