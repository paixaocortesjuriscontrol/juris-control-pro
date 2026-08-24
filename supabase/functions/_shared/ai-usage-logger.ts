// Registra o uso de IA na tabela public.ai_usage_logs.
// Nunca lança — falhas são apenas logadas no console para não quebrar a chamada de IA.

import { createClient } from "npm:@supabase/supabase-js@2";

// Tabela de preços (USD por 1M tokens). Baseada em julho/2026.
// Extenda aqui conforme necessário.
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-flash-latest": { input: 0.30, output: 2.50 },
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gemini-2.5-flash-preview": { input: 0.30, output: 2.50 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0 },
  "gemini-3-pro-preview": { input: 2.0, output: 12.0 },

  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
};

function computeCostUsd(model: string, prompt: number, completion: number): number {
  const p = PRICES[model] ?? PRICES["gemini-2.5-flash"];
  return (prompt / 1_000_000) * p.input + (completion / 1_000_000) * p.output;
}

function decodeJwtPayload(authHeader: string | null | undefined): { sub?: string; email?: string } | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    // base64url decode
    const pad = "=".repeat((4 - (parts[1].length % 4)) % 4);
    const b64 = (parts[1] + pad).replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractOrigem(referer: string | null | undefined, explicitOrigem?: string | null): string | null {
  if (explicitOrigem && typeof explicitOrigem === "string") return explicitOrigem.slice(0, 200);
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return (u.pathname + (u.search || "")).slice(0, 200);
  } catch {
    return referer.slice(0, 200);
  }
}

export interface AiUsageLogParams {
  edgeFunction: string;
  model: string;
  authHeader?: string | null;
  referer?: string | null;
  origem?: string | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  duracaoMs?: number;
  status?: "success" | "error" | "rate_limited";
  erro?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAiUsage(params: AiUsageLogParams): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const payload = decodeJwtPayload(params.authHeader);
    const prompt = Number(params.prompt_tokens ?? 0);
    const completion = Number(params.completion_tokens ?? 0);
    const total = Number(params.total_tokens ?? prompt + completion);
    const model = params.model || "unknown";

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const row = {
      user_id: payload?.sub ?? null,
      user_email: payload?.email ?? null,
      edge_function: params.edgeFunction,
      origem: extractOrigem(params.referer, params.origem),
      model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
      custo_usd: computeCostUsd(model, prompt, completion),
      duracao_ms: params.duracaoMs ?? null,
      status: params.status ?? "success",
      erro: params.erro ?? null,
      metadata: params.metadata ?? {},
    };
    const { error } = await admin.from("ai_usage_logs").insert(row);
    if (error) console.error("[ai_usage_logs] insert failed:", error.message);
  } catch (e) {
    console.error("[ai_usage_logs] logger crashed:", (e as Error)?.message);
  }
}