// ============================================================================
// RUN MANAGEMENT MODULE for monitorar-djen
// ============================================================================

import { TribunalStats } from "./processing.ts";

export async function ensureRunExists(
  supabase: any,
  runId: string,
  total: number,
  retryCount: number
): Promise<boolean> {
  try {
    const payload = {
      run_id: runId,
      status: 'em_andamento',
      total_monitoramentos: total,
      retry_count: retryCount,
    };

    const { error } = await supabase
      .from('djen_runs')
      .upsert(payload, { onConflict: 'run_id', ignoreDuplicates: true });

    if (error) {
      if ((error as any)?.code === '23505') {
        console.log(`[DJEN] djen_runs already exists for run_id=${runId} (23505), continuing.`);
        return true;
      }
      console.error('Error creating djen_runs:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Error in ensureRunExists:', e);
    return false;
  }
}

export async function saveLoteRecord(
  supabase: any,
  runId: string,
  loteNumero: number,
  offset: number,
  processedCount: number,
  stats: {
    novas: number;
    descartadas: number;
    duplicatas: number;
    erros: number;
    paginas: number;
    resultados: number;
  },
  duration: number,
  tribunaisStats: TribunalStats[],
  total: number,
  retryCount: number,
  status: 'concluido' | 'erro' = 'concluido',
  erroMensagem?: string
): Promise<string | null> {
  try {
    const runExists = await ensureRunExists(supabase, runId, total, retryCount);
    if (!runExists) {
      console.error(`Cannot save lote: run ${runId} does not exist and could not be created`);
      return null;
    }

    const { data: lote, error } = await supabase
      .from('djen_lotes')
      .insert({
        run_id: runId,
        lote_numero: loteNumero,
        offset_inicial: offset,
        offset_final: offset + processedCount - 1,
        finalizado_em: new Date().toISOString(),
        status,
        processados: processedCount,
        novas: stats.novas,
        descartadas: stats.descartadas,
        duplicatas: stats.duplicatas,
        erros: stats.erros,
        total_paginas: stats.paginas,
        total_resultados: stats.resultados,
        duracao_segundos: duration,
        erro_mensagem: erroMensagem,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving lote:', error);
      return null;
    }

    for (const ts of tribunaisStats) {
      await supabase.from('djen_tribunais_lote').insert({
        lote_id: lote.id,
        run_id: runId,
        tribunal: ts.tribunal || 'TODOS',
        termos_buscados: 0,
        paginas: ts.paginas,
        resultados: ts.resultados,
        novas: ts.novas,
        descartadas: ts.descartadas,
        duplicatas: ts.duplicatas,
      });
    }

    return lote.id;
  } catch (e) {
    console.error('Error in saveLoteRecord:', e);
    return null;
  }
}

export async function updateExecucaoProgress(
  supabase: any,
  execucaoId: string | undefined,
  data: {
    status?: string;
    registros_processados?: number;
    registros_encontrados?: number;
    total_lotes?: number;
    detalhes?: Record<string, any>;
    finalizado_em?: string | null;
  }
): Promise<void> {
  if (!execucaoId) return;
  const { error } = await supabase
    .from('execucoes_agendadas')
    .update({ ...data })
    .eq('id', execucaoId);

  if (error) {
    console.error('Error updating execucoes_agendadas progress:', error);
  }
}

export async function createStopChecker(
  supabase: any,
  execucaoId: string | undefined
): Promise<() => Promise<{ stop: boolean; reason?: string }>> {
  return async () => {
    try {
      const { data: cfg } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();

      const meta = (cfg?.metadata as Record<string, any>) || {};
      if (meta.cancelado === true) {
        return { stop: true, reason: 'user_cancel' };
      }
      if (meta.paused_globally === true) {
        return { stop: true, reason: 'paused_globally' };
      }
    } catch {
      // ignore
    }
    return { stop: false };
  };
}
