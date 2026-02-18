import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATAJUD_API_KEY = 'APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

// Configuração de batch
const TRIBUNAIS_PER_BATCH = 10;
const MAX_PARALLEL_REQUESTS = 3;

// Todos os tribunais disponíveis
const TODOS_TRIBUNAIS = {
  estaduais: [
    { endpoint: 'api_publica_tjsp', nome: 'TJSP' },
    { endpoint: 'api_publica_tjrj', nome: 'TJRJ' },
    { endpoint: 'api_publica_tjmg', nome: 'TJMG' },
    { endpoint: 'api_publica_tjdft', nome: 'TJDFT' },
    { endpoint: 'api_publica_tjgo', nome: 'TJGO' },
    { endpoint: 'api_publica_tjba', nome: 'TJBA' },
    { endpoint: 'api_publica_tjpr', nome: 'TJPR' },
    { endpoint: 'api_publica_tjrs', nome: 'TJRS' },
    { endpoint: 'api_publica_tjsc', nome: 'TJSC' },
    { endpoint: 'api_publica_tjpe', nome: 'TJPE' },
    { endpoint: 'api_publica_tjce', nome: 'TJCE' },
    { endpoint: 'api_publica_tjal', nome: 'TJAL' },
    { endpoint: 'api_publica_tjam', nome: 'TJAM' },
    { endpoint: 'api_publica_tjap', nome: 'TJAP' },
    { endpoint: 'api_publica_tjes', nome: 'TJES' },
    { endpoint: 'api_publica_tjma', nome: 'TJMA' },
    { endpoint: 'api_publica_tjms', nome: 'TJMS' },
    { endpoint: 'api_publica_tjmt', nome: 'TJMT' },
    { endpoint: 'api_publica_tjpa', nome: 'TJPA' },
    { endpoint: 'api_publica_tjpb', nome: 'TJPB' },
    { endpoint: 'api_publica_tjpi', nome: 'TJPI' },
    { endpoint: 'api_publica_tjrn', nome: 'TJRN' },
    { endpoint: 'api_publica_tjro', nome: 'TJRO' },
    { endpoint: 'api_publica_tjrr', nome: 'TJRR' },
    { endpoint: 'api_publica_tjse', nome: 'TJSE' },
    { endpoint: 'api_publica_tjto', nome: 'TJTO' },
  ],
  federais: [
    { endpoint: 'api_publica_trf1', nome: 'TRF1' },
    { endpoint: 'api_publica_trf2', nome: 'TRF2' },
    { endpoint: 'api_publica_trf3', nome: 'TRF3' },
    { endpoint: 'api_publica_trf4', nome: 'TRF4' },
    { endpoint: 'api_publica_trf5', nome: 'TRF5' },
    { endpoint: 'api_publica_trf6', nome: 'TRF6' },
  ],
  trabalhistas: [
    { endpoint: 'api_publica_trt1', nome: 'TRT1' },
    { endpoint: 'api_publica_trt2', nome: 'TRT2' },
    { endpoint: 'api_publica_trt3', nome: 'TRT3' },
    { endpoint: 'api_publica_trt4', nome: 'TRT4' },
    { endpoint: 'api_publica_trt5', nome: 'TRT5' },
    { endpoint: 'api_publica_trt6', nome: 'TRT6' },
    { endpoint: 'api_publica_trt7', nome: 'TRT7' },
    { endpoint: 'api_publica_trt8', nome: 'TRT8' },
    { endpoint: 'api_publica_trt9', nome: 'TRT9' },
    { endpoint: 'api_publica_trt10', nome: 'TRT10' },
    { endpoint: 'api_publica_trt11', nome: 'TRT11' },
    { endpoint: 'api_publica_trt12', nome: 'TRT12' },
    { endpoint: 'api_publica_trt13', nome: 'TRT13' },
    { endpoint: 'api_publica_trt14', nome: 'TRT14' },
    { endpoint: 'api_publica_trt15', nome: 'TRT15' },
    { endpoint: 'api_publica_trt16', nome: 'TRT16' },
    { endpoint: 'api_publica_trt17', nome: 'TRT17' },
    { endpoint: 'api_publica_trt18', nome: 'TRT18' },
    { endpoint: 'api_publica_trt19', nome: 'TRT19' },
    { endpoint: 'api_publica_trt20', nome: 'TRT20' },
    { endpoint: 'api_publica_trt21', nome: 'TRT21' },
    { endpoint: 'api_publica_trt22', nome: 'TRT22' },
    { endpoint: 'api_publica_trt23', nome: 'TRT23' },
    { endpoint: 'api_publica_trt24', nome: 'TRT24' },
  ],
};

