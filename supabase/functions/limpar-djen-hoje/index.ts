import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];
    const results: Record<string, string> = {};

    // 1. djen_tribunais_lote
    const r1 = await supabase
      .from('djen_tribunais_lote')
      .delete()
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59.999Z');
    results['djen_tribunais_lote'] = r1.error ? r1.error.message : 'ok';

    // 2. djen_lotes
    const r2 = await supabase
      .from('djen_lotes')
      .delete()
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59.999Z');
    results['djen_lotes'] = r2.error ? r2.error.message : 'ok';

    // 3. djen_runs
    const r3 = await supabase
      .from('djen_runs')
      .delete()
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59.999Z');
    results['djen_runs'] = r3.error ? r3.error.message : 'ok';

    // 4. publicacoes_djen
    const r4 = await supabase
      .from('publicacoes_djen')
      .delete()
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59.999Z');
    results['publicacoes_djen'] = r4.error ? r4.error.message : 'ok';

    // 5. publicacoes_djen_processos
    const r5 = await supabase
      .from('publicacoes_djen_processos')
      .delete()
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59.999Z');
    results['publicacoes_djen_processos'] = r5.error ? r5.error.message : 'ok';

    // 6. publicacoes_djen_descartadas
    const r6 = await supabase
      .from('publicacoes_djen_descartadas')
      .delete()
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59.999Z');
    results['publicacoes_djen_descartadas'] = r6.error ? r6.error.message : 'ok';

    // 7. publicacoes_djen_global_hash
    const r7 = await supabase
      .from('publicacoes_djen_global_hash')
      .delete()
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59.999Z');
    results['publicacoes_djen_global_hash'] = r7.error ? r7.error.message : 'ok';

    // 8. historico_monitoramento
    const r8 = await supabase
      .from('historico_monitoramento')
      .delete()
      .in('tipo', ['djen', 'djen_processos'])
      .gte('executado_em', today)
      .lt('executado_em', today + 'T23:59:59.999Z');
    results['historico_monitoramento'] = r8.error ? r8.error.message : 'ok';

    // 9. Reset offset
    const r9 = await supabase
      .from('configuracoes_monitoramento')
      .update({ metadata: { offset: 0 } })
      .in('tipo', ['djen', 'djen_processos']);
    results['reset_offset'] = r9.error ? r9.error.message : 'ok';

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Dados de hoje limpos com sucesso!',
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error('Erro:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: msg 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
