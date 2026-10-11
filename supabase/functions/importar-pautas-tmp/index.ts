import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ erro: "sem linhas" }), { status: 400, headers: cors });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error, count } = await supabase.from("pautas_tst").insert(rows, { count: "exact" });
    if (error) {
      return new Response(JSON.stringify({ erro: error.message }), { status: 500, headers: cors });
    }
    return new Response(JSON.stringify({ inseridas: count ?? rows.length }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: cors });
  }
});
