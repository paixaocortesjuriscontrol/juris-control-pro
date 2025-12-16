import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

// Cache de termos ativos para varredura
let termosCache: Array<{ id: string; termo: string; prioridade: string }> | null = null;

async function getActiveTermos(supabase: any) {
  if (termosCache) return termosCache;
  
  const { data: termos } = await supabase
    .from('termos_monitoramento')
    .select('id, termo, prioridade')
    .eq('ativo', true);
  
  termosCache = termos || [];
  return termosCache;
}

async function scanMovementForTerms(
  supabase: any, 
  movimentacaoId: string, 
  processoId: string, 
  descricao: string
) {
  try {
    const termos = await getActiveTermos(supabase);
    if (!termos || termos.length === 0) return;

    const descricaoLower = descricao.toLowerCase();

    for (const termo of termos!) {
      const termoLower = termo.termo.toLowerCase();
      
      if (descricaoLower.includes(termoLower)) {
        // Extrair contexto (100 caracteres ao redor do termo)
        const index = descricaoLower.indexOf(termoLower);
        const start = Math.max(0, index - 50);
        const end = Math.min(descricao.length, index + termo.termo.length + 50);
        const contexto = (start > 0 ? '...' : '') + 
                        descricao.slice(start, end) + 
                        (end < descricao.length ? '...' : '');

        // Verificar se alerta já existe
        const { data: existing } = await supabase
          .from('alertas_monitoramento')
          .select('id')
          .eq('movimentacao_id', movimentacaoId)
          .eq('termo_id', termo.id)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from('alertas_monitoramento')
            .insert({
              termo_id: termo.id,
              processo_id: processoId,
              movimentacao_id: movimentacaoId,
              termo_encontrado: termo.termo,
              contexto,
              prioridade: termo.prioridade,
              status: 'pendente',
            });

          console.log(`Alert created for term "${termo.termo}" in movement ${movimentacaoId}`);

          // Enviar notificação para a coordenação
          await notifyCoordinationFor360Alert(supabase, processoId, termo.termo, termo.prioridade, contexto);
        }
      }
    }
  } catch (error) {
    console.error('Error scanning movement for terms:', error);
  }
}

