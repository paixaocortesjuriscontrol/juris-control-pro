import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 1000; // Supabase/PostgREST limita retorno padrão a 1000 linhas por requisição

// Padrões para detectar audiências
const AUDIENCIA_PATTERNS = [
  /audiência.*(?:designada|marcada|realizada|agendada)/i,
  /(?:designada|marcada|agendada).*audiência/i,
  /pauta.*audiência/i,
  /audiência.*(?:conciliação|instrução|julgamento|una)/i,
  /(?:intimado|intimação).*audiência/i,
  /data.*audiência.*(\d{2}\/\d{2}\/\d{4})/i,
];

// Padrões para detectar intimações
const INTIMACAO_PATTERNS = [
  /intim(?:ado|ação|ar)/i,
  /prazo.*(?:\d+)\s*dias/i,
  /manifesta(?:r|ção)/i,
  /ciência/i,
  /notifica(?:do|ção)/i,
  /cumpra-se/i,
  /despacho.*intim/i,
];

function extractAudienciaDate(text: string): string | null {
  const patterns = [
    /(\d{2}\/\d{2}\/\d{4})\s*[àa]?s?\s*(\d{1,2}[h:]\d{2})?/i,
    /dia\s*(\d{1,2})\s*(?:de\s*)?(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s*)?(\d{4})?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && match[1].includes('/')) {
        const [day, month, year] = match[1].split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }
  return null;
}

function extractAudienciaHora(text: string): string | null {
  const patterns = [
    /(\d{1,2})[h:](\d{2})/i,
    /às?\s*(\d{1,2})\s*horas?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const hora = match[1].padStart(2, '0');
      const minutos = match[2] ? match[2].padStart(2, '0') : '00';
      return `${hora}:${minutos}`;
    }
  }
  return null;
}

