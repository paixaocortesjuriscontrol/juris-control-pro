import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const updates: Record<string, string> = body?.updates || {};

    if (!Object.keys(updates).length) {
      return new Response(JSON.stringify({ ok: false, error: "No updates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    let errors = 0;
    const entries = Object.entries(updates);

    // Process in batches of 50
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      for (const [processo, tipo] of batch) {
        const { error, count } = await supabase
          .from("dados_benner")
          .update({ tipo_recurso: tipo })
          .eq("processo", processo)
          .or("tipo_recurso.is.null,tipo_recurso.eq.");

        if (error) {
          console.error(`Error updating ${processo}:`, error.message);
          errors++;
        } else {
          updated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, updated, errors, total: entries.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
