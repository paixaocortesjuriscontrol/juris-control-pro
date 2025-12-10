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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting andamentos monitoring...");

    const PROCESSES_PER_RUN = 50;
    
    // Get count of active processes for pagination
    const { count: totalCount } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ativo', 'pendente', 'urgente']);

    // Get current offset from config or start from 0
    const { data: configData } = await supabase
      .from('configuracoes_monitoramento')
      .select('ultima_execucao')
      .eq('tipo', 'andamentos')
      .maybeSingle();

    let currentOffset = 0;
    try {
      if (configData?.ultima_execucao) {
        const meta = JSON.parse(configData.ultima_execucao);
        if (meta.next_offset !== undefined) {
          currentOffset = meta.next_offset;
        }
      }
    } catch {
      currentOffset = 0;
    }

    // Reset offset if we've processed all
    if (currentOffset >= (totalCount || 0)) {
      currentOffset = 0;
    }

    console.log(`Processing offset ${currentOffset} to ${currentOffset + PROCESSES_PER_RUN} of ${totalCount} total processes`);

    // Get batch of active processes with pagination
    const { data: processos, error: processosError } = await supabase
      .from('processos')
      .select('id, numero, advogado_responsavel_id, coordenacao_id')
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
      newMovements: 0,
      processesWithNewMovements: 0,
      errors: 0,
      totalProcesses: totalCount || 0,
      currentOffset,
      nextOffset: currentOffset + (processos?.length || 0),
      details: [] as any[]
    };

    // Process in smaller batches to avoid rate limiting
    const batchSize = 5;
    const delayBetweenBatches = 1000;

    for (let i = 0; i < (processos?.length || 0); i += batchSize) {
      const batch = processos!.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (processo) => {
        try {
          results.checked++;
          
          const apiData = await consultarProcessoAPI(processo.numero);
          if (!apiData) {
            console.log(`No data found for process ${processo.numero}`);
            return;
          }

          const movimentos = apiData.movimentos || [];
          if (movimentos.length === 0) return;

          // Filter movements from the last 30 days only for performance
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const recentMovimentos = movimentos.filter((mov: any) => {
            if (!mov.dataHora) return true; // Include if no date
            const movDate = new Date(mov.dataHora);
            return movDate >= thirtyDaysAgo;
          });

          if (recentMovimentos.length === 0) return;

          // Get existing movements to avoid duplicates
          const { data: existingMovs } = await supabase
            .from('movimentacoes')
            .select('descricao, data_movimentacao')
            .eq('processo_id', processo.id);

          const existingSet = new Set(
            existingMovs?.map(m => `${m.data_movimentacao}|${m.descricao}`) || []
          );

          let insertedCount = 0;
          const newMovementDetails: string[] = [];

          for (const mov of recentMovimentos) {
            const movName = mov.nome || mov.movimentoNacional?.nome || 'Movimento';
            let descricaoCompleta = movName;
            
            // Add complement if available
            if (mov.complemento || mov.complementosTabelados) {
              const complementos: string[] = [];
              if (mov.complemento) complementos.push(mov.complemento);
              if (mov.complementosTabelados && Array.isArray(mov.complementosTabelados)) {
                mov.complementosTabelados.forEach((c: any) => {
                  if (c.descricao) complementos.push(c.descricao);
                  if (c.valor) complementos.push(String(c.valor));
                });
              }
              if (complementos.length > 0) {
                descricaoCompleta = `${movName} - ${complementos.join(', ')}`;
              }
            }

            const movDate = mov.dataHora 
              ? new Date(mov.dataHora).toISOString()
              : new Date().toISOString();
            
            const key = `${movDate.split('T')[0]}|${descricaoCompleta}`;

            if (!existingSet.has(key)) {
              const { error: insertError } = await supabase
                .from('movimentacoes')
                .insert({
                  processo_id: processo.id,
                  descricao: descricaoCompleta,
                  data_movimentacao: movDate,
                  tipo: movName,
                  fonte: 'DataJud/CNJ'
                });

              if (!insertError) {
                insertedCount++;
                existingSet.add(key);
                newMovementDetails.push(descricaoCompleta.substring(0, 50));
              }
            }
          }

          if (insertedCount > 0) {
            results.newMovements += insertedCount;
            results.processesWithNewMovements++;

            // Notify coordination about new movements
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
              
              membros?.forEach(m => {
                if (!usersToNotify.includes(m.usuario_id)) {
                  usersToNotify.push(m.usuario_id);
                }
              });
            }

            // Create notifications
            for (const userId of usersToNotify) {
              await supabase
                .from('notificacoes')
                .insert({
                  usuario_id: userId,
                  titulo: 'Novos Andamentos',
                  mensagem: `${insertedCount} novo(s) andamento(s) encontrado(s) no processo ${processo.numero}`,
                  tipo: 'info',
                  link: `/processos/${processo.id}`,
                  dados: {
                    processo_id: processo.id,
                    numero: processo.numero,
                    quantidade: insertedCount,
                    andamentos: newMovementDetails.slice(0, 3)
                  }
                });
            }

            results.details.push({
              processo: processo.numero,
              novosAndamentos: insertedCount,
              notificados: usersToNotify.length
            });

            console.log(`Inserted ${insertedCount} new movements for process ${processo.numero}`);
          }

        } catch (error) {
          console.error(`Error processing ${processo.numero}:`, error);
          results.errors++;
        }
      });

      await Promise.all(batchPromises);
      
      // Delay between batches
      if (i + batchSize < (processos?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Update config with next offset for pagination
    const nextOffset = currentOffset + (processos?.length || 0);
    await supabase
      .from('configuracoes_monitoramento')
      .update({ 
        ultima_execucao: JSON.stringify({
          timestamp: new Date().toISOString(),
          next_offset: nextOffset >= (totalCount || 0) ? 0 : nextOffset,
          last_batch_size: processos?.length || 0
        })
      })
      .eq('tipo', 'andamentos');

    console.log("Batch andamentos monitoring completed:", results);

    const isComplete = nextOffset >= (totalCount || 0);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: isComplete 
          ? "Monitoramento de andamentos completo" 
          : `Lote processado: ${currentOffset + 1} a ${nextOffset} de ${totalCount}`,
        results,
        isComplete,
        progress: {
          current: nextOffset,
          total: totalCount,
          percentage: Math.round((nextOffset / (totalCount || 1)) * 100)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in andamentos monitoring function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