async function notifyCoordinationFor360Alert(
  supabase: any,
  processoId: string,
  termo: string,
  prioridade: string,
  contexto: string
) {
  try {
    const { data: processo } = await supabase
      .from('processos')
      .select('numero, advogado_responsavel_id, coordenacao_id')
      .eq('id', processoId)
      .single();

    if (!processo) return;

    const usersToNotify: string[] = [];

    if (processo.advogado_responsavel_id) {
      usersToNotify.push(processo.advogado_responsavel_id);
    }

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

    const prioridadeEmoji = prioridade === 'urgente' ? '🚨' : prioridade === 'alta' ? '⚠️' : 'ℹ️';
    
    for (const userId of usersToNotify) {
      await supabase
        .from('notificacoes')
        .insert({
          usuario_id: userId,
          titulo: `${prioridadeEmoji} Alerta 360º: "${termo}"`,
          mensagem: `Termo "${termo}" encontrado no processo ${processo.numero}. ${contexto}`,
          tipo: prioridade === 'urgente' || prioridade === 'alta' ? 'warning' : 'info',
          link: `/monitoramento-360`,
          dados: {
            processo_id: processoId,
            numero: processo.numero,
            termo,
            prioridade,
          }
        });
    }

    console.log(`Notified ${usersToNotify.length} users about 360 alert for term "${termo}"`);
  } catch (error) {
    console.error('Error notifying coordination for 360 alert:', error);
  }
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
      .eq('tipo', 'andamentos')
      .maybeSingle();

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
    if (lastCompleteRun) {
      console.log(`Filtering movements since last complete run: ${lastCompleteRun.toISOString()}`);
    }

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

    // Process in parallel batches (5 concurrent requests to avoid resource limits)
    const PARALLEL_BATCH_SIZE = 5;

    for (let i = 0; i < (processos?.length || 0); i += PARALLEL_BATCH_SIZE) {
      const batch = processos!.slice(i, i + PARALLEL_BATCH_SIZE);
      
      const batchPromises = batch.map(async (processo) => {
        try {
          results.checked++;
          
          const apiData = await consultarProcessoAPI(processo.numero);
          if (!apiData) {
            return;
          }

          const movimentos = apiData.movimentos || [];
          if (movimentos.length === 0) return;

          // Filter movements since last complete run (or 30 days if no previous run)
          const filterDate = lastCompleteRun || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          
          const recentMovimentos = movimentos.filter((mov: any) => {
            if (!mov.dataHora) return true;
            const movDate = new Date(mov.dataHora);
            return movDate > filterDate;
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
                const { data: insertedMov, error: insertError } = await supabase
                  .from('movimentacoes')
                  .insert({
                    processo_id: processo.id,
                    descricao: descricaoCompleta,
                    data_movimentacao: movDate,
                    tipo: movName,
                    fonte: 'DataJud/CNJ'
                  })
                  .select('id')
                  .single();

                if (!insertError && insertedMov) {
                  insertedCount++;
                  existingSet.add(key);
                  newMovementDetails.push(descricaoCompleta.substring(0, 50));

                  // Varredura automática de termos no novo andamento
                  await scanMovementForTerms(supabase, insertedMov.id, processo.id, descricaoCompleta);
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

            // Get all admins and coordinators to notify
            const { data: adminUsers } = await supabase
              .from('user_roles')
              .select('user_id')
              .in('role', ['admin', 'coordenador']);
            
            adminUsers?.forEach(u => {
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
      .eq('tipo', 'andamentos');

    if (updateError) {
      console.error("Error updating config:", updateError);
    }

    // Save execution history
    await supabase
      .from('historico_monitoramento')
      .insert({
        tipo: 'andamentos',
        processos_verificados: results.checked,
        novos_andamentos: results.newMovements,
        processos_com_novos: results.processesWithNewMovements,
        erros: results.errors,
        detalhes: { details: results.details },
        executado_em: new Date().toISOString()
      });

    // Send email notification if new movements were found and run is complete
    if (results.newMovements > 0 && isComplete) {
      try {
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'coordenador']);

        if (admins && admins.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('email')
            .in('id', admins.map(a => a.user_id))
            .eq('ativo', true)
            .eq('notificacoes_email', true);

          const emails = profiles?.map(p => p.email).filter(Boolean) || [];
          
          if (emails.length > 0) {
            const processosResumo = results.details.slice(0, 10).map((d: any) => 
              `• ${d.processo}: ${d.novosAndamentos} andamento(s)`
            ).join('\n');

            await resend.emails.send({
              from: 'Juris Control <noreply@juriscontrol.adv.br>',
              to: emails,
              subject: `[Juris Control] ${results.newMovements} novo(s) andamento(s) encontrado(s)`,
              html: `
                <h2>Monitoramento de Andamentos</h2>
                <p>O monitoramento automático encontrou <strong>${results.newMovements}</strong> novo(s) andamento(s) em <strong>${results.processesWithNewMovements}</strong> processo(s).</p>
                
                <h3>Resumo:</h3>
                <ul>
                  <li>Processos verificados: ${results.checked}</li>
                  <li>Novos andamentos: ${results.newMovements}</li>
                  <li>Processos com novidades: ${results.processesWithNewMovements}</li>
                </ul>
                
                <h3>Processos atualizados:</h3>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${processosResumo}</pre>
                ${results.details.length > 10 ? `<p><em>...e mais ${results.details.length - 10} processos</em></p>` : ''}
                
                <p><a href="https://juriscontrol.adv.br/configuracoes">Ver detalhes no sistema</a></p>
              `,
            });
            console.log(`Email notification sent to ${emails.length} users with email notifications enabled`);
          }
        }
      } catch (emailError) {
        console.error("Error sending email notification:", emailError);
      }
    }

    console.log("Batch andamentos monitoring completed:", results);
    
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
