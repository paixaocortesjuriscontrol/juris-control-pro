import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numeroLimpo } }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const hits = data.hits?.hits || [];
    
    if (hits.length === 0) return null;

    return hits[0]._source;
  } catch (error) {
    console.error(`Error querying process ${numeroProcesso}:`, error);
    return null;
  }
}

// Processa um único lote de processos
async function processBatch(supabase: any): Promise<{
  isComplete: boolean;
  results: any;
  progress: { current: number; total: number; percentage: number };
}> {
  // Reduced batch size to avoid WORKER_LIMIT errors
  const PROCESSES_PER_RUN = 50;
  
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
    details: [] as any[]
  };

  // Process in parallel batches (5 concurrent requests to avoid resource limits)
  const PARALLEL_BATCH_SIZE = 5;

  for (let i = 0; i < (processos?.length || 0); i += PARALLEL_BATCH_SIZE) {
    const batch = processos!.slice(i, i + PARALLEL_BATCH_SIZE);
    
    const batchPromises = batch.map(async (processo: any) => {
      try {
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

  // Calculate next offset and check if complete
  const nextOffset = currentOffset + (processos?.length || 0);
  const isComplete = nextOffset >= (totalCount || 0);
  
  // Update metadata and ultima_execucao
  const newMetadata = {
    next_offset: isComplete ? 0 : nextOffset,
    last_batch_size: processos?.length || 0,
    last_complete_run: isComplete ? new Date().toISOString() : (lastCompleteRun?.toISOString() || null)
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
  if (isComplete) {
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
      current: nextOffset,
      total: totalCount || 0,
      percentage: Math.round((nextOffset / (totalCount || 1)) * 100)
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for completeRun parameter
    let completeRun = false;
    try {
      const body = await req.json();
      completeRun = body?.completeRun === true;
    } catch {
      // No body or invalid JSON, proceed with single batch
    }

    console.log(`Starting redistribution monitoring... (completeRun: ${completeRun})`);

    // Single batch execution (used for both manual and complete runs)
    const { isComplete, results, progress } = await processBatch(supabase);

    // Auto-continuation: if completeRun and not complete, trigger next batch
    if (completeRun && !isComplete) {
      const functionUrl = `${supabaseUrl}/functions/v1/monitorar-redistribuicoes`;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      
      // Fire and forget - trigger next batch asynchronously
      fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ completeRun: true }),
      }).catch(err => {
        console.error('Error triggering next batch:', err);
      });

      console.log(`Batch processed, triggered next batch. Progress: ${progress.percentage}%`);
    }

    if (isComplete && completeRun) {
      console.log('Complete run finished');
    }

    return new Response(
      JSON.stringify({
        success: true,
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