function escapeQueryString(value: string): string {
  return value.replace(/([+\-=&|><!(){}\[\]^"~*?:\\/])/g, "\\$1");
}

function buildDistribuicaoQuery(searchTerm: string, tipo: string, dataInicioISO: string) {
  const term = (searchTerm || '').trim();
  const safeTerm = escapeQueryString(term);

  let mustQuery: any = { match_all: {} };

  if (term) {
    if (tipo === 'cpf_cnpj') {
      const digits = term.replace(/\D/g, '');
      const safeDigits = escapeQueryString(digits);
      mustQuery = {
        query_string: {
          query: safeDigits,
          fields: [
            'partes.pessoa.numeroDocumentoPrincipal',
            'partes.pessoa.cpf',
            'partes.pessoa.cnpj',
            '*',
          ],
          default_operator: 'AND',
        },
      };
    } else if (tipo === 'oab') {
      const oabParts = term.match(/(\d+)/);
      const oabNumero = oabParts ? oabParts[1] : term;
      const safeOab = escapeQueryString(oabNumero);
      mustQuery = {
        query_string: {
          query: safeOab,
          fields: [
            'partes.advogados.inscricao',
            'partes.advogado.inscricao',
            '*',
          ],
          default_operator: 'AND',
        },
      };
    } else {
      mustQuery = {
        query_string: {
          query: `\"${safeTerm}\" OR (${safeTerm})`,
          fields: [
            'partes.nome',
            'partes.pessoa.nome',
            '*',
          ],
          default_operator: 'AND',
        },
      };
    }
  }

  return {
    size: 30,
    query: {
      bool: {
        must: [mustQuery],
        filter: [{ range: { dataAjuizamento: { gte: dataInicioISO } } }],
      },
    },
    sort: [{ dataAjuizamento: { order: 'desc' } }],
  };
}

async function searchProcessos(endpoint: string, searchTerm: string, tipo: string): Promise<any[]> {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;

  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - 30);
  const dataInicioISO = dataInicio.toISOString().split('T')[0];

  const body = buildDistribuicaoQuery(searchTerm, tipo, dataInicioISO);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: DATAJUD_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`DataJud error (${endpoint}):`, response.status, errorText);
      return [];
    }

    const data = await response.json();
    return data.hits?.hits || [];
  } catch (error) {
    console.error(`Erro ao buscar em ${endpoint}:`, error);
    return [];
  }
}

function extrairPartes(input: any): { poloAtivo: string; poloPassivo: string } {
  const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

  if (Array.isArray(input) && input.length > 0 && typeof input[0] === 'object' && 'parte' in input[0]) {
    let poloAtivo = '';
    let poloPassivo = '';

    for (const polo of input || []) {
      const partes = (polo as any).parte || [];
      const nomes = partes.map((p: any) => p.pessoa?.nome).filter(Boolean).join(', ');

      if ((polo as any).polo === 'AT' || (polo as any).polo === 'ATIVO') {
        poloAtivo = nomes;
      } else if ((polo as any).polo === 'PA' || (polo as any).polo === 'PASSIVO') {
        poloPassivo = nomes;
      }
    }

    return { poloAtivo, poloPassivo };
  }

  const poloAtivoArr: string[] = [];
  const poloPassivoArr: string[] = [];

  if (!Array.isArray(input)) return { poloAtivo: '', poloPassivo: '' };

  for (const parte of input) {
    const nome = parte?.nome || parte?.pessoa?.nome || '';
    if (!nome) continue;

    const polo = String(parte?.polo || parte?.tipoParte || '').toUpperCase();

    if (
      polo.includes('AT') ||
      polo.includes('ATIVO') ||
      polo.includes('AUTOR') ||
      polo.includes('REQUERENTE') ||
      polo.includes('RECLAMANTE') ||
      polo.includes('EXEQUENTE')
    ) {
      poloAtivoArr.push(nome);
    } else if (
      polo.includes('PA') ||
      polo.includes('PASSIVO') ||
      polo.includes('REU') ||
      polo.includes('RÉU') ||
      polo.includes('REQUERIDO') ||
      polo.includes('RECLAMADO') ||
      polo.includes('EXECUTADO')
    ) {
      poloPassivoArr.push(nome);
    }
  }

  return {
    poloAtivo: unique(poloAtivoArr).join(', '),
    poloPassivo: unique(poloPassivoArr).join(', '),
  };
}

