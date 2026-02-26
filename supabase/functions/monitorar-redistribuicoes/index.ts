import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATAJUD_TIMEOUT_MS = 12_000; // 12s per request to stay within edge function limits

class CancelledError extends Error {
  constructor(message = 'cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

function createCancelChecker(
  supabase: any,
  tipo: string,
  execucaoId?: string,
  throttleMs = 1500
) {
  let lastCheck = 0;
  let cachedCancelled = false;
  let cachedMeta: Record<string, any> = {};

  return {
    async isCancelled() {
      if (cachedCancelled) return true;
      const now = Date.now();
      if (now - lastCheck < throttleMs) return false;
      lastCheck = now;

       // Cancelamento forçado via tracking: se a execução foi marcada como cancelada,
       // paramos mesmo que o metadata ainda não tenha sido lido/gravado.
       if (execucaoId) {
         const { data: exec } = await supabase
           .from('execucoes_agendadas')
           .select('status')
           .eq('id', execucaoId)
           .maybeSingle();

         if (exec?.status === 'cancelado') {
           cachedCancelled = true;
           return true;
         }
       }

      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      cachedMeta = (data?.metadata as any) || {};
      cachedCancelled = cachedMeta?.cancelado === true;
      return cachedCancelled;
    },
    getCachedMeta() {
      return cachedMeta;
    },
  };
}

async function markCancelled(supabase: any, tipo: string, extra: Record<string, any> = {}) {
  const { data } = await supabase
    .from('configuracoes_monitoramento')
    .select('id, metadata')
    .eq('tipo', tipo)
    .is('coordenacao_id', null)
    .maybeSingle();

  const meta = ((data?.metadata as any) || {}) as Record<string, any>;
  await supabase
    .from('configuracoes_monitoramento')
    .update({
      metadata: {
        ...meta,
        cancelado: false,
        status: 'cancelado',
        continuingRun: false,
        cancelled_at: new Date().toISOString(),
        ...extra,
      },
    })
    .eq('tipo', tipo)
    .is('coordenacao_id', null);
}

async function markExecucaoCancelled(supabase: any, execucaoId?: string, details: Record<string, any> = {}) {
  if (!execucaoId) return;
  await supabase
    .from('execucoes_agendadas')
    .update({
      status: 'cancelado',
      finalizado_em: new Date().toISOString(),
      detalhes: { cancelled: true, ...details },
    })
    .eq('id', execucaoId);
}

// API Key pública do DataJud/CNJ
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Mapa de tribunais baseado na numeração única
const tribunais: Record<string, Record<string, { endpoint: string; nome: string }>> = {
  "3": { "0": { endpoint: "api_publica_stj", nome: "STJ" } },
  "4": {
    "1": { endpoint: "api_publica_trf1", nome: "TRF1" },
    "2": { endpoint: "api_publica_trf2", nome: "TRF2" },
    "3": { endpoint: "api_publica_trf3", nome: "TRF3" },
    "4": { endpoint: "api_publica_trf4", nome: "TRF4" },
    "5": { endpoint: "api_publica_trf5", nome: "TRF5" },
    "6": { endpoint: "api_publica_trf6", nome: "TRF6" }
  },
  "5": {
    "0": { endpoint: "api_publica_tst", nome: "TST" },
    "1": { endpoint: "api_publica_trt1", nome: "TRT1" },
    "2": { endpoint: "api_publica_trt2", nome: "TRT2" },
    "3": { endpoint: "api_publica_trt3", nome: "TRT3" },
    "4": { endpoint: "api_publica_trt4", nome: "TRT4" },
    "5": { endpoint: "api_publica_trt5", nome: "TRT5" },
    "6": { endpoint: "api_publica_trt6", nome: "TRT6" },
    "7": { endpoint: "api_publica_trt7", nome: "TRT7" },
    "8": { endpoint: "api_publica_trt8", nome: "TRT8" },
    "9": { endpoint: "api_publica_trt9", nome: "TRT9" },
    "10": { endpoint: "api_publica_trt10", nome: "TRT10" },
    "11": { endpoint: "api_publica_trt11", nome: "TRT11" },
    "12": { endpoint: "api_publica_trt12", nome: "TRT12" },
    "13": { endpoint: "api_publica_trt13", nome: "TRT13" },
    "14": { endpoint: "api_publica_trt14", nome: "TRT14" },
    "15": { endpoint: "api_publica_trt15", nome: "TRT15" },
    "16": { endpoint: "api_publica_trt16", nome: "TRT16" },
    "17": { endpoint: "api_publica_trt17", nome: "TRT17" },
    "18": { endpoint: "api_publica_trt18", nome: "TRT18" },
    "19": { endpoint: "api_publica_trt19", nome: "TRT19" },
    "20": { endpoint: "api_publica_trt20", nome: "TRT20" },
    "21": { endpoint: "api_publica_trt21", nome: "TRT21" },
    "22": { endpoint: "api_publica_trt22", nome: "TRT22" },
    "23": { endpoint: "api_publica_trt23", nome: "TRT23" },
    "24": { endpoint: "api_publica_trt24", nome: "TRT24" }
  },
  "6": { "0": { endpoint: "api_publica_tse", nome: "TSE" } },
  "7": { "0": { endpoint: "api_publica_stm", nome: "STM" } },
  "8": {
    "1": { endpoint: "api_publica_tjac", nome: "TJAC" },
    "2": { endpoint: "api_publica_tjal", nome: "TJAL" },
    "3": { endpoint: "api_publica_tjap", nome: "TJAP" },
    "4": { endpoint: "api_publica_tjam", nome: "TJAM" },
    "5": { endpoint: "api_publica_tjba", nome: "TJBA" },
    "6": { endpoint: "api_publica_tjce", nome: "TJCE" },
    "7": { endpoint: "api_publica_tjdft", nome: "TJDFT" },
    "8": { endpoint: "api_publica_tjes", nome: "TJES" },
    "9": { endpoint: "api_publica_tjgo", nome: "TJGO" },
    "10": { endpoint: "api_publica_tjma", nome: "TJMA" },
    "11": { endpoint: "api_publica_tjmt", nome: "TJMT" },
    "12": { endpoint: "api_publica_tjms", nome: "TJMS" },
    "13": { endpoint: "api_publica_tjmg", nome: "TJMG" },
    "14": { endpoint: "api_publica_tjpa", nome: "TJPA" },
    "15": { endpoint: "api_publica_tjpb", nome: "TJPB" },
    "16": { endpoint: "api_publica_tjpr", nome: "TJPR" },
    "17": { endpoint: "api_publica_tjpe", nome: "TJPE" },
    "18": { endpoint: "api_publica_tjpi", nome: "TJPI" },
    "19": { endpoint: "api_publica_tjrj", nome: "TJRJ" },
    "20": { endpoint: "api_publica_tjrn", nome: "TJRN" },
    "21": { endpoint: "api_publica_tjrs", nome: "TJRS" },
    "22": { endpoint: "api_publica_tjro", nome: "TJRO" },
    "23": { endpoint: "api_publica_tjrr", nome: "TJRR" },
    "24": { endpoint: "api_publica_tjsc", nome: "TJSC" },
    "25": { endpoint: "api_publica_tjse", nome: "TJSE" },
    "26": { endpoint: "api_publica_tjsp", nome: "TJSP" },
    "27": { endpoint: "api_publica_tjto", nome: "TJTO" }
  }
};

function limparNumeroProcesso(numero: string): string {
  return numero.replace(/\D/g, '').padStart(20, '0');
}

function extrairInfoTribunal(numeroLimpo: string): { j: string; tr: string } | null {
  if (numeroLimpo.length !== 20) return null;
  const j = numeroLimpo.charAt(13);
  const tr = numeroLimpo.substring(14, 16).replace(/^0+/, '') || "0";
  return { j, tr };
}

function getTribunalInfo(numeroProcesso: string): { endpoint: string; nome: string } | null {
  const numeroLimpo = limparNumeroProcesso(numeroProcesso);
  const info = extrairInfoTribunal(numeroLimpo);
  if (!info) return null;
  const jurisdicao = tribunais[info.j];
  if (!jurisdicao) return null;
  return jurisdicao[info.tr] || null;
}

// Keywords that indicate redistribution
const REDISTRIBUTION_KEYWORDS = [
  'redistribu',
  'distribuído',
  'distribuido',
  'distribuição',
  'distribuicao',
  'remessa',
  'remetido',
  'encaminhado',
  'declin',
  'competência',
  'competencia'
];

function isRedistributionMovement(movimentoNome: string): boolean {
  const lowerName = movimentoNome.toLowerCase();
  return REDISTRIBUTION_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

async function consultarProcessoAPI(numeroProcesso: string): Promise<any> {
  const tribunalInfo = getTribunalInfo(numeroProcesso);
  if (!tribunalInfo) return null;

  const numeroLimpo = limparNumeroProcesso(numeroProcesso);
  const url = `https://api-publica.datajud.cnj.jus.br/${tribunalInfo.endpoint}/_search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numeroLimpo } }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const hits = data.hits?.hits || [];
    
    if (hits.length === 0) return null;

    return hits[0]._source;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // AbortError é esperado em timeout
    if (!msg.toLowerCase().includes('aborted')) {
      console.error(`Error querying process ${numeroProcesso}:`, error);
    }
    return null;
  }
}

// Processa um único lote de processos
async function processBatch(supabase: any, execucaoId?: string): Promise<{
  isComplete: boolean;
  results: any;
  progress: { current: number; total: number; percentage: number };
}> {
  // Reduced batch to fit within Edge Function ~60s wall-clock limit
  const PROCESSES_PER_RUN = 40;
  
  // Get count of active processes for pagination
  const { count: totalCount } = await supabase
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .in('status', ['ativo', 'pendente', 'urgente']);

  // Get current config with metadata
  const { data: configData } = await supabase
    .from('configuracoes_monitoramento')
    .select('metadata')
    .eq('tipo', 'redistribuicoes')
    .single();

  let currentOffset = 0;
  let lastCompleteRun: Date | null = null;
  const metadata = configData?.metadata || {};
  
  if (metadata.next_offset !== undefined) {
    currentOffset = metadata.next_offset;
  }
  if (metadata.last_complete_run) {
    lastCompleteRun = new Date(metadata.last_complete_run);
  }

  // Reset offset if we've processed all
  if (currentOffset >= (totalCount || 0)) {
    currentOffset = 0;
  }

  console.log(`Processing offset ${currentOffset} to ${currentOffset + PROCESSES_PER_RUN} of ${totalCount} total processes`);

  // Get batch of active processes with pagination
  const { data: processos, error: processosError } = await supabase
    .from('processos')
    .select('id, numero, vara, advogado_responsavel_id, coordenacao_id')
    .in('status', ['ativo', 'pendente', 'urgente'])
    .order('id')
    .range(currentOffset, currentOffset + PROCESSES_PER_RUN - 1);

  if (processosError) {
    console.error("Error fetching processes:", processosError);
    throw processosError;
  }

  console.log(`Found ${processos?.length || 0} processes to check in this batch`);

  const results = {
    checked: 0,
    redistributions: 0,
    newMovements: 0,
    errors: 0,
    totalProcesses: totalCount || 0,
    currentOffset,
    nextOffset: currentOffset + (processos?.length || 0),
    details: [] as any[],
    cancelled: false,
  };

  const cancel = createCancelChecker(supabase, 'redistribuicoes', execucaoId);

  // Process in parallel batches (8 concurrent to avoid overwhelming DataJud + stay in time)
  const PARALLEL_BATCH_SIZE = 8;

  try {
    for (let i = 0; i < (processos?.length || 0); i += PARALLEL_BATCH_SIZE) {
      if (await cancel.isCancelled()) throw new CancelledError();

      const batch = processos!.slice(i, i + PARALLEL_BATCH_SIZE);
    
      const batchPromises = batch.map(async (processo: any) => {
        try {
          if (await cancel.isCancelled()) return;
          results.checked++;
        
          const apiData = await consultarProcessoAPI(processo.numero);
          if (!apiData) {
            return;
          }

        const currentVara = apiData.orgaoJulgador?.nome || null;
        const storedVara = processo.vara;

        // Check if vara changed (redistribution)
        if (currentVara && storedVara && currentVara !== storedVara) {
          console.log(`Redistribution detected for ${processo.numero}: ${storedVara} -> ${currentVara}`);
          results.redistributions++;

          // Update process with new vara
          await supabase
            .from('processos')
            .update({ vara: currentVara })
            .eq('id', processo.id);

          // Insert redistribution movement
          await supabase
            .from('movimentacoes')
            .insert({
              processo_id: processo.id,
              descricao: `Redistribuição detectada: de "${storedVara}" para "${currentVara}"`,
              tipo: 'Redistribuição',
              fonte: 'Monitoramento Automático'
            });

          // Get users to notify
          const usersToNotify: string[] = [];
          
          if (processo.advogado_responsavel_id) {
            usersToNotify.push(processo.advogado_responsavel_id);
          }

          // Get coordination members
          if (processo.coordenacao_id) {
            const { data: membros } = await supabase
              .from('membros_coordenacao')
              .select('usuario_id')
              .eq('coordenacao_id', processo.coordenacao_id);
            
            membros?.forEach((m: any) => {
              if (!usersToNotify.includes(m.usuario_id)) {
                usersToNotify.push(m.usuario_id);
              }
            });
          }

          // Get all admins and coordinators to notify
          const { data: adminUsers } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'coordenador']);
          
          adminUsers?.forEach((u: any) => {
            if (!usersToNotify.includes(u.user_id)) {
              usersToNotify.push(u.user_id);
            }
          });

          // Create notifications
          for (const userId of usersToNotify) {
            await supabase
              .from('notificacoes')
              .insert({
                usuario_id: userId,
                titulo: 'Redistribuição de Processo',
                mensagem: `O processo ${processo.numero} foi redistribuído de "${storedVara}" para "${currentVara}"`,
                tipo: 'warning',
                link: `/processos/${processo.id}`,
                dados: {
                  processo_id: processo.id,
                  numero: processo.numero,
                  vara_anterior: storedVara,
                  vara_atual: currentVara
                }
              });
          }

          // NOTA: O envio de alertas externos agora é consolidado em um resumo único ao finalizar
          // a execução completa do monitoramento (ver enviar-resumo-monitoramento)
          // Isso evita bombardeio de mensagens individuais para cada redistribuição

          results.details.push({
            processo: processo.numero,
            varaAnterior: storedVara,
            varaAtual: currentVara,
            notificados: usersToNotify.length
          });
        }

        // Check for new redistribution movements - filter by last execution
        const movimentos = apiData.movimentos || [];
        const recentRedistributions = movimentos
          .filter((m: any) => {
            const movName = m.nome || m.movimentoNacional?.nome || '';
            if (!isRedistributionMovement(movName)) return false;
            
            // Filter by last complete run timestamp if available
            if (lastCompleteRun && m.dataHora) {
              const movDate = new Date(m.dataHora);
              return movDate > lastCompleteRun;
            }
            return true;
          })
          .slice(0, 5);

        if (recentRedistributions.length > 0) {
          // Get existing movements to avoid duplicates
          const { data: existingMovs } = await supabase
            .from('movimentacoes')
            .select('descricao, data_movimentacao')
            .eq('processo_id', processo.id)
            .eq('fonte', 'DataJud/CNJ');

          const existingSet = new Set(
            existingMovs?.map((m: any) => `${m.descricao}_${m.data_movimentacao}`) || []
          );

          for (const mov of recentRedistributions) {
            const movName = mov.nome || mov.movimentoNacional?.nome || 'Movimento';
            const movDate = mov.dataHora ? new Date(mov.dataHora).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const key = `${movName}_${movDate}`;

            if (!existingSet.has(key)) {
              await supabase
                .from('movimentacoes')
                .insert({
                  processo_id: processo.id,
                  descricao: movName,
                  data_movimentacao: movDate,
                  tipo: 'Distribuição/Redistribuição',
                  fonte: 'DataJud/CNJ'
                });
              results.newMovements++;
            }
          }
        }

        } catch (error) {
          console.error(`Error processing ${processo.numero}:`, error);
          results.errors++;
        }
      });

      await Promise.all(batchPromises);
    }
  } catch (err) {
    if (err instanceof CancelledError) {
      results.cancelled = true;
      await markCancelled(supabase, 'redistribuicoes', { next_offset: currentOffset });
    } else {
      throw err;
    }
  }

  // Calculate next offset and check if complete
  const nextOffset = currentOffset + (processos?.length || 0);
  const isComplete = results.cancelled ? true : nextOffset >= (totalCount || 0);
  
  // Update metadata and ultima_execucao
  // IMPORTANTE: preservar flags existentes (ex.: metadata.cancelado) para o cancelamento funcionar de forma confiável.
  const newMetadata = {
    ...(metadata as any),
    next_offset: results.cancelled ? currentOffset : (isComplete ? 0 : nextOffset),
    last_batch_size: processos?.length || 0,
    last_complete_run: isComplete ? new Date().toISOString() : (lastCompleteRun?.toISOString() || null),
    total: totalCount || 0,
    status: results.cancelled ? 'cancelado' : (isComplete ? 'concluido' : 'em_andamento'),
    continuingRun: results.cancelled ? false : !isComplete,
  };
  
  const { error: updateError } = await supabase
    .from('configuracoes_monitoramento')
    .update({ 
      ultima_execucao: new Date().toISOString(),
      metadata: newMetadata
    })
    .eq('tipo', 'redistribuicoes');

  if (updateError) {
    console.error("Error updating config:", updateError);
  }

  // Save to history if complete
  if (isComplete && !results.cancelled) {
    await supabase
      .from('historico_monitoramento')
      .insert({
        tipo: 'redistribuicoes',
        processos_verificados: totalCount || 0,
        novos_andamentos: results.newMovements,
        processos_com_novos: results.redistributions,
        erros: results.errors,
        detalhes: { results }
      });
  }

  console.log("Batch monitoring completed:", results);

  return {
    isComplete,
    results,
    progress: {
      current: results.cancelled ? currentOffset : nextOffset,
      total: totalCount || 0,
      percentage: Math.round(((results.cancelled ? currentOffset : nextOffset) / (totalCount || 1)) * 100)
    }
  };
}

// Helper para atualizar execucoes_agendadas com progresso
async function updateExecucaoProgress(
  supabase: any,
  execucaoId: string | undefined,
  data: {
    status?: string;
    registros_processados?: number;
    registros_encontrados?: number;
    total_lotes?: number;
    detalhes?: Record<string, any>;
    finalizado_em?: string;
  }
) {
  if (!execucaoId) return;
  // NOTE: execucoes_agendadas não possui coluna updated_at.
  // Se enviarmos updated_at aqui, o update falha silenciosamente e o progresso nunca aparece no frontend.
  const { error } = await supabase
    .from('execucoes_agendadas')
    .update({
      ...data,
    })
    .eq('id', execucaoId);

  if (error) {
    console.error('Error updating execucoes_agendadas progress:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({} as any));
    const completeRun = body?.completeRun === true;
    const execucaoId = body?.execucaoId as string | undefined;
    // Auto-continuation: o worker sempre faz auto-continuation quando completeRun === true.
    // O orquestrador (executar-monitoramento) agora só dispara e retorna rápido, não faz loop.
    // Portanto, ignoramos managedByWrapper para garantir que o worker termine sozinho.
    const managedByWrapper = false;

    // Early cancellation check: if user requested cancel, stop immediately (don’t process another batch)
    if (completeRun) {
      const { data: freshConfig } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, metadata')
        .eq('tipo', 'redistribuicoes')
        .is('coordenacao_id', null)
        .maybeSingle();

      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;

      if (wasCancelled && freshConfig?.id) {
        console.log('Cancellation flag detected at start, skipping batch');
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...(freshConfig.metadata as any),
              cancelado: false,
              status: 'cancelado',
              continuingRun: false,
            },
          })
          .eq('id', freshConfig.id);

        await markExecucaoCancelled(supabase, execucaoId, { tipo: 'redistribuicoes', phase: 'early' });

        return new Response(
          JSON.stringify({
            success: true,
            cancelled: true,
            isComplete: true,
            continuingRun: false,
            message: 'Execução cancelada (antes de iniciar o próximo lote)',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Starting redistribution monitoring... (completeRun: ${completeRun})`);

    // Single batch execution (used for both manual and complete runs)
    const { isComplete, results, progress } = await processBatch(supabase, execucaoId);

    // Atualizar progresso em tempo real na tabela execucoes_agendadas
    await updateExecucaoProgress(supabase, execucaoId, {
      status: results?.cancelled ? 'cancelado' : (isComplete ? 'concluido' : 'executando'),
      registros_processados: progress.current,
      registros_encontrados: results?.redistributions || 0,
      total_lotes: progress.total,
      detalhes: {
        progress: {
          current: progress.current,
          total: progress.total,
          percentage: progress.percentage,
        },
        newMovements: results?.newMovements || 0,
        errors: results?.errors || 0,
      },
      ...(isComplete || results?.cancelled ? { finalizado_em: new Date().toISOString() } : {}),
    });

    if (results?.cancelled) {
      await markExecucaoCancelled(supabase, execucaoId, { tipo: 'redistribuicoes', phase: 'mid-batch' });
    }

    // Auto-continuation: if completeRun and not complete, trigger next batch
    // But first check if cancellation was requested (configuracoes_monitoramento.metadata.cancelado)
    if (!managedByWrapper && completeRun && !isComplete) {
      const { data: freshConfig } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'redistribuicoes')
        .is('coordenacao_id', null)
        .maybeSingle();

      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;

      if (wasCancelled) {
        console.log('Execution cancelled by user, stopping auto-continuation');
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...(freshConfig?.metadata as any),
              cancelado: false,
              status: 'cancelado',
              continuingRun: false,
            },
          })
          .eq('tipo', 'redistribuicoes')
          .is('coordenacao_id', null);
      } else {
        const functionUrl = `${supabaseUrl}/functions/v1/monitorar-redistribuicoes`;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        // Fire and forget - trigger next batch asynchronously
         fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
           body: JSON.stringify({ completeRun: true, execucaoId }),
        }).catch(err => {
          console.error('Error triggering next batch:', err);
        });

        console.log(`Batch processed, triggered next batch. Progress: ${progress.percentage}%`);
      }
    }

    // ========== ENVIO DE RESUMO CONSOLIDADO ==========
    if (isComplete && completeRun && !results?.cancelled) {
      console.log('Complete run finished - Preparing summary dispatch');
      
      try {
        // Buscar redistribuições detectadas hoje
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const hojeISO = hoje.toISOString();
        
        const { data: redistribuicoesHoje, error: redistError } = await supabase
          .from('movimentacoes')
          .select(`
            id,
            processo_id,
            descricao,
            data_movimentacao,
            created_at,
            processos!inner (
              id,
              numero,
              coordenacao_id,
              coordenacoes (
                id,
                nome
              )
            )
          `)
          .eq('tipo', 'Redistribuição')
          .gte('created_at', hojeISO)
          .order('created_at', { ascending: false });

        if (redistError) {
          console.error('[RESUMO] Erro ao buscar redistribuições:', redistError);
        } else if (redistribuicoesHoje && redistribuicoesHoje.length > 0) {
          console.log(`[RESUMO] Total de redistribuições hoje: ${redistribuicoesHoje.length}`);
          
          // Agrupar por coordenação
          const porCoordenacao = new Map<string, {
            coordenacao_id: string;
            coordenacao_nome: string;
            redistribuicoes: Array<{
              processo_numero: string;
              descricao: string;
            }>;
          }>();
          
          for (const mov of redistribuicoesHoje) {
            const processo = (mov as any).processos;
            if (!processo?.coordenacao_id) continue;
            
            const coordId = processo.coordenacao_id;
            const coordNome = processo.coordenacoes?.nome || 'Sem nome';
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_id: coordId,
                coordenacao_nome: coordNome,
                redistribuicoes: []
              });
            }
            
            // Parse da descrição para extrair varas
            const match = mov.descricao?.match(/Redistribuição detectada: (.+) -> (.+)/);
            const descricaoFormatada = match 
              ? `${match[1]} → ${match[2]}`
              : mov.descricao || 'Redistribuição detectada';
            
            porCoordenacao.get(coordId)!.redistribuicoes.push({
              processo_numero: processo.numero || 'N/A',
              descricao: descricaoFormatada
            });
          }
          
          if (porCoordenacao.size > 0) {
            // Montar payload para enviar resumo
            const resumosPorCoordenacao = Array.from(porCoordenacao.values()).map(coord => ({
              coordenacao_id: coord.coordenacao_id,
              coordenacao_nome: coord.coordenacao_nome,
              total_verificados: results?.totalProcesses || 0,
              total_encontrados: coord.redistribuicoes.length,
              exemplos: coord.redistribuicoes.map(r => ({
                processo_numero: r.processo_numero,
                descricao: r.descricao
              }))
            }));
            
            console.log(`[RESUMO] Enviando resumo para ${resumosPorCoordenacao.length} coordenações`);
            
            // Chamar edge function de envio de resumo
            const resumoResponse = await fetch(`${supabaseUrl}/functions/v1/enviar-resumo-monitoramento`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                tipo_monitoramento: 'redistribuicoes',
                resumos_por_coordenacao: resumosPorCoordenacao
              })
            });
            
            if (resumoResponse.ok) {
              const resumoResult = await resumoResponse.json();
              console.log(`[RESUMO] Resumos enviados com sucesso:`, resumoResult);
            } else {
              const errorText = await resumoResponse.text();
              console.error(`[RESUMO] Erro ao enviar resumos:`, errorText);
            }
          } else {
            console.log('[RESUMO] Nenhuma coordenação com redistribuições para notificar');
          }
        } else {
          console.log('[RESUMO] Nenhuma redistribuição encontrada hoje');
        }
      } catch (resumoError) {
        console.error('[RESUMO] Erro ao processar envio de resumo:', resumoError);
      }
    }
    // ========== FIM DO ENVIO DE RESUMO ==========

    return new Response(
      JSON.stringify({
        success: true,
        cancelled: results?.cancelled === true,
        message: isComplete 
          ? "Monitoramento completo de todos os processos" 
          : `Lote processado: ${results.currentOffset + 1} a ${results.nextOffset} de ${results.totalProcesses}`,
        results,
        isComplete,
        progress,
        continuingRun: completeRun && !isComplete,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in monitoring function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
