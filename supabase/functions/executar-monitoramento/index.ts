import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de tipos para funções
const FUNCOES_MAP: Record<string, string> = {
  redistribuicoes: 'monitorar-redistribuicoes',
  andamentos: 'monitorar-andamentos',
  distribuicoes: 'monitorar-distribuicoes',
  djen: 'monitorar-djen',
  djen_processos: 'monitorar-djen-processos',
  termos: 'monitorar-termos',
};

const MAX_RETRIES = 3;
const TIMEOUT_MS = 25 * 60 * 1000; // 25 minutos

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { tipo, scheduled = false, jobName } = await req.json();

    if (!tipo || !FUNCOES_MAP[tipo]) {
      return new Response(
        JSON.stringify({ error: 'Tipo de monitoramento inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const funcao = FUNCOES_MAP[tipo];

    // Verificar se já existe uma execução em andamento para este tipo
    const { data: execucoesEmAndamento } = await supabase
      .from('execucoes_agendadas')
      .select('id, iniciado_em')
      .eq('tipo', tipo)
      .eq('status', 'executando')
      .order('created_at', { ascending: false })
      .limit(1);

    if (execucoesEmAndamento && execucoesEmAndamento.length > 0) {
      const execucao = execucoesEmAndamento[0];
      const iniciado = new Date(execucao.iniciado_em);
      const agora = new Date();
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
      } else {
        // Execução ainda está em andamento
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Execução em andamento há ${Math.round(minutosDecorridos)} minutos`,
            execucaoId: execucao.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      if (await isCancelled()) {
        console.log(`[${tipo}] Cancelamento detectado, interrompendo antes do próximo lote`);
        break;
      }
      try {
        // Chamar a função de monitoramento
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
        }
      }
    }

    // Determinar status final
    if (!isComplete && cancelled) {
      isComplete = true;
    }

    const statusFinal = cancelled
      ? 'cancelado'
      : (isComplete ? 'concluido' : (retryCount > MAX_RETRIES ? 'falhou' : 'concluido'));

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
