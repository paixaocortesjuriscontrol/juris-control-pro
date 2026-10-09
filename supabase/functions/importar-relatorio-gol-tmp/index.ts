import { createClient } from "npm:@supabase/supabase-js@2";

const URL_DADOS = "https://id-preview--671ea0fa-b063-4a5f-868c-a7eebee4bc12.lovable.app/__l5e/assets-v1/770f0b7e-c543-4e32-8334-2f3f85951c12/gol_import_x7k2q.json";

Deno.serve(async (req) => {
  const { inicio = 0, fim = 2000 } = await req.json().catch(() => ({}));
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const dados = await (await fetch(URL_DADOS)).json();
  const fatia = dados.slice(inicio, fim);
  const tot = { novos: 0, atualizados: 0, gol_adicional: 0, erros: [] as string[] };
  for (let i = 0; i < fatia.length; i += 250) {
    const { data, error } = await sb.rpc("_importar_relatorio_gol" as any, { _recs: fatia.slice(i, i + 250) });
    if (error) { tot.erros.push(`${inicio + i}: ${error.message}`); continue; }
    tot.novos += data.novos; tot.atualizados += data.atualizados; tot.gol_adicional += data.gol_adicional;
  }
  return new Response(JSON.stringify({ total: dados.length, inicio, fim, ...tot }), { headers: { "Content-Type": "application/json" } });
});