function getTribunaisParaMonitoramento(monitoramento: any): { endpoint: string; nome: string }[] {
  const allTribunais = [
    ...TODOS_TRIBUNAIS.estaduais,
    ...TODOS_TRIBUNAIS.federais,
    ...TODOS_TRIBUNAIS.trabalhistas,
  ];

  if (monitoramento.tribunal) {
    const tribunaisSelecionados = monitoramento.tribunal.split(',').map((t: string) => t.trim().toUpperCase());
    const result: { endpoint: string; nome: string }[] = [];
    
    for (const tribunalSelecionado of tribunaisSelecionados) {
      const found = allTribunais.find(t => {
        const nomeNormalizado = t.nome.toUpperCase();
        return nomeNormalizado === tribunalSelecionado || 
               t.endpoint.toUpperCase().includes(tribunalSelecionado.replace(/\s/g, ''));
      });
      if (found && !result.find(e => e.endpoint === found.endpoint)) {
        result.push(found);
      }
    }
    return result;
  }
  
  if (monitoramento.uf) {
    const ufMap: Record<string, string[]> = {
      'SP': ['api_publica_tjsp', 'api_publica_trt2'],
      'RJ': ['api_publica_tjrj', 'api_publica_trt1'],
      'MG': ['api_publica_tjmg', 'api_publica_trt3'],
      'DF': ['api_publica_tjdft', 'api_publica_trt10'],
      'GO': ['api_publica_tjgo', 'api_publica_trt18'],
      'BA': ['api_publica_tjba', 'api_publica_trt5'],
      'PR': ['api_publica_tjpr', 'api_publica_trt9'],
      'RS': ['api_publica_tjrs', 'api_publica_trt4'],
      'SC': ['api_publica_tjsc', 'api_publica_trt12'],
      'PE': ['api_publica_tjpe', 'api_publica_trt6'],
      'CE': ['api_publica_tjce', 'api_publica_trt7'],
      'AL': ['api_publica_tjal', 'api_publica_trt19'],
      'AM': ['api_publica_tjam', 'api_publica_trt11'],
      'AP': ['api_publica_tjap', 'api_publica_trt8'],
      'ES': ['api_publica_tjes', 'api_publica_trt17'],
      'MA': ['api_publica_tjma', 'api_publica_trt16'],
      'MS': ['api_publica_tjms', 'api_publica_trt24'],
      'MT': ['api_publica_tjmt', 'api_publica_trt23'],
      'PA': ['api_publica_tjpa', 'api_publica_trt8'],
      'PB': ['api_publica_tjpb', 'api_publica_trt13'],
      'PI': ['api_publica_tjpi', 'api_publica_trt22'],
      'RN': ['api_publica_tjrn', 'api_publica_trt21'],
      'RO': ['api_publica_tjro', 'api_publica_trt14'],
      'RR': ['api_publica_tjrr', 'api_publica_trt11'],
      'SE': ['api_publica_tjse', 'api_publica_trt20'],
      'TO': ['api_publica_tjto', 'api_publica_trt10'],
    };
    const endpoints = ufMap[monitoramento.uf] || [];
    return allTribunais.filter(t => endpoints.includes(t.endpoint));
  }
  
  return allTribunais;
}

