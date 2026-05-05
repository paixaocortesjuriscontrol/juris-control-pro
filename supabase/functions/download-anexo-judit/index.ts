import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDIT_LAWSUITS = "https://lawsuits.production.judit.io";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Token inválido" }, 401);

    const juditApiKey = Deno.env.get("JUDIT_API_KEY");
    if (!juditApiKey) return json({ error: "JUDIT_API_KEY não configurada" }, 500);

    const { cnj, instance, attachment_id, filename } = await req.json();
    if (!cnj || !attachment_id) return json({ error: "cnj e attachment_id obrigatórios" }, 400);

    const cnjClean = String(cnj).replace(/[^0-9.-]/g, "").trim();
    const inst = instance || "1";
    const url = `${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnjClean)}/${inst}/attachments/${encodeURIComponent(attachment_id)}`;
    const res = await fetch(url, { headers: { "api-key": juditApiKey } });
    if (!res.ok) {
      const txt = await res.text();
      return json({ error: `HTTP ${res.status}: ${txt.substring(0, 200)}` }, 200);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const safeName = String(filename || `documento_${attachment_id}.pdf`)
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    const contentType = res.headers.get("content-type") || (safeName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const path = `judit-temp/${user.id}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from("documentos_processos").upload(path, buf, { upsert: true, contentType });
    if (upErr) return json({ error: "Upload falhou: " + upErr.message }, 200);
    const { data: signed, error: signErr } = await supabase.storage.from("documentos_processos").createSignedUrl(path, 3600);
    if (signErr || !signed?.signedUrl) return json({ error: "Falha ao gerar URL: " + (signErr?.message || "") }, 200);
    return json({ signed_url: signed.signedUrl, filename: safeName }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}