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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting redistribution monitoring...");

    // Get all active processes
    const { data: processos, error: processosError } = await supabase
      .from('processos')
      .select('id, numero, vara, advogado_responsavel_id, coordenacao_id')
      .in('status', ['ativo', 'pendente', 'urgente']);

    if (processosError) {
      console.error("Error fetching processes:", processosError);
      throw processosError;
    }

    console.log(`Found ${processos?.length || 0} active processes to monitor`);

    const results = {
      checked: 0,
      redistributions: 0,
      newMovements: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process in batches to avoid rate limiting
    const batchSize = 10;
    const delayBetweenBatches = 2000; // 2 seconds

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
                  titulo: 'Redistribuição de Processo',
                  mensagem: `O processo ${processo.numero} foi redistribuído de "${storedVara}" para "${currentVara}"`,
                  tipo: 'redistribuicao',
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

          // Check for new redistribution movements
          const movimentos = apiData.movimentos || [];
          const recentRedistributions = movimentos
            .filter((m: any) => {
              const movName = m.nome || m.movimentoNacional?.nome || '';
              return isRedistributionMovement(movName);
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
              existingMovs?.map(m => `${m.descricao}_${m.data_movimentacao}`) || []
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
      
      // Delay between batches
      if (i + batchSize < (processos?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log("Monitoring completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Monitoramento de redistribuições concluído",
        results
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