// Processa um único lote
async function processBatch(supabase: any): Promise<{
  isComplete: boolean;
  novasDistribuicoes: number;
  tribunaisProcessados: number;
  errors: string[];
}> {
  // Buscar configuração atual e metadata de progresso
  const { data: config } = await supabase
    .from('configuracoes_monitoramento')
    .select('*')
    .eq('tipo', 'distribuicoes')
    .single();

  const metadata = config?.metadata || {};
  let currentMonitoramentoIndex = metadata.current_monitoramento_index || 0;
  let currentTribunalOffset = metadata.current_tribunal_offset || 0;

  // Buscar monitoramentos ativos
  const { data: monitoramentos, error: monitoramentosError } = await supabase
    .from('monitoramentos_distribuicao')
    .select('*')
    .eq('ativo', true)
    .order('created_at', { ascending: true });

  if (monitoramentosError) throw monitoramentosError;

  if (!monitoramentos || monitoramentos.length === 0) {
    console.log('No active monitorings found');
    return { isComplete: true, novasDistribuicoes: 0, tribunaisProcessados: 0, errors: [] };
  }

  // Resetar índice se exceder
  if (currentMonitoramentoIndex >= monitoramentos.length) {
    currentMonitoramentoIndex = 0;
    currentTribunalOffset = 0;
  }

  const monitoramento = monitoramentos[currentMonitoramentoIndex];
  const tribunais = getTribunaisParaMonitoramento(monitoramento);
  
  console.log(`Processing: ${monitoramento.tipo} - ${monitoramento.termo_busca}`);
  console.log(`Tribunais: ${tribunais.length}, Offset: ${currentTribunalOffset}`);

  const tribunaisBatch = tribunais.slice(currentTribunalOffset, currentTribunalOffset + TRIBUNAIS_PER_BATCH);
  
  let totalNovasDistribuicoes = 0;
  const errors: string[] = [];

  // Processar tribunais em paralelo (limitado)
  for (let i = 0; i < tribunaisBatch.length; i += MAX_PARALLEL_REQUESTS) {
    const chunk = tribunaisBatch.slice(i, i + MAX_PARALLEL_REQUESTS);
    
    const results = await Promise.all(
      chunk.map(async (tribunal) => {
        try {
          const resultados = await searchProcessos(
            tribunal.endpoint,
            monitoramento.termo_busca,
            monitoramento.tipo
          );
          
          console.log(`  ${tribunal.nome}: ${resultados.length} resultados`);
          
          let novasDistribuicoes = 0;
          
          for (const hit of resultados) {
            const source = hit?._source || {};
            const dadosBasicos = (source as any)?.dadosBasicos || {};

            const numeroProcesso = (source as any)?.numeroProcesso || dadosBasicos.numero || (source as any)?.numero;
            if (!numeroProcesso) continue;

            // Verificar se já existe na tabela de distribuições
            const { data: existing } = await supabase
              .from('distribuicoes_encontradas')
              .select('id')
              .eq('numero_processo', numeroProcesso)
              .eq('monitoramento_id', monitoramento.id)
              .maybeSingle();

            if (existing) continue;

            // Verificar se já existe como processo no sistema
            const { data: processoExistente } = await supabase
              .from('processos')
              .select('id')
              .eq('numero', numeroProcesso)
              .maybeSingle();

            if (processoExistente) continue;

            const partesInput = (source as any)?.partes ?? dadosBasicos.polo ?? [];
            const { poloAtivo, poloPassivo } = extrairPartes(partesInput);

            const vara = (source as any)?.orgaoJulgador?.nome || dadosBasicos.orgaoJulgador?.nomeOrgao || null;
            const classe = (source as any)?.classe?.nome || dadosBasicos.classeProcessual?.nome || null;
            const assunto = (source as any)?.assuntos?.[0]?.nome || dadosBasicos.assunto?.[0]?.nome || null;
            const dataDistribuicao = (source as any)?.dataAjuizamento || dadosBasicos.dataAjuizamento || null;

            // Inserir nova distribuição
            const { error: insertError } = await supabase
              .from('distribuicoes_encontradas')
              .insert({
                monitoramento_id: monitoramento.id,
                numero_processo: numeroProcesso,
                tribunal: tribunal.nome,
                vara,
                classe,
                assunto,
                polo_ativo: poloAtivo || null,
                polo_passivo: poloPassivo || null,
                data_distribuicao: dataDistribuicao,
                dados_completos: source,
                status: 'pendente',
              });

            if (insertError) {
              console.error('Insert error:', insertError);
            } else {
              novasDistribuicoes++;

              // Get all users to notify (creator + admins + coordinators)
              const usersToNotify: string[] = [monitoramento.criado_por];
              
              const { data: adminUsers } = await supabase
                .from('user_roles')
                .select('user_id')
                .in('role', ['admin', 'coordenador']);
              
              adminUsers?.forEach((u: any) => {
                if (!usersToNotify.includes(u.user_id)) {
                  usersToNotify.push(u.user_id);
                }
              });

              // Criar notificações para todos
              for (const userId of usersToNotify) {
                await supabase.from('notificacoes').insert({
                  usuario_id: userId,
                  tipo: 'warning',
                  titulo: 'Nova distribuição detectada',
                  mensagem: `Processo ${numeroProcesso} encontrado no ${tribunal.nome} - ${monitoramento.termo_busca}`,
                  link: '/monitoramento-distribuicao',
                });
              }

              // NOTA: O envio de alertas externos agora é consolidado em um resumo único ao finalizar
              // a execução completa do monitoramento (ver enviar-resumo-monitoramento)
              // Isso evita bombardeio de mensagens individuais para cada distribuição
            }
          }
          
          return { tribunal: tribunal.nome, novasDistribuicoes };
        } catch (error) {
          console.error(`Error in ${tribunal.nome}:`, error);
          return { tribunal: tribunal.nome, error: String(error) };
        }
      })
    );
    
    for (const result of results) {
      if ('error' in result) {
        errors.push(`${result.tribunal}: ${result.error}`);
      } else if (result.novasDistribuicoes > 0) {
        totalNovasDistribuicoes += result.novasDistribuicoes;
      }
    }
  }

  // Calcular próximo estado
  let nextMonitoramentoIndex = currentMonitoramentoIndex;
  let nextTribunalOffset = currentTribunalOffset + TRIBUNAIS_PER_BATCH;
  let completedRun = false;

  // Se terminamos todos os tribunais deste monitoramento
  if (nextTribunalOffset >= tribunais.length) {
    nextTribunalOffset = 0;
    nextMonitoramentoIndex++;
    
    // Atualizar última execução do monitoramento
    await supabase
      .from('monitoramentos_distribuicao')
      .update({ ultima_execucao: new Date().toISOString() })
      .eq('id', monitoramento.id);
  }

  // Se terminamos todos os monitoramentos
  if (nextMonitoramentoIndex >= monitoramentos.length) {
    nextMonitoramentoIndex = 0;
    completedRun = true;
  }

  // Atualizar metadata de progresso
  await supabase
    .from('configuracoes_monitoramento')
    .update({
      ultima_execucao: new Date().toISOString(),
      metadata: {
        current_monitoramento_index: nextMonitoramentoIndex,
        current_tribunal_offset: nextTribunalOffset,
        last_complete_run: completedRun ? new Date().toISOString() : metadata.last_complete_run,
        last_batch_size: tribunaisBatch.length,
      },
    })
    .eq('tipo', 'distribuicoes');

  console.log(`Batch completed: ${tribunaisBatch.length} tribunais, ${totalNovasDistribuicoes} novas distribuições`);

  return {
    isComplete: completedRun,
    novasDistribuicoes: totalNovasDistribuicoes,
    tribunaisProcessados: tribunaisBatch.length,
    errors,
  };
}

