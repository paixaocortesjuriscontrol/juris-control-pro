import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de tipos para funções
// NOTA: 'djen' foi removido - agora usa busca direta no frontend (useBuscaDjenDireta)
const FUNCOES_MAP: Record<string, string> = {
  redistribuicoes: 'monitorar-redistribuicoes',
  andamentos: 'monitorar-andamentos',
  distribuicoes: 'monitorar-distribuicoes',
  djen_processos: 'monitorar-djen-processos',
  termos: 'monitorar-termos',
};

const MAX_RETRIES = 3;
// Timeout por chamada ao worker. Importante manter bem abaixo do limite de runtime da Edge Function
// para evitar ficar com execução “executando” travada no banco em caso de request pendurado.
const WORKER_CALL_TIMEOUT_MS = 180 * 1000; // 180s - evita abort prematuro em tarefas pesadas

// Se uma execução estiver marcada como "executando" mas não houver batimento (ultima_execucao)
// há algum tempo, consideramos que travou e liberamos para nova execução.
const STALE_HEARTBEAT_MS = 5 * 60 * 1000; // 5min

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { tipo, scheduled = false, jobName } = body;

    if (!tipo || !FUNCOES_MAP[tipo]) {
      return new Response(
        JSON.stringify({ error: 'Tipo de monitoramento inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const funcao = FUNCOES_MAP[tipo];

    // Se o monitoramento estiver desativado/pausado, não iniciar (especialmente por cron)
    // Isso evita o efeito "cancela e recomeça sozinho".
    const { data: cfgAtivo, error: cfgAtivoErr } = await supabase
      .from('configuracoes_monitoramento')
      .select('ativo, metadata, ultima_execucao')
      .eq('tipo', tipo)
      .is('coordenacao_id', null)
      .maybeSingle();

    if (cfgAtivoErr) {
      console.error(`[${tipo}] Erro ao ler configuracao de monitoramento:`, cfgAtivoErr);
    }

    const metaCfg = (cfgAtivo?.metadata as any) || {};
    const isPaused = cfgAtivo?.ativo === false || metaCfg?.paused_globally === true;

    if (isPaused) {
      return new Response(
        JSON.stringify({
          success: false,
          blocked: true,
          message: 'Monitoramento está pausado/desativado. Reative em Configurações para executar novamente.',
          paused: true,
          scheduled,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já existe uma execução em andamento para QUALQUER tipo (evitar WORKER_LIMIT)
    // IMPORTANTE: só considera "em andamento" se status=executando E finalizado_em IS NULL
    // Isso evita bloquear por execuções fantasmas que têm status errado
    const { data: todasExecucoesEmAndamento } = await supabase
      .from('execucoes_agendadas')
      .select('id, tipo, iniciado_em, finalizado_em')
      .eq('status', 'executando')
      .is('finalizado_em', null)
      .order('created_at', { ascending: false });

    // Se a configuração ficou com status "cancelado" por uma execução anterior (sem jobs rodando),
    // limpamos o estado para permitir novas execuções.
    // Caso exista job ativo do mesmo tipo, não limpamos (a intenção pode ser cancelar).
    const hasRunningThisTipo = (todasExecucoesEmAndamento || []).some((e: any) => e.tipo === tipo);
    const staleCancelledState = metaCfg?.cancelado === true || metaCfg?.status === 'cancelado' || metaCfg?.status === 'cancelando';
    if (!hasRunningThisTipo && staleCancelledState) {
      console.log(`[${tipo}] Limpando estado cancelado residual antes de iniciar nova execução`);
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...(metaCfg || {}),
            cancelado: false,
            status: 'idle',
            continuingRun: false,
            cancelled_at: null,
          },
        })
        .eq('tipo', tipo)
        .is('coordenacao_id', null);
    }

    // Tipos pesados que consomem muitos workers
    const tiposPesados = ['andamentos', 'redistribuicoes', 'djen_processos', 'termos'];

    if (todasExecucoesEmAndamento && todasExecucoesEmAndamento.length > 0) {
      const agora = new Date();
      const lastHeartbeatAt = cfgAtivo?.ultima_execucao ? new Date(cfgAtivo.ultima_execucao) : null;
      const heartbeatStale =
        !!lastHeartbeatAt && (agora.getTime() - lastHeartbeatAt.getTime()) > STALE_HEARTBEAT_MS;
      
      for (const execucao of todasExecucoesEmAndamento) {
        const iniciado = new Date(execucao.iniciado_em);
        const minutosDecorridos = (agora.getTime() - iniciado.getTime()) / 60000;

        // Se está executando há mais de 60 minutos, marcar como timeout
        if (minutosDecorridos > 60) {
          await supabase
            .from('execucoes_agendadas')
            .update({ 
              status: 'timeout', 
              finalizado_em: agora.toISOString(),
              ultimo_erro: `Timeout após ${Math.round(minutosDecorridos)} minutos`
            })
            .eq('id', execucao.id);
          continue;
        }

        // Se é do mesmo tipo, bloquear
        if (execucao.tipo === tipo) {
          // Se aparenta travado (sem atualizar ultima_execucao há um tempo), liberar.
          // Isso evita ficar “preso” num estado executando quando a Edge Function foi interrompida.
          if (heartbeatStale) {
            console.warn(
              `[${tipo}] Execução ${execucao.id} parece travada (sem heartbeat há ${Math.round(
                (agora.getTime() - (lastHeartbeatAt?.getTime() || agora.getTime())) / 60000,
              )}min). Marcando como timeout para liberar nova execução.`,
            );

            await supabase
              .from('execucoes_agendadas')
              .update({
                status: 'timeout',
                finalizado_em: agora.toISOString(),
                ultimo_erro: 'Execução travada (sem progresso/heartbeat).',
              })
              .eq('id', execucao.id);

            await supabase
              .from('configuracoes_monitoramento')
              .update({
                metadata: {
                  ...(metaCfg || {}),
                  status: 'idle',
                  continuingRun: true,
                  last_stop_reason: 'stale',
                  last_stop_at: agora.toISOString(),
                  last_error: 'Execução travada (sem progresso/heartbeat).',
                },
              })
              .eq('tipo', tipo)
              .is('coordenacao_id', null);

            continue;
          }

          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Execução de ${tipo} em andamento há ${Math.round(minutosDecorridos)} minutos`,
              execucaoId: execucao.id,
              blocked: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se outro tipo pesado está rodando, bloquear para evitar WORKER_LIMIT
        if (tiposPesados.includes(tipo) && tiposPesados.includes(execucao.tipo)) {
          const nomesLegivel: Record<string, string> = {
            andamentos: 'Andamentos',
            redistribuicoes: 'Redistribuições',
            distribuicoes: 'Distribuições',
            djen_processos: 'DJEN Processos',
            djen: 'DJEN Publicações',
            termos: 'Monitoração 360',
          };
          
          console.log(`[${tipo}] Bloqueado: ${execucao.tipo} está em execução há ${Math.round(minutosDecorridos)}min`);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Aguardando ${nomesLegivel[execucao.tipo] || execucao.tipo} finalizar (${Math.round(minutosDecorridos)}min). Execuções pesadas são sequenciais para evitar erro WORKER_LIMIT.`,
              execucaoId: execucao.id,
              blocked: true,
              blockedBy: execucao.tipo,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Criar registro de execução
    const { data: novaExecucao, error: insertError } = await supabase
      .from('execucoes_agendadas')
      .insert({
        tipo,
        job_name: jobName || (scheduled ? `cron-${funcao}` : `manual-${funcao}`),
        status: 'executando',
        agendado_para: scheduled ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar registro de execução:', insertError);
    }

    const execucaoId = novaExecucao?.id;
    console.log(`[${tipo}] Iniciando execução ${execucaoId}`);

    // Para tipos pesados, disparamos o worker e retornamos rapidamente.
    // O próprio worker faz auto-continuação e atualiza execucoes_agendadas/configuracoes_monitoramento.
    if (tiposPesados.includes(tipo)) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WORKER_CALL_TIMEOUT_MS);
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${funcao}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            completeRun: true,
            scheduled,
            execucaoId,
            continued: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        }

        // Mesmo que o worker retorne um payload, o progresso real é acompanhado na tabela.
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          // ignore
        }

        return new Response(
          JSON.stringify({
            success: true,
            execucaoId,
            status: 'executando',
            background: true,
            initial: payload,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (error: any) {
        clearTimeout(timeoutId);
        const isAbort = error?.name === 'AbortError' || error?.message?.includes('aborted');
        
        // Se foi abort (timeout), o worker provavelmente ainda está rodando em background.
        // Não marcar como falhou imediatamente - deixar o worker atualizar o progresso.
        if (isAbort) {
          console.log(`[${tipo}] Timeout ao aguardar worker, mas ele pode estar rodando em background`);
          
          // Retornar sucesso parcial - o progresso real será acompanhado pela UI
          return new Response(
            JSON.stringify({
              success: true,
              execucaoId,
              status: 'executando',
              background: true,
              message: 'Worker iniciado em background. Acompanhe o progresso no painel.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        
        const lastError = error?.message || 'Erro desconhecido ao iniciar worker';

        if (execucaoId) {
          await supabase
            .from('execucoes_agendadas')
            .update({
              status: 'falhou',
              finalizado_em: new Date().toISOString(),
              erros: 1,
              ultimo_erro: lastError,
              detalhes: { error: lastError, phase: 'start-worker' },
            })
            .eq('id', execucaoId)
            .neq('status', 'cancelado');
        }

        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...(metaCfg || {}),
              status: 'idle',
              continuingRun: true,
              last_stop_reason: 'falhou',
              last_stop_at: new Date().toISOString(),
              last_error: lastError,
            },
          })
          .eq('tipo', tipo)
          .is('coordenacao_id', null);

        return new Response(
          JSON.stringify({
            success: false,
            execucaoId,
            blocked: false,
            error: lastError,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Cancelamento forçado: respeitar tanto o metadata.cancelado quanto o status='cancelado'
    // na tabela de tracking (execucoes_agendadas). Isso evita “queimar crédito” em lotes novos.
    let cancelled = false;
    let lastCancelCheck = 0;
    const CANCEL_THROTTLE_MS = 1500;

    const isCancelled = async () => {
      if (cancelled) return true;
      const now = Date.now();
      if (now - lastCancelCheck < CANCEL_THROTTLE_MS) return false;
      lastCancelCheck = now;

      if (execucaoId) {
        const { data: exec } = await supabase
          .from('execucoes_agendadas')
          .select('status')
          .eq('id', execucaoId)
          .maybeSingle();

        if (exec?.status === 'cancelado') {
          cancelled = true;
          return true;
        }
      }

      const { data: cfg } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      const cfgCancelled = (cfg?.metadata as any)?.cancelado === true;
      if (cfgCancelled) {
        cancelled = true;
      }
      return cancelled;
    };

    let retryCount = 0;
    let lastError: string | null = null;
    let resultado: any = null;
    let isComplete = false;
    let totalProcessados = 0;
    let totalEncontrados = 0;
    let lotes = 0;

    // Loop de execução com retries
    while (!isComplete && retryCount <= MAX_RETRIES) {
      // Checagem de cancelamento
      if (await isCancelled()) {
        console.log(`[${tipo}] Cancelamento detectado, interrompendo antes do próximo lote`);
        break;
      }
      try {
        // Chamar a função de monitoramento
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), WORKER_CALL_TIMEOUT_MS);

        // Para DJEN, ler dataInicio/dataFim do metadata da configuração
        let dataInicio: string | undefined;
        let dataFim: string | undefined;
        if (tipo === 'djen') {
          const { data: cfg } = await supabase
            .from('configuracoes_monitoramento')
            .select('metadata')
            .eq('tipo', 'djen')
            .is('coordenacao_id', null)
            .maybeSingle();
          const meta = (cfg?.metadata as any) || {};
          dataInicio = meta.dataInicio;
          dataFim = meta.dataFim;
        }

        // Construir URL com query params para DJEN (offset, datas)
        let fetchUrl = `${supabaseUrl}/functions/v1/${funcao}`;
        if (tipo === 'djen') {
          const params = new URLSearchParams();
          // Offset vem do metadata (next_offset) para retomada
          const { data: cfgOffset } = await supabase
            .from('configuracoes_monitoramento')
            .select('metadata')
            .eq('tipo', 'djen')
            .is('coordenacao_id', null)
            .maybeSingle();
          const metaOffset = (cfgOffset?.metadata as any) || {};
          const offset = lotes > 0 ? (metaOffset.next_offset || 0) : 0;
          params.set('offset', String(offset));
          if (dataInicio) params.set('dataInicio', dataInicio);
          if (dataFim) params.set('dataFim', dataFim);
          fetchUrl = `${fetchUrl}?${params.toString()}`;
        }

        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ 
            completeRun: true, 
            scheduled,
            execucaoId,
            continued: lotes > 0 
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        }

        resultado = await response.json();
        lotes++;

        // Acumular estatísticas
        totalProcessados += resultado.processosVerificados || resultado.results?.checked || resultado.tribunaisProcessados || 0;
        totalEncontrados += resultado.novasPublicacoes || resultado.results?.newMovements || resultado.novasDistribuicoes || resultado.alertasCriados || 0;

        // Verificar se completou
        isComplete = resultado.isComplete !== false && !resultado.hasMore;

        // Atualizar progresso
        if (execucaoId) {
          await supabase
            .from('execucoes_agendadas')
            .update({
              lotes_processados: lotes,
              total_lotes: resultado.progress?.total || null,
              registros_processados: totalProcessados,
              registros_encontrados: totalEncontrados,
              detalhes: resultado,
            })
            .eq('id', execucaoId)
            .neq('status', 'cancelado');
        }

        // Reset retry counter on success
        retryCount = 0;
        lastError = null;

        console.log(`[${tipo}] Lote ${lotes}: ${totalProcessados} processados, ${totalEncontrados} encontrados, completo: ${isComplete}`);

      } catch (error: any) {
        lastError = error.message || 'Erro desconhecido';
        retryCount++;
        
        console.error(`[${tipo}] Erro no lote ${lotes + 1}, tentativa ${retryCount}/${MAX_RETRIES}:`, lastError);

        // Se já foi cancelado, não faz retry.
        if (await isCancelled()) {
          console.log(`[${tipo}] Cancelamento detectado durante erro, abortando retries`);
          break;
        }

        if (retryCount <= MAX_RETRIES) {
          // Aguardar antes de retry (backoff exponencial)
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Esgotar retries = sair do loop
          console.error(`[${tipo}] Retries esgotadas, marcando como falhou`);
          break;
        }
      }
    }

    // Determinar status final
    let statusFinal: string;
    if (cancelled) {
      statusFinal = 'cancelado';
    } else if (lastError && retryCount > MAX_RETRIES) {
      statusFinal = 'falhou';
    } else if (isComplete) {
      statusFinal = 'concluido';
    } else {
      // Parou por algum motivo não identificado
      statusFinal = 'falhou';
    }

    // Atualizar registro final
    if (execucaoId) {
      await supabase
        .from('execucoes_agendadas')
        .update({
          status: statusFinal,
          finalizado_em: new Date().toISOString(),
          lotes_processados: lotes,
          registros_processados: totalProcessados,
          registros_encontrados: totalEncontrados,
          erros: lastError ? 1 : 0,
          ultimo_erro: lastError,
          retry_count: retryCount,
          detalhes: resultado,
        })
        .eq('id', execucaoId)
        .neq('status', 'cancelado');
    }

    // Se paramos por timeout/falha, liberar o status no metadata para não parecer “executando” eternamente.
    // Mantém next_offset/offsets existentes para permitir Retomar.
    if (statusFinal === 'timeout' || statusFinal === 'falhou') {
      const { data: cfgMeta } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      const meta = ((cfgMeta?.metadata as any) || {}) as Record<string, any>;
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...meta,
            // O worker usa 'em_andamento'/'concluido'/'cancelado'; aqui forçamos idle quando paramos.
            status: 'idle',
            continuingRun: true,
            last_stop_reason: statusFinal,
            last_stop_at: new Date().toISOString(),
            last_error: lastError,
          },
        })
        .eq('tipo', tipo)
        .is('coordenacao_id', null);
    }

    // Limpar flag de cancelamento no metadata para não bloquear próximas execuções
    if (statusFinal === 'cancelado') {
      const { data: cfg } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      const meta = ((cfg?.metadata as any) || {}) as Record<string, any>;
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...meta,
            cancelado: false,
            status: 'cancelado',
            continuingRun: false,
            cancelled_at: new Date().toISOString(),
          },
        })
        .eq('tipo', tipo)
        .is('coordenacao_id', null);
    }

    // Atualizar configuração de monitoramento
    await supabase
      .from('configuracoes_monitoramento')
      .update({ 
        ultima_execucao: new Date().toISOString(),
      })
      .eq('tipo', tipo)
      .is('coordenacao_id', null);

    console.log(`[${tipo}] Execução ${execucaoId} finalizada: ${statusFinal}`);

    return new Response(
      JSON.stringify({
        success: statusFinal === 'concluido',
        execucaoId,
        status: statusFinal,
        lotes,
        totalProcessados,
        totalEncontrados,
        error: lastError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