function extractPrazoDias(text: string): number | null {
  const match = text.match(/prazo\s*(?:de\s*)?(\d+)\s*dias?/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function detectTipoAudiencia(text: string): string {
  const textLower = text.toLowerCase();
  if (textLower.includes('conciliação') || textLower.includes('conciliatória')) return 'Conciliação';
  if (textLower.includes('instrução')) return 'Instrução';
  if (textLower.includes('julgamento')) return 'Julgamento';
  if (textLower.includes('una')) return 'Una';
  if (textLower.includes('inicial')) return 'Inicial';
  return 'Geral';
}

function detectTipoIntimacao(text: string): string {
  const textLower = text.toLowerCase();
  if (textLower.includes('manifestar') || textLower.includes('manifestação')) return 'Manifestação';
  if (textLower.includes('contestar') || textLower.includes('contestação')) return 'Contestação';
  if (textLower.includes('recurso') || textLower.includes('recorrer')) return 'Recurso';
  if (textLower.includes('cumprimento') || textLower.includes('cumprir')) return 'Cumprimento';
  if (textLower.includes('ciência')) return 'Ciência';
  if (textLower.includes('pagamento') || textLower.includes('pagar')) return 'Pagamento';
  return 'Geral';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const completeRun = body.completeRun === true;
    const execucaoIdFromBody = typeof body.execucaoId === 'string' ? body.execucaoId : null;

    const startTime = Date.now();
    console.log(`Starting term monitoring scan... completeRun=${completeRun}`);

    // Buscar configuração para obter/atualizar offset
    const { data: configData } = await supabase
      .from('configuracoes_monitoramento')
      .select('id, metadata')
      .eq('tipo', 'termos')
      .is('coordenacao_id', null)
      .single();

    // Execução (para o dashboard): pode vir do body (manual) ou ficar persistida no metadata (continuação)
    const execucaoId = execucaoIdFromBody || (configData?.metadata as any)?.execucaoId || null;

    // Early cancellation check: if user requested cancel, stop immediately (don’t process another batch)
    if (completeRun && (configData?.metadata as any)?.cancelado === true && configData?.id) {
      console.log('Cancellation flag detected at start, skipping batch');

      // Atualiza execução (se houver) para refletir cancelamento no dashboard
      if (execucaoId) {
        await supabase
          .from('execucoes_agendadas')
          .update({
            status: 'cancelado',
            finalizado_em: new Date().toISOString(),
            detalhes: {
              cancelled: true,
              reason: 'cancel_flag_detected_at_start',
            },
          })
          .eq('id', execucaoId);
      }

      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...(configData.metadata as any),
            cancelado: false,
            status: 'cancelado',
            continuingRun: false,
            execucaoId: execucaoId || (configData.metadata as any)?.execucaoId,
          },
        })
        .eq('id', configData.id);

      return new Response(
        JSON.stringify({
          success: true,
          cancelled: true,
          isComplete: true,
          continuingRun: false,
          message: 'Execução cancelada (antes de iniciar o próximo lote)',
          progress: { current: 0, total: 0, percentage: 100 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentOffset = completeRun ? (configData?.metadata?.next_offset || 0) : 0;

    // Varrer SOMENTE publicações DJEN capturadas HOJE (início do dia em Brasília = 03:00 UTC)
    const hoje = new Date();
    const inicioDiaBrasilia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 3, 0, 0, 0));
    // Se ainda não passou das 03:00 UTC, usar o dia anterior
    if (hoje < inicioDiaBrasilia) {
      inicioDiaBrasilia.setUTCDate(inicioDiaBrasilia.getUTCDate() - 1);
    }
    const dataFiltro = inicioDiaBrasilia.toISOString();
    console.log(`Filtering DJEN publications from today (Brasília): ${dataFiltro}`);

    // Contar total de publicações DJEN do dia (SEM movimentações)
    const [countDjenTermosResult, countDjenProcessosResult, termosResult] = await Promise.all([
      supabase.from('publicacoes_djen').select('id', { count: 'exact', head: true }).gte('created_at', dataFiltro),
      supabase.from('publicacoes_djen_processos').select('id', { count: 'exact', head: true }).gte('created_at', dataFiltro),
      supabase.from('termos_monitoramento').select('id, termo, categoria, prioridade').eq('ativo', true),
    ]);

    const totalDjenTermos = countDjenTermosResult.count || 0;
    const totalDjenProcessos = countDjenProcessosResult.count || 0;
    const totalRegistros = totalDjenTermos + totalDjenProcessos;
    const termos = termosResult.data || [];

    console.log(`Init: ${termos.length} terms, ${totalDjenTermos} djen_termos + ${totalDjenProcessos} djen_processos = ${totalRegistros} total (${Date.now() - startTime}ms)`);

    if (termos.length === 0) {
      console.log('No active terms configured');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum termo configurado', 
          alertasGerados: 0,
          isComplete: true,
          progress: { current: 0, total: 0, percentage: 100 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar publicações DJEN (termos) do dia
    const { data: publicacoesDjenTermos } = await supabase
      .from('publicacoes_djen')
      .select('id, processo_numero, conteudo, monitoramento_id, created_at, monitoramento:monitoramentos_djen(coordenacao_id)')
      .gte('created_at', dataFiltro)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + BATCH_SIZE - 1);

    // Buscar publicações DJEN (processos) do dia
    const { data: publicacoesDjenProcessos } = await supabase
      .from('publicacoes_djen_processos')
      .select('id, processo_numero, processo_id, conteudo, created_at, processo:processos(coordenacao_id)')
      .gte('created_at', dataFiltro)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + BATCH_SIZE - 1);

    const djenTermosList = publicacoesDjenTermos || [];
    const djenProcessosList = publicacoesDjenProcessos || [];
    const totalBatchSize = djenTermosList.length + djenProcessosList.length;
    // Progresso baseado no maior lote entre termos e processos (são processados em paralelo)
    const batchMax = Math.max(djenTermosList.length, djenProcessosList.length);
    const processedCount = currentOffset + batchMax;

    // Total máximo para calcular finalização
    const maxTotal = Math.max(totalDjenTermos, totalDjenProcessos);
    const isComplete = processedCount >= maxTotal || totalBatchSize === 0;

    console.log(`Loaded: ${djenTermosList.length} djen_termos + ${djenProcessosList.length} djen_processos (offset ${currentOffset}) in ${Date.now() - startTime}ms`);

    // Buscar alertas existentes para publicações DJEN (usa chave: processo_id + termo_id)
    const djenProcessoNumeros = [
      ...djenTermosList.map(p => p.processo_numero),
      ...djenProcessosList.map(p => p.processo_numero),
    ].filter(Boolean);

    let alertasDjenExistentes = new Set<string>();
    if (djenProcessoNumeros.length > 0) {
      // Buscar alertas existentes que tenham contexto contendo "DJEN" para evitar duplicatas
      const { data: alertasDjen } = await supabase
        .from('alertas_monitoramento')
        .select('processo_id, termo_id, contexto')
        .like('contexto', '%[DJEN]%');
      
      if (alertasDjen) {
        // Criar set com chave: processo_id + termo_id
        alertasDjenExistentes = new Set(alertasDjen.map(a => `${a.processo_id}-${a.termo_id}`));
      }
    }

    console.log(`Dedup sets loaded in ${Date.now() - startTime}ms`);

    let alertasGerados = 0;
    let audienciasDetectadas = 0;
    let intimacoesDetectadas = 0;
    const novosAlertas: any[] = [];
    const novasAudiencias: any[] = [];
    const novasIntimacoes: any[] = [];

    // ========== PROCESSAR PUBLICAÇÕES DJEN (TERMOS) ==========
    // OTIMIZAÇÃO: Buscar todos os processo_id em batch, não individualmente
    const djenProcessadas = new Set<string>();
    let alertasDjenGerados = 0;

    // Coletar todos os números de processo únicos das publicações DJEN
    const numerosProcessoDjen = [...new Set([
      ...djenTermosList.map(p => p.processo_numero).filter(Boolean),
    ])];

    // Buscar todos os processo_id de uma vez (em chunks de 100 para não ultrapassar limite)
    const processoNumeroToId = new Map<string, string>();
    for (let i = 0; i < numerosProcessoDjen.length; i += 100) {
      const chunk = numerosProcessoDjen.slice(i, i + 100);
      const { data: procs } = await supabase
        .from('processos')
        .select('id, numero')
        .in('numero', chunk);
      
      if (procs) {
        for (const p of procs) {
          processoNumeroToId.set(p.numero, p.id);
        }
      }
    }

    console.log(`Resolved ${processoNumeroToId.size}/${numerosProcessoDjen.length} processo numbers to IDs in batch`);

    for (const pub of djenTermosList) {
      const conteudoLower = (pub.conteudo || '').toLowerCase();
      const processoNumero = pub.processo_numero || '';
      
      // Usar o mapa de processo_id (busca O(1))
      const processoId = processoNumeroToId.get(processoNumero) || null;
      if (!processoId) continue; // Sem processo vinculado, não gera alerta

      for (const termo of termos) {
        const termoLower = termo.termo.toLowerCase();
        
        if (conteudoLower.includes(termoLower)) {
          // Chave de deduplicação: processo_id + termo_id
          const dedupKey = `${processoId}-${termo.id}`;
          
          // Verificar se já existe alerta DJEN para este processo + termo
          if (alertasDjenExistentes.has(dedupKey) || djenProcessadas.has(dedupKey)) {
            continue;
          }

          const index = conteudoLower.indexOf(termoLower);
          const start = Math.max(0, index - 50);
          const end = Math.min(pub.conteudo.length, index + termo.termo.length + 50);
          const contexto = '[DJEN] ' + (start > 0 ? '...' : '') + 
                          pub.conteudo.slice(start, end) + 
                          (end < pub.conteudo.length ? '...' : '');

          novosAlertas.push({
            termo_id: termo.id,
            processo_id: processoId,
            movimentacao_id: null, // Sem movimentação - veio do DJEN
            termo_encontrado: termo.termo,
            contexto,
            prioridade: termo.prioridade,
            status: 'pendente',
          });

          djenProcessadas.add(dedupKey);
          alertasDjenGerados++;
          alertasGerados++;
        }
      }
    }

    // ========== PROCESSAR PUBLICAÇÕES DJEN (PROCESSOS) ==========
    for (const pub of djenProcessosList) {
      const conteudoLower = (pub.conteudo || '').toLowerCase();
      const processoId = pub.processo_id;
      
      if (!processoId) continue;

      for (const termo of termos) {
        const termoLower = termo.termo.toLowerCase();
        
        if (conteudoLower.includes(termoLower)) {
          // Chave de deduplicação: processo_id + termo_id
          const dedupKey = `${processoId}-${termo.id}`;
          
          // Verificar se já existe alerta para este processo + termo
          if (alertasDjenExistentes.has(dedupKey) || djenProcessadas.has(dedupKey)) {
            continue;
          }

          const index = conteudoLower.indexOf(termoLower);
          const start = Math.max(0, index - 50);
          const end = Math.min(pub.conteudo.length, index + termo.termo.length + 50);
          const contexto = '[DJEN] ' + (start > 0 ? '...' : '') + 
                          pub.conteudo.slice(start, end) + 
                          (end < pub.conteudo.length ? '...' : '');

          novosAlertas.push({
            termo_id: termo.id,
            processo_id: processoId,
            movimentacao_id: null, // Sem movimentação - veio do DJEN
            termo_encontrado: termo.termo,
            contexto,
            prioridade: termo.prioridade,
            status: 'pendente',
          });

          djenProcessadas.add(dedupKey);
          alertasDjenGerados++;
          alertasGerados++;
        }
      }
    }

    console.log(`Processed ${djenTermosList.length + djenProcessosList.length} DJEN publications in ${Date.now() - startTime}ms. Found ${alertasDjenGerados} DJEN alerts. Inserting ${novosAlertas.length} alerts, ${novasAudiencias.length} hearings, ${novasIntimacoes.length} summons...`);

    // Inserir alertas em paralelo
    const insertPromises: Promise<any>[] = [];

    if (novosAlertas.length > 0) {
      for (let i = 0; i < novosAlertas.length; i += 100) {
        const batch = novosAlertas.slice(i, i + 100);
        insertPromises.push(Promise.resolve(supabase.from('alertas_monitoramento').insert(batch)));
      }
    }

    await Promise.all(insertPromises);

    // Função auxiliar para criar tarefas e vincular
    async function criarTarefasParaResponsaveis(
      processoId: string,
      titulo: string,
      descricao: string,
      dataVencimento: string,
      prioridade: string,
      origem: string
    ): Promise<string[]> {
      // Buscar responsáveis do processo
      const { data: responsaveis } = await supabase
        .from('processos_responsaveis')
        .select('responsavel_id')
        .eq('processo_id', processoId);

      // Se não tem responsáveis na tabela, tenta o advogado_responsavel_id legado
      if (!responsaveis || responsaveis.length === 0) {
        const { data: processo } = await supabase
          .from('processos')
          .select('advogado_responsavel_id')
          .eq('id', processoId)
          .single();

        if (processo?.advogado_responsavel_id) {
          const { data: tarefa, error } = await supabase
            .from('tarefas')
            .insert({
              processo_id: processoId,
              responsavel_id: processo.advogado_responsavel_id,
              criado_por: processo.advogado_responsavel_id,
              titulo,
              descricao,
              data_vencimento: dataVencimento,
              prioridade,
              status: 'pendente',
              origem,
            })
            .select('id')
            .single();

          if (!error && tarefa) {
            return [tarefa.id];
          }
        }
        return [];
      }

      // Criar tarefa para cada responsável
      const tarefaIds: string[] = [];
      for (const resp of responsaveis) {
        const { data: tarefa, error } = await supabase
          .from('tarefas')
          .insert({
            processo_id: processoId,
            responsavel_id: resp.responsavel_id,
            criado_por: resp.responsavel_id,
            titulo,
            descricao,
            data_vencimento: dataVencimento,
            prioridade,
            status: 'pendente',
            origem,
          })
          .select('id')
          .single();

        if (!error && tarefa) {
          tarefaIds.push(tarefa.id);
        }
      }

      return tarefaIds;
    }

    // Inserir audiências e criar tarefas APENAS para termos URGENTES
    let tarefasCriadas = 0;
    if (novasAudiencias.length > 0) {
      for (const audiencia of novasAudiencias) {
        // Extrair prioridade do termo antes de inserir (campo temporário)
        const prioridadeTermo = audiencia._prioridadeTermo;
        delete audiencia._prioridadeTermo;

        // Inserir audiência
        const { data: inserted, error } = await supabase
          .from('audiencias_detectadas')
          .insert(audiencia)
          .select('id')
          .single();

        if (error) {
          console.error('Error inserting audiencia:', error);
          continue;
        }

        // REGRA: só cria tarefa se o termo for URGENTE
        if (prioridadeTermo === 'urgente') {
          // Calcular data de vencimento da tarefa (2 dias antes da audiência, ou hoje se não tiver data)
          let dataVencimentoTarefa: string;
          if (audiencia.data_audiencia) {
            const dataAud = new Date(audiencia.data_audiencia);
            dataAud.setDate(dataAud.getDate() - 2);
            dataVencimentoTarefa = dataAud.toISOString().split('T')[0];
          } else {
            const hoje = new Date();
            hoje.setDate(hoje.getDate() + 5);
            dataVencimentoTarefa = hoje.toISOString().split('T')[0];
          }

          // Criar tarefas para responsáveis
          const tarefaIds = await criarTarefasParaResponsaveis(
            audiencia.processo_id,
            `[URGENTE] Audiência ${audiencia.tipo_audiencia || ''} - ${audiencia.processo_numero || 'Processo'}`,
            `⚠️ TERMO URGENTE DETECTADO\n\nAudiência detectada pelo Monitoração 360.\n\nData: ${audiencia.data_audiencia || 'A definir'}\nHora: ${audiencia.hora || 'A definir'}\n\nContexto:\n${audiencia.contexto || audiencia.conteudo_publicacao?.substring(0, 300) || ''}`,
            dataVencimentoTarefa,
            'urgente',
            'monitoracao_360'
          );

          // Vincular primeira tarefa à audiência
          if (tarefaIds.length > 0) {
            await supabase
              .from('audiencias_detectadas')
              .update({ tarefa_id: tarefaIds[0] })
              .eq('id', inserted.id);
            tarefasCriadas += tarefaIds.length;
            console.log(`Created ${tarefaIds.length} tasks for URGENT hearing ${inserted.id}`);
          }
        }
      }
    }

    // Inserir intimações e criar tarefas APENAS para termos URGENTES
    if (novasIntimacoes.length > 0) {
      for (const intimacao of novasIntimacoes) {
        // Extrair prioridade do termo antes de inserir (campo temporário)
        const prioridadeTermo = intimacao._prioridadeTermo;
        delete intimacao._prioridadeTermo;

        // Inserir intimação
        const { data: inserted, error } = await supabase
          .from('intimacoes_detectadas')
          .insert(intimacao)
          .select('id')
          .single();

        if (error) {
          console.error('Error inserting intimacao:', error);
          continue;
        }

        // REGRA: só cria tarefa se o termo for URGENTE
        if (prioridadeTermo === 'urgente') {
          // Data de vencimento da tarefa (data_limite ou hoje + 15 dias)
          const dataVencimentoTarefa = intimacao.data_limite || 
            new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          // Criar tarefas para responsáveis
          const tarefaIds = await criarTarefasParaResponsaveis(
            intimacao.processo_id,
            `[URGENTE] ${intimacao.tipo_intimacao || 'Intimação'} - ${intimacao.processo_numero || 'Processo'}`,
            `⚠️ TERMO URGENTE DETECTADO\n\nIntimação detectada pelo Monitoração 360.\n\nPrazo: ${intimacao.prazo_dias ? intimacao.prazo_dias + ' dias' : 'Verificar'}\nData Limite: ${intimacao.data_limite || 'A calcular'}\n\nContexto:\n${intimacao.contexto || intimacao.descricao || ''}`,
            dataVencimentoTarefa,
            'urgente',
            'monitoracao_360'
          );

          // Vincular primeira tarefa à intimação
          if (tarefaIds.length > 0) {
            await supabase
              .from('intimacoes_detectadas')
              .update({ tarefa_id: tarefaIds[0] })
              .eq('id', inserted.id);
            tarefasCriadas += tarefaIds.length;
            console.log(`Created ${tarefaIds.length} tasks for URGENT summons ${inserted.id}`);
          }
        }
      }
    }

    console.log(`Created ${tarefasCriadas} tasks for URGENT terms only`);

    // ========== PROCESSAR AUDIÊNCIAS/INTIMAÇÕES DJEN PENDENTES SEM TAREFA ==========
    // Buscar audiências pendentes de origem DJEN sem tarefa vinculada
    const { data: audienciasDjenPendentes } = await supabase
      .from('audiencias_detectadas')
      .select('id, processo_id, processo_numero, tipo_audiencia, data_audiencia, hora, contexto, conteudo_publicacao, origem')
      .is('tarefa_id', null)
      .eq('status', 'pendente')
      .not('processo_id', 'is', null)
      .in('origem', ['monitoramento_djen', 'monitoramento_djen_processos', 'detectado', 'djen_processos'])
      .limit(20);

    if (audienciasDjenPendentes && audienciasDjenPendentes.length > 0) {
      console.log(`Processing ${audienciasDjenPendentes.length} pending DJEN audiences without tasks...`);
      
      for (const audiencia of audienciasDjenPendentes) {
        // Calcular data de vencimento (2 dias antes da audiência)
        let dataVencimentoTarefa: string;
        if (audiencia.data_audiencia) {
          const dataAud = new Date(audiencia.data_audiencia);
          dataAud.setDate(dataAud.getDate() - 2);
          dataVencimentoTarefa = dataAud.toISOString().split('T')[0];
        } else {
          const hoje = new Date();
          hoje.setDate(hoje.getDate() + 5);
          dataVencimentoTarefa = hoje.toISOString().split('T')[0];
        }

        const tarefaIds = await criarTarefasParaResponsaveis(
          audiencia.processo_id,
          `[DJEN] Audiência ${audiencia.tipo_audiencia || ''} - ${audiencia.processo_numero || 'Processo'}`,
          `Audiência detectada pelo monitoramento DJEN.\n\nData: ${audiencia.data_audiencia || 'A definir'}\nHora: ${audiencia.hora || 'A definir'}\n\nContexto:\n${audiencia.contexto || audiencia.conteudo_publicacao?.substring(0, 300) || ''}`,
          dataVencimentoTarefa,
          'alta',
          'monitoramento_djen'
        );

        if (tarefaIds.length > 0) {
          await supabase
            .from('audiencias_detectadas')
            .update({ tarefa_id: tarefaIds[0] })
            .eq('id', audiencia.id);
          tarefasCriadas += tarefaIds.length;
          console.log(`Created ${tarefaIds.length} tasks for DJEN audience ${audiencia.id}`);
        }
      }
    }

    // Buscar intimações pendentes de origem DJEN sem tarefa vinculada
    const { data: intimacoesDjenPendentes } = await supabase
      .from('intimacoes_detectadas')
      .select('id, processo_id, processo_numero, tipo_intimacao, prazo_dias, data_limite, contexto, descricao, prioridade, origem')
      .is('tarefa_id', null)
      .eq('status', 'pendente')
      .not('processo_id', 'is', null)
      .in('origem', ['monitoramento_djen', 'monitoramento_djen_processos', 'detectado', 'djen_processos'])
      .limit(20);

    if (intimacoesDjenPendentes && intimacoesDjenPendentes.length > 0) {
      console.log(`Processing ${intimacoesDjenPendentes.length} pending DJEN summons without tasks...`);
      
      for (const intimacao of intimacoesDjenPendentes) {
        const dataVencimentoTarefa = intimacao.data_limite || 
          new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const tarefaIds = await criarTarefasParaResponsaveis(
          intimacao.processo_id,
          `[DJEN] ${intimacao.tipo_intimacao || 'Intimação'} - ${intimacao.processo_numero || 'Processo'}`,
          `Intimação detectada pelo monitoramento DJEN.\n\nPrazo: ${intimacao.prazo_dias ? intimacao.prazo_dias + ' dias' : 'Verificar'}\nData Limite: ${intimacao.data_limite || 'A calcular'}\n\nContexto:\n${intimacao.contexto || intimacao.descricao || ''}`,
          dataVencimentoTarefa,
          intimacao.prioridade || 'alta',
          'monitoramento_djen'
        );

        if (tarefaIds.length > 0) {
          await supabase
            .from('intimacoes_detectadas')
            .update({ tarefa_id: tarefaIds[0] })
            .eq('id', intimacao.id);
          tarefasCriadas += tarefaIds.length;
          console.log(`Created ${tarefaIds.length} tasks for DJEN summons ${intimacao.id}`);
        }
      }
    }

    console.log(`Total tasks created: ${tarefasCriadas}`);

    // Se gerou alertas, disparar envio de emails para usuários configurados
    if (alertasGerados > 0 && isComplete) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const emailFunctionUrl = `${supabaseUrl}/functions/v1/enviar-alertas-360-email`;
        
        // Disparar assincronamente - não aguardar resposta
        fetch(emailFunctionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRun: false }),
        }).catch(err => {
          console.error('Error triggering email function:', err);
        });
        
        console.log(`Triggered email function for ${alertasGerados} new alerts`);
      } catch (emailErr) {
        console.error('Error calling email function:', emailErr);
      }
    }

    // Atualizar metadata com próximo offset (ou resetar se completo)
    // Progresso baseado no total de registros (DJEN termos + processos)
    const progressPercentage = maxTotal > 0 ? Math.round((processedCount / maxTotal) * 100) : 100;
    
    if (configData?.id) {
      const newMetadata = {
        ...(configData.metadata as Record<string, any>),
        next_offset: isComplete ? 0 : processedCount,
        current: processedCount,
        total: totalRegistros,
        totalDjenTermos,
        totalDjenProcessos,
        percentage: isComplete ? 100 : progressPercentage,
        last_batch_size: totalBatchSize,
        status: isComplete ? 'concluido' : 'em_andamento',
        continuingRun: completeRun && !isComplete,
        alertasGerados: ((configData.metadata as any)?.alertasGerados || 0) + alertasGerados,
        alertasDjenGerados: ((configData.metadata as any)?.alertasDjenGerados || 0) + alertasDjenGerados,
        execucaoId: execucaoId || (configData.metadata as any)?.execucaoId,
        ...(isComplete && { 
          last_complete_run: new Date().toISOString(),
          cancelado: false,
        }),
      };

      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          metadata: newMetadata,
          ultima_execucao: new Date().toISOString(),
        })
        .eq('id', configData.id);
      
      console.log(`Updated config metadata: ${processedCount}/${totalRegistros} (${isComplete ? 100 : progressPercentage}%) - ${alertasDjenGerados} DJEN alerts`);
    }

    // Atualiza a execução em tempo real para o dashboard (execucoes_agendadas)
    if (execucaoId) {
      await supabase
        .from('execucoes_agendadas')
        .update({
          status: isComplete ? 'concluido' : 'executando',
          finalizado_em: isComplete ? new Date().toISOString() : null,
          lotes_processados: processedCount,
          total_lotes: maxTotal,
          registros_processados: processedCount,
          registros_encontrados:
            (((configData?.metadata as any)?.alertasGerados || 0) + alertasGerados) || 0,
          detalhes: {
            progress: {
              current: processedCount,
              total: totalRegistros,
              percentage: isComplete ? 100 : progressPercentage,
            },
            alertasGeradosLote: alertasGerados,
            alertasDjenGeradosLote: alertasDjenGerados,
            audienciasDetectadasLote: audienciasDetectadas,
            intimacoesDetectadasLote: intimacoesDetectadas,
            tarefasCriadasTotal: tarefasCriadas,
            termosAtivos: termos.length,
            fontes: {
              djenTermos: djenTermosList.length,
              djenProcessos: djenProcessosList.length,
            },
            isComplete,
            continuingRun: completeRun && !isComplete,
          },
        })
        .eq('id', execucaoId);
    }

    // Salvar no histórico de monitoramento quando a execução completa
    if (isComplete) {
      await supabase.from('historico_monitoramento').insert({
        tipo: 'termos',
        processos_verificados: totalRegistros,
        novos_andamentos: alertasGerados,
        processos_com_novos: audienciasDetectadas + intimacoesDetectadas,
        erros: 0,
        detalhes: {
          alertasGerados,
          alertasDjenGerados,
          audienciasDetectadas,
          intimacoesDetectadas,
          tarefasCriadas,
          termosAtivos: termos.length,
          fontes: {
            djenTermos: totalDjenTermos,
            djenProcessos: totalDjenProcessos,
          },
        },
        executado_em: new Date().toISOString(),
      });
      console.log('Histórico de monitoramento salvo');
    }

    const percentage = isComplete ? 100 : progressPercentage;

    // Auto-continuation: if completeRun and not complete, trigger next batch
    // But first check if cancellation was requested
    if (completeRun && !isComplete) {
      // Re-fetch config to check for cancellation
      const { data: freshConfig } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'termos')
        .is('coordenacao_id', null)
        .maybeSingle();
      
      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;
      
      if (wasCancelled) {
        console.log('Execution cancelled by user, stopping auto-continuation');
        // Reset cancellation flag
        await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            metadata: { 
              ...freshConfig?.metadata,
              cancelado: false,
              status: 'cancelado',
              continuingRun: false,
              execucaoId: execucaoId || (freshConfig?.metadata as any)?.execucaoId,
            }
          })
          .eq('tipo', 'termos')
          .is('coordenacao_id', null);

        if (execucaoId) {
          await supabase
            .from('execucoes_agendadas')
            .update({
              status: 'cancelado',
              finalizado_em: new Date().toISOString(),
              detalhes: {
                cancelled: true,
                reason: 'cancel_flag_detected_between_batches',
              },
            })
            .eq('id', execucaoId);
        }
      } else {
        const functionUrl = `${supabaseUrl}/functions/v1/monitorar-termos`;
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

        console.log(`Batch processed, triggered next batch. Progress: ${percentage}%`);
      }
    }

    const totalTime = Date.now() - startTime;
    
    console.log(`Batch complete in ${totalTime}ms. Progress: ${processedCount}/${totalRegistros} (${percentage}%). isComplete=${isComplete}. Tasks: ${tarefasCriadas}. DJEN alerts: ${alertasDjenGerados}`);

    return new Response(
      JSON.stringify({
        success: true,
        alertasGerados,
        alertasDjenGerados,
        alertasCriados: alertasGerados,
        audienciasDetectadas,
        intimacoesDetectadas,
        tarefasCriadas,
        djenTermosVerificados: djenTermosList.length,
        djenProcessosVerificados: djenProcessosList.length,
        totalVerificados: totalBatchSize,
        processosVerificados: totalBatchSize,
        termosAtivos: termos.length,
        tempoExecucao: `${totalTime}ms`,
        isComplete,
        completedRun: isComplete,
        continuingRun: completeRun && !isComplete,
        progress: {
          current: processedCount,
          total: totalRegistros,
          percentage,
        },
        fontes: {
          djenTermos: { verificadas: djenTermosList.length, total: totalDjenTermos },
          djenProcessos: { verificadas: djenProcessosList.length, total: totalDjenProcessos },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in term monitoring:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
