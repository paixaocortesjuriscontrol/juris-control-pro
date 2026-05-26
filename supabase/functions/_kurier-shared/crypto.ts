// Helpers compartilhados das edge functions Kurier.
// AES-GCM local com COFRE_ENCRYPTION_KEY (mesma chave do cofre).

const ENCRYPTION_KEY = Deno.env.get("COFRE_ENCRYPTION_KEY") ?? "";

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

export async function decryptKurier(ciphertext: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const key = await deriveKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

export async function encryptKurier(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey();
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// URL oficial do webservice Kurier conforme documentação v.01.2019
// (o antigo wsk.kurier.com.br foi descontinuado / sem DNS).
export const DEFAULT_KURIER_BASE_URL = "https://www.kurierservicos.com.br/wsservicos";

export function buildKurierUrl(baseUrl: string, path: string, params: Record<string, string | number | undefined>): string {
  const base = (baseUrl || DEFAULT_KURIER_BASE_URL).replace(/\/+$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildKurierAuthHeaders(
  login: string,
  senha: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    ...extra,
    Authorization: `Basic ${base64Utf8(`${login}:${senha}`)}`,
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function getKurierBaseUrlFromDb(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("configuracoes_monitoramento")
      .select("metadata")
      .eq("tipo", "kurier")
      .maybeSingle();
    const url = (data?.metadata as any)?.base_url;
    return (typeof url === "string" && url.trim()) ? url.trim() : DEFAULT_KURIER_BASE_URL;
  } catch {
    return DEFAULT_KURIER_BASE_URL;
  }
}