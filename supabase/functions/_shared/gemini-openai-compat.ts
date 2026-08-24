// Compatibilidade OpenAI -> Gemini (Google AI Studio).
// Permite que código escrito para o endpoint /v1/chat/completions continue
// funcionando sem alterações estruturais, traduzindo a chamada para o
// endpoint generateContent do Gemini.
//
// Uso:
//   import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";
//   const response = await geminiChatCompletionsFetch({ model, messages, ... });
//   const data = await response.json(); // mesmo formato do OpenAI

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const FALLBACK_MODEL = "gemini-flash-latest";
// Substituto para os modelos "pro" descontinuados (gemini-2.5-pro foi removido pelo Google)
const PRO_MODEL = Deno.env.get("GEMINI_PRO_MODEL") || "gemini-3.1-pro-preview";
const DEFAULT_MODEL = Deno.env.get("GEMINI_MODEL") || FALLBACK_MODEL;

import { logAiUsage, type AiUsageLogParams } from "./ai-usage-logger.ts";

type AiUsageCtx = Pick<AiUsageLogParams, "edgeFunction" | "authHeader" | "referer" | "origem" | "metadata">;

function mapModel(model?: string): string {
  const rawModel = (model || DEFAULT_MODEL).replace(/^models\//, "").trim();
  // Modelos "pro" descontinuados -> substituto pro atual
  const deprecatedPro = new Set([
    "gemini-2.5-pro",
    "gemini-2.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-pro",
  ]);
  if (deprecatedPro.has(rawModel)) return PRO_MODEL;
  // Modelos rápidos descontinuados -> alias atual
  const deprecated = new Set([
    "gemini-2.5-flash",
    "gemini-2.5-flash-latest",
    "gemini-1.5-flash",
  ]);
  if (deprecated.has(rawModel)) return FALLBACK_MODEL;
  if (rawModel.startsWith("gemini")) return rawModel;
  // gpt-4o, gpt-4o-mini, gpt-4.1, etc -> Gemini padrão
  return FALLBACK_MODEL;
}


function messagesToContents(messages: any[]) {
  const systemTexts: string[] = [];
  const contents: any[] = [];
  for (const m of messages || []) {
    const role = m.role;
    let text = "";
    if (typeof m.content === "string") {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      text = m.content
        .map((c: any) => c?.text ?? c?.input_text ?? "")
        .filter(Boolean)
        .join("\n");
    }
    if (role === "system") {
      if (text) systemTexts.push(text);
      continue;
    }
    if (role === "tool") {
      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: m.name || "tool",
            response: { content: text },
          },
        }],
      });
      continue;
    }
    contents.push({
      role: role === "assistant" ? "model" : "user",
      parts: [{ text: text || "" }],
    });
  }
  return {
    systemInstruction: systemTexts.length
      ? { parts: [{ text: systemTexts.join("\n\n") }] }
      : undefined,
    contents,
  };
}

function toolsToGemini(tools: any[] | undefined, toolChoice: any) {
  if (!tools?.length) return { tools: undefined, toolConfig: undefined };
  const functionDeclarations = tools
    .filter((t) => t?.type === "function" && t?.function)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));
  let toolConfig: any = undefined;
  if (toolChoice && typeof toolChoice === "object" && toolChoice.type === "function") {
    toolConfig = {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: [toolChoice.function?.name].filter(Boolean),
      },
    };
  } else if (toolChoice === "required") {
    toolConfig = { functionCallingConfig: { mode: "ANY" } };
  } else if (toolChoice === "none") {
    toolConfig = { functionCallingConfig: { mode: "NONE" } };
  } else {
    toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }
  return { tools: [{ functionDeclarations }], toolConfig };
}

