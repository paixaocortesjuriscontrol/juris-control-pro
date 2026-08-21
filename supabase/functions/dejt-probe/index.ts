// Sonda de diagnóstico: testa URLs de caderno do DEJT direto e via pool de VPS.
// Não grava nada no banco. Uso exclusivo de depuração (service role / admin).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/pdf,text/html,*/*",
  "Referer": "https://dejt.jt.jus.br/",
};

async function getPool(): Promise<Array<{ base_url: string; token: string }>> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return [];
  const res = await fetch(
    `${url}/rest/v1/djen_proxy_pool?select=base_url,token,enabled&enabled=eq.true&order=created_at.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return (rows || [])
    .filter((r) => typeof r.base_url === "string" && typeof r.token === "string" && r.token)
    .map((r) => ({ base_url: String(r.base_url).replace(/\/+$/, ""), token: String(r.token) }));
}

async function describe(res: Response) {
  const ct = res.headers.get("content-type") || "";
  const out: Record<string, unknown> = {
    status: res.status,
    contentType: ct,
    contentLength: res.headers.get("content-length"),
    lastModified: res.headers.get("last-modified"),
  };
  const buf = new Uint8Array(await res.arrayBuffer());
  out.bytes = buf.length;
  out.isPdf = buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50;
  if (!out.isPdf) {
    out.snippet = new TextDecoder().decode(buf.slice(0, 400));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.slice(0, 12) : [];
    const viaProxyOnly = body?.viaProxyOnly === true;
    if (!urls.length) {
      return new Response(JSON.stringify({ error: "informe urls[]" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pool = await getPool();
    const proxyLimit = Math.max(1, Math.min(Number(body?.proxyLimit ?? 2), pool.length || 1));
    const results: unknown[] = [];

    for (const url of urls) {
      const entry: Record<string, unknown> = { url };
      if (!viaProxyOnly) {
        try {
          entry.direto = await describe(await fetch(url, { headers: HEADERS }));
        } catch (e) {
          entry.direto = { erro: (e as Error)?.message || String(e) };
        }
      }
      const viaProxy: unknown[] = [];
      for (const slot of pool.slice(0, proxyLimit)) {
        const host = new URL(slot.base_url).hostname;
        try {
          const res = await fetch(`${slot.base_url}/fetch?url=${encodeURIComponent(url)}`, {
            headers: { "x-proxy-token": slot.token },
          });
          viaProxy.push({ proxy: host, ...(await describe(res)) });
        } catch (e) {
          viaProxy.push({ proxy: host, erro: (e as Error)?.message || String(e) });
        }
      }
      entry.viaProxy = viaProxy;
      results.push(entry);
    }

    return new Response(JSON.stringify({ proxiesDisponiveis: pool.length, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
