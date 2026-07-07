import { generateText, type CoreMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSystemPrompt, type AgentContext } from "./prompt";
import { makeTools, type ToolCtx } from "./tools";
import { withModelFallback } from "./models";
import { reviewDraft } from "./review";

const MEMORY_WINDOW = 20;

export type AgentResult = { text: string; usedTools: boolean };

/**
 * Corre el agente para una conversación. Junta las tres capas de conocimiento,
 * la memoria acotada (~20 mensajes) y las herramientas; genera con fallback de
 * modelos y pasa el borrador por la autorrevisión antes de devolver el texto.
 * No envía ni registra nada: de eso se ocupa processInbound.
 */
export async function runAgent(
  db: SupabaseClient,
  agentCtx: AgentContext,
  toolCtx: ToolCtx
): Promise<AgentResult> {
  const systemPrompt = await buildSystemPrompt(db, agentCtx);

  // Memoria: últimos ~20 mensajes. Los envíos automáticos se marcan como
  // aviso del sistema para que el agente no se los atribuya.
  const { data: history } = await db
    .from("messages")
    .select("sender, body, raw")
    .eq("conversation_id", toolCtx.conversationId)
    .order("created_at", { ascending: false })
    .limit(MEMORY_WINDOW);

  const messages: CoreMessage[] = (history ?? [])
    .reverse()
    .filter((m) => m.body)
    .map((m): CoreMessage => {
      const kind = (m.raw as any)?.kind;
      if (kind === "marketing" || kind === "followup") {
        return { role: "assistant", content: `[aviso automático del sistema] ${m.body}` };
      }
      return { role: m.sender === "customer" ? "user" : "assistant", content: m.body as string };
    });

  const tools = makeTools(toolCtx);
  const traceLines: string[] = [];

  const { text, toolCalls, toolResults } = await withModelFallback(async (model) =>
    generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 4, // permite: consultar herramienta -> responder con el dato
    })
  );

  // Traza de herramientas para pasarle a la autorrevisión (verdad verificada).
  (toolCalls ?? []).forEach((c, i) => {
    traceLines.push(`${c.toolName}(${JSON.stringify(c.args)}) -> ${JSON.stringify(toolResults?.[i]?.result ?? {})}`);
  });

  const finalText = await reviewDraft({
    draft: text,
    toolTrace: traceLines.join("\n"),
    systemPrompt,
  });

  return { text: finalText, usedTools: (toolCalls?.length ?? 0) > 0 };
}
