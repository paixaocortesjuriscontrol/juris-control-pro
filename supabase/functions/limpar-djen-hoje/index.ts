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
    console.log(`[limpar-djen] ${table}: deleted batch of ${ids.length} (total: ${totalDeleted})`);

    if (ids.length < batchSize) {
      hasMore = false;
    }
  }

  return { deleted: totalDeleted, error: null };
}

// Delete by date columns (data_disponibilizacao/data_publicacao) for a given range
async function deleteByDateRange(
  supabase: any,
  table: string,
  dateColumns: string[],
  startYmd: string,
  endYmd: string,
  batchSize = 500
): Promise<{ deleted: number; error: string | null }> {
  let totalDeleted = 0;

  for (const col of dateColumns) {
    // First check if column exists (some tables may not have it)
    try {
      const { data: sample, error: sampleErr } = await supabase
        .from(table)
        .select(`id, ${col}`)
        .limit(1);

      if (sampleErr) {
        console.log(`[limpar-djen] ${table}.${col} not accessible, skipping`);
        continue;
      }
    } catch {
      continue;
    }

    let hasMore = true;
    while (hasMore) {
      const { data: rows, error: selectErr } = await supabase
        .from(table)
        .select('id')
        .gte(col, startYmd)
        .lte(col, endYmd + 'T23:59:59.999Z')
        .limit(batchSize);

      if (selectErr) {
        console.warn(`[limpar-djen] ${table}.${col} select error:`, selectErr.message);
        break;
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
        console.warn(`[limpar-djen] ${table} delete error:`, delErr.message);
        break;
      }

      totalDeleted += ids.length;
      console.log(`[limpar-djen] ${table}.${col}: deleted batch of ${ids.length} (total: ${totalDeleted})`);

      if (ids.length < batchSize) {
        hasMore = false;
      }
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

    // Validate authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse body for optional date range e tipo (termos | processos | todos)
    let body: { dataInicio?: string; dataFim?: string; modo?: 'hoje' | 'intervalo'; tipo?: 'termos' | 'processos' | 'todos' } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON, use defaults
    }

    const modo = body.modo ?? 'hoje';
    const tipoLimpeza = body.tipo ?? 'todos'; // termos= só publicacoes_djen | processos= só publicacoes_djen_processos | todos
    const today = new Date().toISOString().split('T')[0];

    // Determine date range
    let startYmd: string;
    let endYmd: string;

    if (modo === 'intervalo' && body.dataInicio && body.dataFim) {
      startYmd = body.dataInicio;
      endYmd = body.dataFim;
    } else {
      // Default: today only (by created_at in BRT)
      startYmd = today;
      endYmd = today;
    }

    const dayStart = `${startYmd}T00:00:00.000Z`;
    const dayEnd = `${endYmd}T23:59:59.999Z`;
    const results: Record<string, string> = {};

    console.log(`[limpar-djen] Modo: ${modo}, Tipo: ${tipoLimpeza}, Intervalo: ${startYmd} → ${endYmd}`);

    const limparTermos = tipoLimpeza === 'termos' || tipoLimpeza === 'todos';
    const limparProcessos = tipoLimpeza === 'processos' || tipoLimpeza === 'todos';

    if (limparTermos) {
      // 1. djen_tribunais_lote (by created_at)
      console.log('[limpar-djen] Limpando djen_tribunais_lote...');
      const r1 = await deleteBatched(supabase, 'djen_tribunais_lote', 'created_at', dayStart, dayEnd, 500);
      results['djen_tribunais_lote'] = r1.error || `ok (${r1.deleted})`;

      // 2. djen_lotes (by created_at)
      console.log('[limpar-djen] Limpando djen_lotes...');
      const r2 = await deleteBatched(supabase, 'djen_lotes', 'created_at', dayStart, dayEnd, 500);
      results['djen_lotes'] = r2.error || `ok (${r2.deleted})`;

      // 3. djen_runs (by created_at)
      console.log('[limpar-djen] Limpando djen_runs...');
      const r3 = await supabase
        .from('djen_runs')
        .delete()
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);
      results['djen_runs'] = r3.error ? r3.error.message : 'ok';

      // 4. publicacoes_djen (termos)
      console.log('[limpar-djen] Limpando publicacoes_djen...');
      const r4a = await deleteBatched(supabase, 'publicacoes_djen', 'created_at', dayStart, dayEnd, 500);
      const r4b = await deleteByDateRange(supabase, 'publicacoes_djen', ['data_disponibilizacao', 'data_publicacao'], startYmd, endYmd, 500);
      const r4Total = r4a.deleted + r4b.deleted;
      results['publicacoes_djen'] = (r4a.error || r4b.error) || `ok (${r4Total})`;

      // 6. publicacoes_djen_descartadas
      console.log('[limpar-djen] Limpando publicacoes_djen_descartadas...');
      const r6a = await deleteBatched(supabase, 'publicacoes_djen_descartadas', 'created_at', dayStart, dayEnd, 500);
      const r6b = await deleteByDateRange(supabase, 'publicacoes_djen_descartadas', ['data_publicacao'], startYmd, endYmd, 500);
      const r6Total = r6a.deleted + r6b.deleted;
      results['publicacoes_djen_descartadas'] = (r6a.error || r6b.error) || `ok (${r6Total})`;

      // 7. publicacoes_djen_global_hash (apenas quando limpar termos - compartilhado)
      console.log('[limpar-djen] Limpando publicacoes_djen_global_hash...');
      const r7 = await deleteBatched(supabase, 'publicacoes_djen_global_hash', 'created_at', dayStart, dayEnd, 500);
      results['publicacoes_djen_global_hash'] = r7.error || `ok (${r7.deleted})`;
    }

    if (limparProcessos) {
      // 5. publicacoes_djen_processos (APENAS publicações por processo - não toca em termos)
      console.log('[limpar-djen] Limpando publicacoes_djen_processos...');
      const r5a = await deleteBatched(supabase, 'publicacoes_djen_processos', 'created_at', dayStart, dayEnd, 500);
      const r5b = await deleteByDateRange(supabase, 'publicacoes_djen_processos', ['data_disponibilizacao', 'data_publicacao'], startYmd, endYmd, 500);
      const r5Total = r5a.deleted + r5b.deleted;
      results['publicacoes_djen_processos'] = (r5a.error || r5b.error) || `ok (${r5Total})`;
    }

    // 8. historico_monitoramento (filter by tipo conforme tipoLimpeza)
    const tiposHistorico = tipoLimpeza === 'termos' ? ['djen'] : tipoLimpeza === 'processos' ? ['djen_processos'] : ['djen', 'djen_processos'];
    console.log('[limpar-djen] Limpando historico_monitoramento...');
    const r8 = await supabase
      .from('historico_monitoramento')
      .delete()
      .in('tipo', tiposHistorico)
      .gte('executado_em', dayStart)
      .lte('executado_em', dayEnd);
    results['historico_monitoramento'] = r8.error ? r8.error.message : 'ok';

    // 9. Cancel any running executions
    const tiposExec = tipoLimpeza === 'termos' ? ['djen'] : tipoLimpeza === 'processos' ? ['djen_processos'] : ['djen', 'djen_processos'];
    console.log('[limpar-djen] Cancelando execuções em andamento...');
    const r9 = await supabase
      .from('execucoes_agendadas')
      .update({
        status: 'cancelado',
        finalizado_em: new Date().toISOString(),
        ultimo_erro: 'Cancelado automaticamente pela limpeza do DJEN',
      })
      .in('tipo', tiposExec)
      .eq('status', 'executando')
      .is('finalizado_em', null);
    results['cancel_execucoes'] = r9.error ? r9.error.message : 'ok';

    // 10. Reset metadata (apenas para o tipo afetado)
    const tiposCfg = tipoLimpeza === 'termos' ? ['djen'] : tipoLimpeza === 'processos' ? ['djen_processos'] : ['djen', 'djen_processos'];
    console.log('[limpar-djen] Resetando metadata...');
    const { data: cfgs, error: cfgErr } = await supabase
      .from('configuracoes_monitoramento')
      .select('id, tipo, metadata')
      .in('tipo', tiposCfg)
      .is('coordenacao_id', null);

    if (cfgErr) {
      results['reset_metadata'] = cfgErr.message;
    } else {
      const errs: string[] = [];
      for (const cfg of cfgs ?? []) {
        const currentMetadata = (cfg.metadata as Record<string, any>) || {};
        const nextMetadata = {
          ...currentMetadata,
          next_offset: 0,
          current: 0,
          total: 0,
          novas: 0,
          duplicadas: 0,
          descartadas: 0,
          percentage: 0,
          has_more: false,
          cancelado: true,
          continuingRun: false,
          status: 'pronto',
        };

        const { error: upErr } = await supabase
          .from('configuracoes_monitoramento')
          .update({ metadata: nextMetadata })
          .eq('id', cfg.id);

        if (upErr) errs.push(`${cfg.tipo}: ${upErr.message}`);
      }
      results['reset_metadata'] = errs.length ? errs.join(' | ') : 'ok';
    }

    const elapsed = Date.now() - startedAt;
    console.log('[limpar-djen] Concluído', { ms: elapsed, results });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `DJEN limpo (${startYmd} → ${endYmd}) em ${Math.round(elapsed / 1000)}s!`,
      intervalo: { inicio: startYmd, fim: endYmd },
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