async function updateExecucaoAgendada(
  supabase: any,
  execucaoId: string | undefined,
  payload: {
    status?: string;
    finalizado_em?: string | null;
    lotes_processados?: number;
    total_lotes?: number | null;
    registros_processados?: number;
    registros_encontrados?: number;
    erros?: number;
    ultimo_erro?: string | null;
    detalhes?: Record<string, any>;
  }
) {
  if (!execucaoId) return;
  try {
    await supabase.from('execucoes_agendadas').update(payload).eq('id', execucaoId);
  } catch (e) {
    console.error('[Distribuicoes] Falha ao atualizar execucoes_agendadas:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for parameters
    let completeRun = false;
    let execucaoId: string | undefined;
    try {
      const body = await req.json();
      completeRun = body?.completeRun === true;
      execucaoId = body?.execucaoId;
    } catch {
      // No body or invalid JSON, proceed with single batch
    }

    console.log(`Starting distribution monitoring... (completeRun: ${completeRun})`);

    // Para o dashboard: total = total de tribunais a varrer em todos os monitoramentos ativos.
    // (estimativa calculada 1x por execução)
    let totalTribunaisEstimado: number | null = null;
    try {
      const { data: monitoramentosAtivos } = await supabase
        .from('monitoramentos_distribuicao')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: true });

      if (monitoramentosAtivos && monitoramentosAtivos.length > 0) {
        totalTribunaisEstimado = monitoramentosAtivos.reduce((acc: number, m: any) => {
          try {
            return acc + getTribunaisParaMonitoramento(m).length;
          } catch {
            return acc;
          }
        }, 0);
      } else {
        totalTribunaisEstimado = 0;
      }
    } catch (e) {
      console.warn('[Distribuicoes] Não foi possível estimar total de tribunais:', e);
      totalTribunaisEstimado = null;
    }

    if (completeRun) {
      // Execute complete run - process all batches until done
      let totalNovasDistribuicoes = 0;
      let totalTribunaisProcessados = 0;
      let allErrors: string[] = [];
      let batchCount = 0;

      while (true) {
        batchCount++;
        console.log(`Processing batch ${batchCount}...`);

        // CANCELAMENTO PERSISTENTE: verificar flag antes de cada lote
        const { data: freshConfig } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('tipo', 'distribuicoes')
          .maybeSingle();

        const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;

        if (wasCancelled) {
          console.log('[Distribuicoes] Cancelamento detectado, parando execução');
          // Limpa flag e atualiza status
          const currentMeta = (freshConfig?.metadata as Record<string, any>) || {};
          await supabase
            .from('configuracoes_monitoramento')
            .update({
              metadata: { ...currentMeta, cancelado: false, status: 'cancelado' },
            })
            .eq('tipo', 'distribuicoes');

          await updateExecucaoAgendada(supabase, execucaoId, {
            status: 'cancelado',
            finalizado_em: new Date().toISOString(),
            lotes_processados: totalTribunaisProcessados,
            total_lotes: totalTribunaisEstimado,
            registros_processados: totalTribunaisProcessados,
            registros_encontrados: totalNovasDistribuicoes,
            detalhes: {
              cancelled: true,
              progress: {
                current: totalTribunaisProcessados,
                total: totalTribunaisEstimado ?? 0,
                percentage: totalTribunaisEstimado && totalTribunaisEstimado > 0
                  ? Math.min(100, Math.round((totalTribunaisProcessados / totalTribunaisEstimado) * 100))
                  : 0,
              },
            },
          });
          break;
        }
        
        const { isComplete, novasDistribuicoes, tribunaisProcessados, errors } = await processBatch(supabase);
        
        totalNovasDistribuicoes += novasDistribuicoes;
        totalTribunaisProcessados += tribunaisProcessados;
        allErrors = [...allErrors, ...errors];

        // Atualiza painel em tempo real (por lote)
        await updateExecucaoAgendada(supabase, execucaoId, {
          status: isComplete ? 'concluido' : 'executando',
          finalizado_em: isComplete ? new Date().toISOString() : null,
          lotes_processados: totalTribunaisProcessados,
          total_lotes: totalTribunaisEstimado,
          registros_processados: totalTribunaisProcessados,
          registros_encontrados: totalNovasDistribuicoes,
          erros: allErrors.length,
          ultimo_erro: allErrors.length ? allErrors[allErrors.length - 1] : null,
          detalhes: {
            batchCount,
            completedRun: isComplete,
            novasDistribuicoes: totalNovasDistribuicoes,
            tribunaisProcessados: totalTribunaisProcessados,
            progress: {
              current: totalTribunaisProcessados,
              total: totalTribunaisEstimado ?? 0,
              percentage: totalTribunaisEstimado && totalTribunaisEstimado > 0
                ? Math.min(100, Math.round((totalTribunaisProcessados / totalTribunaisEstimado) * 100))
                : 0,
            },
          },
        });

        if (isComplete) {
          console.log(`Complete run finished after ${batchCount} batches`);
          
          // Salvar no histórico de monitoramento
          await supabase.from('historico_monitoramento').insert({
            tipo: 'distribuicoes',
            processos_verificados: totalTribunaisProcessados,
            novos_andamentos: totalNovasDistribuicoes,
            processos_com_novos: totalNovasDistribuicoes,
            erros: allErrors.length,
            detalhes: {
              batchCount,
              errors: allErrors.length > 0 ? allErrors.slice(0, 10) : undefined,
            },
            executado_em: new Date().toISOString(),
          });

          // Enviar resumo por coordenação ao concluir run completo
          if (totalNovasDistribuicoes > 0) {
            try {
              const hoje = new Date();
              const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();

              // Buscar distribuições encontradas hoje com coordenação vinculada
              const { data: distribsHoje } = await supabase
                .from('distribuicoes_encontradas')
                .select(`
                  id,
                  numero_processo,
                  polo_ativo,
                  polo_passivo,
                  tribunal,
                  classe,
                  assunto,
                  monitoramento_id,
                  monitoramentos_distribuicao!inner (
                    id,
                    coordenacao_id,
                    coordenacoes (id, nome)
                  )
                `)
                .gte('created_at', inicioDoDia);

              if (distribsHoje && distribsHoje.length > 0) {
                // Agrupar por coordenação
                const porCoordenacao = new Map<string, {
                  coordenacao_id: string;
                  coordenacao_nome: string;
                  total_encontrados: number;
                  total_verificados: number;
                  exemplos: Array<{ processo_numero: string; descricao: string }>;
                }>();

                for (const dist of distribsHoje) {
                  const mon = (dist as any).monitoramentos_distribuicao;
                  if (!mon?.coordenacao_id) continue;

                  const coordId = mon.coordenacao_id;
                  const coordNome = mon.coordenacoes?.nome || 'Sem nome';

                  if (!porCoordenacao.has(coordId)) {
                    porCoordenacao.set(coordId, {
                      coordenacao_id: coordId,
                      coordenacao_nome: coordNome,
                      total_encontrados: 0,
                      total_verificados: totalTribunaisProcessados,
                      exemplos: [],
                    });
                  }

                  const entry = porCoordenacao.get(coordId)!;
                  entry.total_encontrados++;

                  const descricao = [
                    dist.classe,
                    dist.polo_ativo ? `Polo Ativo: ${dist.polo_ativo}` : null,
                    dist.polo_passivo ? `Polo Passivo: ${dist.polo_passivo}` : null,
                    dist.tribunal ? `Tribunal: ${dist.tribunal}` : null,
                  ].filter(Boolean).join(' | ').substring(0, 200);

                  entry.exemplos.push({
                    processo_numero: dist.numero_processo || 'N/A',
                    descricao: descricao || 'Nova distribuição detectada',
                  });
                }

                const resumos = Array.from(porCoordenacao.values()).filter(r => r.total_encontrados > 0);

                if (resumos.length > 0) {
                  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                  await fetch(`${supabaseUrl}/functions/v1/enviar-resumo-monitoramento`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseKey}`,
                    },
                    body: JSON.stringify({
                      tipo_monitoramento: 'distribuicoes',
                      resumos_por_coordenacao: resumos,
                    }),
                  });
                  console.log(`[Distribuicoes] Resumo enviado para ${resumos.length} coordenação(ões)`);
                }
              }
            } catch (resumoErr) {
              console.warn('[Distribuicoes] Falha ao enviar resumo por coordenação:', resumoErr);
            }
          }
          
          break;
        }

        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Monitoramento completo: ${totalNovasDistribuicoes} novas distribuições encontradas`,
          novasDistribuicoes: totalNovasDistribuicoes,
          tribunaisProcessados: totalTribunaisProcessados,
          completedRun: true,
          batchCount,
          errors: allErrors.length > 0 ? allErrors : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Single batch execution
      const { isComplete, novasDistribuicoes, tribunaisProcessados, errors } = await processBatch(supabase);

      await updateExecucaoAgendada(supabase, execucaoId, {
        status: isComplete ? 'concluido' : 'executando',
        finalizado_em: isComplete ? new Date().toISOString() : null,
        lotes_processados: tribunaisProcessados,
        total_lotes: totalTribunaisEstimado,
        registros_processados: tribunaisProcessados,
        registros_encontrados: novasDistribuicoes,
        erros: errors.length,
        ultimo_erro: errors.length ? errors[errors.length - 1] : null,
        detalhes: {
          completedRun: isComplete,
          progress: {
            current: tribunaisProcessados,
            total: totalTribunaisEstimado ?? 0,
            percentage: totalTribunaisEstimado && totalTribunaisEstimado > 0
              ? Math.min(100, Math.round((tribunaisProcessados / totalTribunaisEstimado) * 100))
              : 0,
          },
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          novasDistribuicoes,
          tribunaisProcessados,
          completedRun: isComplete,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in distribution monitoring:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
