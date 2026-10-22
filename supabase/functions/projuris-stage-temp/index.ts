// TEMPORÁRIA: carga dos vínculos Projuris na tabela de conferência. Remover após uso.
import { createClient } from "npm:@supabase/supabase-js@2";
const TOKEN = "163a408ca8940bea99c823ff13b69c5d94fb6b16fc0325af";
Deno.serve(async (req) => {
  if (req.headers.get("x-stage-token") !== TOKEN) return new Response("no", { status: 403 });
  const rows = await req.json();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await sb.from("projuris_vinculo_stage").insert(rows);
  return new Response(JSON.stringify({ ok: !error, error: error?.message, n: rows.length }), { status: error ? 500 : 200 });
});
