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

    const startTime = Date.now();
    console.log(`Starting term monitoring scan... completeRun=${completeRun}`);

    // Buscar configuração para obter/atualizar offset
    const { data: configData } = await supabase
      .from('configuracoes_monitoramento')
      .select('id, metadata')
      .eq('tipo', 'termos')
      .is('coordenacao_id', null)
      .single();

    const currentOffset = completeRun ? (configData?.metadata?.next_offset || 0) : 0;

    // Contar total de movimentações e buscar dados em paralelo
    const [countResult, termosResult, alertasResult, audienciasResult, intimacoesResult] = await Promise.all([
      supabase.from('movimentacoes').select('id', { count: 'exact', head: true }),
      supabase.from('termos_monitoramento').select('id, termo, categoria, prioridade').eq('ativo', true),
      supabase.from('alertas_monitoramento').select('movimentacao_id, termo_id'),
      supabase.from('audiencias_detectadas').select('movimentacao_id').not('movimentacao_id', 'is', null),
      supabase.from('intimacoes_detectadas').select('movimentacao_id').not('movimentacao_id', 'is', null),
    ]);

    const totalMovimentacoes = countResult.count || 0;
    const termos = termosResult.data || [];

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

    // Buscar lote de movimentações com offset
    const { data: movimentacoes } = await supabase
      .from('movimentacoes')
      .select('id, processo_id, descricao, data_movimentacao, processo:processos(numero)')
      .order('data_movimentacao', { ascending: false })
      .range(currentOffset, currentOffset + BATCH_SIZE - 1);

    const movimentacoesList = movimentacoes || [];
    const processedCount = currentOffset + movimentacoesList.length;

    // Importante: não usar "length < BATCH_SIZE" como condição de finalização,
    // porque o PostgREST pode cortar em 1000 linhas mesmo havendo mais dados.
    const isComplete = processedCount >= totalMovimentacoes || movimentacoesList.length === 0;

    console.log(`Loaded: ${termos.length} terms, ${movimentacoesList.length} movements (offset ${currentOffset}/${totalMovimentacoes})`);

    // Criar Sets para verificação rápida de duplicatas
    const alertasSet = new Set(
      (alertasResult.data || []).map(a => `${a.movimentacao_id}-${a.termo_id}`)
    );
    const audienciasExistentes = new Set(
      (audienciasResult.data || []).map(a => a.movimentacao_id)
    );
    const intimacoesExistentes = new Set(
      (intimacoesResult.data || []).map(i => i.movimentacao_id)
    );

    let alertasGerados = 0;
    let audienciasDetectadas = 0;
    let intimacoesDetectadas = 0;
    const novosAlertas: any[] = [];
    const novasAudiencias: any[] = [];
    const novasIntimacoes: any[] = [];
    const movimentacoesProcessadas = new Set<string>();

    // Processar movimentações
    for (const mov of movimentacoesList) {
      const descricaoLower = mov.descricao.toLowerCase();
      const processoNumero = (mov.processo as any)?.numero || '';

      for (const termo of termos) {
        const termoLower = termo.termo.toLowerCase();
        
        if (descricaoLower.includes(termoLower)) {
          const key = `${mov.id}-${termo.id}`;
          
          if (!alertasSet.has(key)) {
            const index = descricaoLower.indexOf(termoLower);
            const start = Math.max(0, index - 50);
            const end = Math.min(mov.descricao.length, index + termo.termo.length + 50);
            const contexto = (start > 0 ? '...' : '') + 
                            mov.descricao.slice(start, end) + 
                            (end < mov.descricao.length ? '...' : '');

            novosAlertas.push({
              termo_id: termo.id,
              processo_id: mov.processo_id,
              movimentacao_id: mov.id,
              termo_encontrado: termo.termo,
              contexto,
              prioridade: termo.prioridade,
              status: 'pendente',
            });

            alertasSet.add(key);
            alertasGerados++;

            // Detectar audiências e intimações (uma vez por movimentação)
            if (!movimentacoesProcessadas.has(mov.id)) {
              movimentacoesProcessadas.add(mov.id);

              // Verificar se é uma audiência (e ainda não existe)
              if (!audienciasExistentes.has(mov.id)) {
                const isAudiencia = AUDIENCIA_PATTERNS.some(pattern => pattern.test(mov.descricao));
                if (isAudiencia) {
                  const dataAudiencia = extractAudienciaDate(mov.descricao);
                  const horaAudiencia = extractAudienciaHora(mov.descricao);
                  const tipoAudiencia = detectTipoAudiencia(mov.descricao);

                  novasAudiencias.push({
                    processo_id: mov.processo_id,
                    processo_numero: processoNumero,
                    movimentacao_id: mov.id,
                    data_audiencia: dataAudiencia,
                    hora: horaAudiencia,
                    tipo_audiencia: tipoAudiencia,
                    conteudo_publicacao: mov.descricao.substring(0, 2000),
                    contexto: mov.descricao.substring(0, 500),
                    status: 'pendente',
                    origem: 'monitoracao_360',
                  });
                  audienciasExistentes.add(mov.id);
                  audienciasDetectadas++;
                }
              }

              // Verificar se é uma intimação (e ainda não existe)
              if (!intimacoesExistentes.has(mov.id)) {
                const isIntimacao = INTIMACAO_PATTERNS.some(pattern => pattern.test(mov.descricao));
                if (isIntimacao) {
                  const prazoDias = extractPrazoDias(mov.descricao);
                  const tipoIntimacao = detectTipoIntimacao(mov.descricao);
                  
                  let dataLimite: string | null = null;
                  if (prazoDias) {
                    const hoje = new Date();
                    hoje.setDate(hoje.getDate() + prazoDias);
                    dataLimite = hoje.toISOString().split('T')[0];
                  }

                  novasIntimacoes.push({
                    processo_id: mov.processo_id,
                    processo_numero: processoNumero,
                    movimentacao_id: mov.id,
                    tipo_intimacao: tipoIntimacao,
                    descricao: mov.descricao.substring(0, 500),
                    conteudo_publicacao: mov.descricao,
                    contexto: mov.descricao.substring(0, 500),
                    prazo_dias: prazoDias,
                    data_limite: dataLimite,
                    data_intimacao: new Date().toISOString(),
                    status: 'pendente',
                    prioridade: prazoDias && prazoDias <= 5 ? 'urgente' : prazoDias && prazoDias <= 10 ? 'alta' : 'media',
                    origem: 'monitoracao_360',
                  });
                  intimacoesExistentes.add(mov.id);
                  intimacoesDetectadas++;
                }
              }
            }
          }
        }
      }
    }

    console.log(`Processed in ${Date.now() - startTime}ms. Inserting ${novosAlertas.length} alerts, ${novasAudiencias.length} hearings, ${novasIntimacoes.length} summons...`);

    // Inserir tudo em paralelo
    const insertPromises: Promise<any>[] = [];

    if (novosAlertas.length > 0) {
      for (let i = 0; i < novosAlertas.length; i += 100) {
        const batch = novosAlertas.slice(i, i + 100);
        insertPromises.push(Promise.resolve(supabase.from('alertas_monitoramento').insert(batch)));
      }
    }

    if (novasAudiencias.length > 0) {
      for (let i = 0; i < novasAudiencias.length; i += 100) {
        const batch = novasAudiencias.slice(i, i + 100);
        insertPromises.push(Promise.resolve(supabase.from('audiencias_detectadas').insert(batch)));
      }
    }

    if (novasIntimacoes.length > 0) {
      for (let i = 0; i < novasIntimacoes.length; i += 100) {
        const batch = novasIntimacoes.slice(i, i + 100);
        insertPromises.push(Promise.resolve(supabase.from('intimacoes_detectadas').insert(batch)));
      }
    }

    await Promise.all(insertPromises);

    // Atualizar metadata com próximo offset (ou resetar se completo)
    if (configData?.id && completeRun) {
      const newMetadata = {
        ...configData.metadata,
        next_offset: isComplete ? 0 : processedCount,
        last_batch_size: movimentacoesList.length,
        ...(isComplete && { last_complete_run: new Date().toISOString() }),
      };

      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          metadata: newMetadata,
          ultima_execucao: new Date().toISOString(),
        })
        .eq('id', configData.id);
    }

    const percentage = totalMovimentacoes > 0 ? Math.round((processedCount / totalMovimentacoes) * 100) : 100;
    const totalTime = Date.now() - startTime;
    
    console.log(`Batch complete in ${totalTime}ms. Progress: ${processedCount}/${totalMovimentacoes} (${percentage}%). isComplete=${isComplete}`);

    return new Response(
      JSON.stringify({
        success: true,
        alertasGerados,
        alertasCriados: alertasGerados,
        audienciasDetectadas,
        intimacoesDetectadas,
        movimentacoesVerificadas: movimentacoesList.length,
        processosVerificados: movimentacoesList.length,
        termosAtivos: termos.length,
        tempoExecucao: `${totalTime}ms`,
        isComplete,
        completedRun: isComplete,
        progress: {
          current: processedCount,
          total: totalMovimentacoes,
          percentage,
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