export async function geminiChatCompletionsFetch(body: any): Promise<Response> {
  const t0 = Date.now();
  const ctx: AiUsageCtx | undefined = body?._ai_usage;
  const logIfCtx = (extra: Partial<AiUsageLogParams>) => {
    if (!ctx?.edgeFunction) return;
    // fire-and-forget; never awaits blocking the response path
    logAiUsage({
      edgeFunction: ctx.edgeFunction,
      model: mapModel(body?.model),
      authHeader: ctx.authHeader ?? null,
      referer: ctx.referer ?? null,
      origem: ctx.origem ?? null,
      metadata: ctx.metadata ?? {},
      duracaoMs: Date.now() - t0,
      ...extra,
    }).catch(() => {});
  };

  const key = Deno.env.get("GEMINI_API_KEY_DJEN") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (!key) {
    logIfCtx({ status: "error", erro: "Chave Gemini não configurada" });
    return new Response(
      JSON.stringify({ error: { message: "Chave Gemini não configurada (GEMINI_API_KEY_DJEN)." } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const model = mapModel(body?.model);
  const { systemInstruction, contents } = messagesToContents(body?.messages || []);
  const { tools, toolConfig } = toolsToGemini(body?.tools, body?.tool_choice);

  const generationConfig: any = {};
  if (typeof body?.temperature === "number") generationConfig.temperature = body.temperature;
  if (typeof body?.max_tokens === "number") generationConfig.maxOutputTokens = body.max_tokens;
  if (typeof body?.top_p === "number") generationConfig.topP = body.top_p;
  const rf = body?.response_format;
  if (rf?.type === "json_object" || rf?.type === "json_schema") {
    generationConfig.responseMimeType = "application/json";
    if (rf?.json_schema?.schema) {
      generationConfig.responseSchema = rf.json_schema.schema;
    }
  }

  const geminiBody: any = { contents };
  if (systemInstruction) geminiBody.systemInstruction = systemInstruction;
  if (tools) geminiBody.tools = tools;
  if (toolConfig) geminiBody.toolConfig = toolConfig;
  if (Object.keys(generationConfig).length) geminiBody.generationConfig = generationConfig;

  let modeloUsado = model;
  const chamar = (m: string) =>
    fetch(`${GEMINI_BASE}/models/${m}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(geminiBody),
    });

  let resp: Response;
  try {
    resp = await chamar(model);
    // Modelo inexistente/indisponível para a conta -> tentar o alias rápido atual
    if (resp.status === 404 && model !== FALLBACK_MODEL) {
      console.warn(`gemini-compat: modelo ${model} retornou 404 — usando ${FALLBACK_MODEL}`);
      const retry = await chamar(FALLBACK_MODEL);
      if (retry.ok) {
        modeloUsado = FALLBACK_MODEL;
        resp = retry;
      } else {
        resp = retry.status === 404 ? resp : retry;
      }
    }
  } catch (e: any) {
    logIfCtx({ status: "error", erro: `Falha de rede Gemini: ${e?.message || e}` });
    return new Response(
      JSON.stringify({ error: { message: `Falha de rede Gemini: ${e?.message || e}` } }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!resp.ok) {

    const errText = await resp.text();
    const lower = errText.toLowerCase();
    const creditsDepleted = lower.includes("prepayment credits are depleted")
      || lower.includes("resource_exhausted")
      || lower.includes("quota");
    const friendly = creditsDepleted
      ? "A chave Gemini configurada está SEM CRÉDITOS no Google AI Studio. Adicione créditos em https://ai.studio/projects para continuar usando a IA."
      : `Gemini ${resp.status}: ${errText.slice(0, 500)}`;
    logIfCtx({
      status: resp.status === 429 ? "rate_limited" : "error",
      erro: friendly,
      metadata: { ...(ctx?.metadata ?? {}), gemini_status: resp.status },
    });
    return new Response(
      JSON.stringify({ error: { message: friendly, gemini_status: resp.status, gemini_raw: errText.slice(0, 500) } }),
      { status: resp.status, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await resp.json();
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  let textContent = "";
  const toolCalls: any[] = [];
  for (const p of parts) {
    if (typeof p?.text === "string") textContent += p.text;
    if (p?.functionCall) {
      toolCalls.push({
        id: `call_${toolCalls.length + 1}`,
        type: "function",
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args || {}),
        },
      });
    }
  }

  const openaiResp: any = {
    id: `gemini-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textContent || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: (candidate?.finishReason || "STOP").toString().toLowerCase(),
    }],
  };
  if (data?.usageMetadata) {
    openaiResp.usage = {
      prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
      completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
      total_tokens: data.usageMetadata.totalTokenCount ?? 0,
    };
  }

  logIfCtx({
    status: "success",
    prompt_tokens: data?.usageMetadata?.promptTokenCount ?? 0,
    completion_tokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    total_tokens: data?.usageMetadata?.totalTokenCount ?? 0,
  });

  return new Response(JSON.stringify(openaiResp), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}