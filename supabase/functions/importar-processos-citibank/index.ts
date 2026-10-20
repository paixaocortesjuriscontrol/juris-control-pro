import { createClient } from "npm:@supabase/supabase-js@2";

// Importação única dos processos da planilha BASE_PAIXAO_102026.xlsx (Coordenação Citibank).
// Protegida por token no header x-import-token (mesmo padrão das importações em lote).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-import-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("IMPORT_HEINZ_TOKEN");
  const provided = req.headers.get("x-import-token") || "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "token inválido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => null);
  const rows = body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: "rows ausente" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pula processos cujo número já existe na coordenação (idempotente)
  const numeros = rows.map((r: Record<string, unknown>) => String(r.numero));
  const { data: existentes, error: errSel } = await supabase
    .from("processos")
    .select("numero")
    .eq("coordenacao_id", "f3b3b3b3-234d-48b3-8f3e-e3d956cae927")
    .in("numero", numeros);
  if (errSel) {
    return new Response(JSON.stringify({ error: errSel.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jaExistem = new Set((existentes || []).map((e: { numero: string }) => e.numero));
  const novos = rows.filter((r: Record<string, unknown>) => !jaExistem.has(String(r.numero)));

  let inseridos = 0;
  const erros: { numero: string; erro: string }[] = [];
  for (let i = 0; i < novos.length; i += 100) {
    const lote = novos.slice(i, i + 100);
    const { error } = await supabase.from("processos").insert(lote);
    if (error) {
      // fallback individual para não perder o lote inteiro
      for (const r of lote) {
        const { error: e1 } = await supabase.from("processos").insert(r);
        if (e1) erros.push({ numero: String(r.numero), erro: e1.message });
        else inseridos++;
      }
    } else {
      inseridos += lote.length;
    }
  }

  return new Response(
    JSON.stringify({ recebidos: rows.length, ja_existiam: jaExistem.size, inseridos, erros }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
