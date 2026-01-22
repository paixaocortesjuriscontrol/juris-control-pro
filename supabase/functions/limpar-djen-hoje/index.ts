import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Delete in batches to avoid timeout on large tables
async function deleteBatched(
  supabase: any,
  table: string,
  dateColumn: string,
  dayStart: string,
  dayEnd: string,
  batchSize = 1000
): Promise<{ deleted: number; error: string | null }> {
  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    // Select IDs to delete
    const { data: rows, error: selectErr } = await supabase
      .from(table)
      .select('id')
      .gte(dateColumn, dayStart)
      .lt(dateColumn, dayEnd)
      .limit(batchSize);

    if (selectErr) {
      return { deleted: totalDeleted, error: selectErr.message };
    }

    if (!rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    const ids = rows.map((r: any) => r.id);
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .in('id', ids);

    if (delErr) {
      return { deleted: totalDeleted, error: delErr.message };
    }

    totalDeleted += ids.length;
    console.log(`[limpar-djen-hoje] ${table}: deleted batch of ${ids.length} (total: ${totalDeleted})`);

    if (ids.length < batchSize) {
      hasMore = false;
    }
  }

  return { deleted: totalDeleted, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startedAt = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = `${today}T23:59:59.999Z`;
    const results: Record<string, string> = {};

    // 1. djen_tribunais_lote (high volume - use batched delete)
    console.log('[limpar-djen-hoje] Limpando djen_tribunais_lote...', { dayStart, dayEnd });
    const r1 = await deleteBatched(supabase, 'djen_tribunais_lote', 'created_at', dayStart, dayEnd, 500);
    results['djen_tribunais_lote'] = r1.error || `ok (${r1.deleted})`;

    // 2. djen_lotes (high volume - use batched delete)
    console.log('[limpar-djen-hoje] Limpando djen_lotes...');
    const r2 = await deleteBatched(supabase, 'djen_lotes', 'created_at', dayStart, dayEnd, 500);
    results['djen_lotes'] = r2.error || `ok (${r2.deleted})`;

    // 3. djen_runs (low volume - direct delete is fine)
    console.log('[limpar-djen-hoje] Limpando djen_runs...');
    const r3 = await supabase
      .from('djen_runs')
      .delete()
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd);
    results['djen_runs'] = r3.error ? r3.error.message : 'ok';

    // 4. publicacoes_djen (medium volume - batched)
    console.log('[limpar-djen-hoje] Limpando publicacoes_djen...');
    const r4 = await deleteBatched(supabase, 'publicacoes_djen', 'created_at', dayStart, dayEnd, 500);
    results['publicacoes_djen'] = r4.error || `ok (${r4.deleted})`;

    // 5. publicacoes_djen_processos
    console.log('[limpar-djen-hoje] Limpando publicacoes_djen_processos...');
    const r5 = await deleteBatched(supabase, 'publicacoes_djen_processos', 'created_at', dayStart, dayEnd, 500);
    results['publicacoes_djen_processos'] = r5.error || `ok (${r5.deleted})`;

    // 6. publicacoes_djen_descartadas
    console.log('[limpar-djen-hoje] Limpando publicacoes_djen_descartadas...');
    const r6 = await deleteBatched(supabase, 'publicacoes_djen_descartadas', 'created_at', dayStart, dayEnd, 500);
    results['publicacoes_djen_descartadas'] = r6.error || `ok (${r6.deleted})`;

    // 7. publicacoes_djen_global_hash
    console.log('[limpar-djen-hoje] Limpando publicacoes_djen_global_hash...');
    const r7 = await deleteBatched(supabase, 'publicacoes_djen_global_hash', 'created_at', dayStart, dayEnd, 500);
    results['publicacoes_djen_global_hash'] = r7.error || `ok (${r7.deleted})`;

    // 8. historico_monitoramento (filter by tipo)
    console.log('[limpar-djen-hoje] Limpando historico_monitoramento...');
    const r8 = await supabase
      .from('historico_monitoramento')
      .delete()
      .in('tipo', ['djen', 'djen_processos'])
      .gte('executado_em', dayStart)
      .lt('executado_em', dayEnd);
    results['historico_monitoramento'] = r8.error ? r8.error.message : 'ok';

    // 9. Reset metadata (offset/run) to prevent old run continuation
    console.log('[limpar-djen-hoje] Resetando metadata em configuracoes_monitoramento...');
    const r9 = await supabase
      .from('configuracoes_monitoramento')
      .update({ metadata: { next_offset: 0, has_more: false, cancelado: false, status: 'pronto' } })
      .in('tipo', ['djen', 'djen_processos']);
    results['reset_offset'] = r9.error ? r9.error.message : 'ok';

    const elapsed = Date.now() - startedAt;
    console.log('[limpar-djen-hoje] Concluído', { ms: elapsed, results });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Dados de hoje limpos com sucesso em ${Math.round(elapsed / 1000)}s!`,
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
