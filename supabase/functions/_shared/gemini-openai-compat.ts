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
const DEFAULT_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-pro";

function mapModel(model?: string): string {
  if (!model) return DEFAULT_MODEL;
  if (model.startsWith("gemini")) return model;
  // gpt-4o, gpt-4o-mini, gpt-4.1, etc -> Gemini padrão
  return DEFAULT_MODEL;
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
  const key = Deno.env.get("GEMINI_API_KEY_DJEN") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: { message: "Chave Gemini não configurada" } }),
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

  const url = `${GEMINI_BASE}/models/${model}:generateContent`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(geminiBody),
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: { message: `Falha de rede Gemini: ${e?.message || e}` } }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!resp.ok) {
    const errText = await resp.text();
    return new Response(
      JSON.stringify({ error: { message: `Gemini ${resp.status}: ${errText}` } }),
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

  return new Response(JSON.stringify(openaiResp), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}