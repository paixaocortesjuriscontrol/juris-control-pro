import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = "gol-daiane-imp-9f3k2m7x";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const body = await req.json().catch(() => null);
  if (!body || body.token !== TOKEN) return new Response("unauthorized", { status: 401 });
  const rows = body.rows as any[];
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supabase.from("tmp_gol_daiane_import").insert(
    rows.map((r) => ({
      arquivo: r.arquivo, aba: r.aba, pub: r.pub, proc: r.proc, recl: r.recl,
      prov: r.prov, dias: r.dias, fatal: r.fatal, status: r.status,
      cliente: r.cliente, uf: r.uf, resp: r.resp, obs: r.obs,
    }))
  );
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, n: rows.length }), { headers: { "Content-Type": "application/json" } });
});
