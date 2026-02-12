import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_TIMEOUT_MS = 10_000;

const TRIBUNAL_ENDPOINTS: Record<string, string> = {
  "TJAC": "api_publica_tjac", "TJAL": "api_publica_tjal", "TJAP": "api_publica_tjap",
  "TJAM": "api_publica_tjam", "TJBA": "api_publica_tjba", "TJCE": "api_publica_tjce",
  "TJDFT": "api_publica_tjdft", "TJES": "api_publica_tjes", "TJGO": "api_publica_tjgo",
  "TJMA": "api_publica_tjma", "TJMT": "api_publica_tjmt", "TJMS": "api_publica_tjms",
  "TJMG": "api_publica_tjmg", "TJPA": "api_publica_tjpa", "TJPB": "api_publica_tjpb",
  "TJPR": "api_publica_tjpr", "TJPE": "api_publica_tjpe", "TJPI": "api_publica_tjpi",
  "TJRJ": "api_publica_tjrj", "TJRN": "api_publica_tjrn", "TJRS": "api_publica_tjrs",
  "TJRO": "api_publica_tjro", "TJRR": "api_publica_tjrr", "TJSC": "api_publica_tjsc",
  "TJSE": "api_publica_tjse", "TJSP": "api_publica_tjsp", "TJTO": "api_publica_tjto",
  "TRF1": "api_publica_trf1", "TRF2": "api_publica_trf2", "TRF3": "api_publica_trf3",
  "TRF4": "api_publica_trf4", "TRF5": "api_publica_trf5", "TRF6": "api_publica_trf6",
  "TRT1": "api_publica_trt1", "TRT2": "api_publica_trt2", "TRT3": "api_publica_trt3",
  "TRT4": "api_publica_trt4", "TRT5": "api_publica_trt5", "TRT6": "api_publica_trt6",
  "TRT7": "api_publica_trt7", "TRT8": "api_publica_trt8", "TRT9": "api_publica_trt9",
  "TRT10": "api_publica_trt10", "TRT11": "api_publica_trt11", "TRT12": "api_publica_trt12",
  "TRT13": "api_publica_trt13", "TRT14": "api_publica_trt14", "TRT15": "api_publica_trt15",
  "TRT16": "api_publica_trt16", "TRT17": "api_publica_trt17", "TRT18": "api_publica_trt18",
  "TRT19": "api_publica_trt19", "TRT20": "api_publica_trt20", "TRT21": "api_publica_trt21",
  "TRT22": "api_publica_trt22", "TRT23": "api_publica_trt23", "TRT24": "api_publica_trt24",
  "TST": "api_publica_tst", "STJ": "api_publica_stj", "STM": "api_publica_stm",
  "TSE": "api_publica_tse",
};

const UF_TRIBUNAL: Record<string, string> = {
  AC: "TJAC", AL: "TJAL", AP: "TJAP", AM: "TJAM", BA: "TJBA", CE: "TJCE",
  DF: "TJDFT", ES: "TJES", GO: "TJGO", MA: "TJMA", MT: "TJMT", MS: "TJMS",
  MG: "TJMG", PA: "TJPA", PB: "TJPB", PR: "TJPR", PE: "TJPE", PI: "TJPI",
  RJ: "TJRJ", RN: "TJRN", RS: "TJRS", RO: "TJRO", RR: "TJRR", SC: "TJSC",
  SE: "TJSE", SP: "TJSP", TO: "TJTO",
};

interface MonitoramentoDjen {
  id: string;
  termo_busca: string;
  tipo: string;
  oab: string | null;
  uf: string | null;
  coordenacao_id: string;
  tribunais_ufs: string[] | null;
}

function getTribunaisParaBuscar(mon: MonitoramentoDjen): string[] {
  if (mon.tribunais_ufs && mon.tribunais_ufs.length > 0) {
    const result: string[] = [];
    for (const item of mon.tribunais_ufs) {
      const upper = item.toUpperCase();
      if (UF_TRIBUNAL[upper]) result.push(UF_TRIBUNAL[upper]);
      else if (TRIBUNAL_ENDPOINTS[upper]) result.push(upper);
    }
    return [...new Set(result)];
  }
  if (mon.tipo === 'advogado' && mon.uf) {
    const tj = UF_TRIBUNAL[mon.uf.toUpperCase()];
    return tj ? [tj] : [];
  }
  return Object.values(UF_TRIBUNAL);
}

/**
 * Constrói a query Elasticsearch de acordo com o TIPO do monitoramento.
 * - advogado: busca pelo nome do advogado em campos de representação/texto geral
 * - parte: busca pelo nome da parte nos campos de partes processuais
 * - palavras-chave (default): busca em complementos de movimentações + assuntos
 */
function buildSearchQuery(mon: MonitoramentoDjen, dataInicio: string, dataFim: string) {
  const termo = mon.termo_busca.trim();
  const dateFilter = { range: { "dataHoraUltimaAtualizacao": { gte: dataInicio, lte: dataFim } } };

  if (mon.tipo === 'advogado') {
    // Advogado: busca multi_match no nome do advogado + OAB
    // Campos relevantes: texto geral (catch-all), representantes, movimentos
    const shouldClauses: any[] = [
      { match_phrase: { "_all": termo } },
      { query_string: { query: `"${termo}"`, default_operator: "AND" } },
    ];
    // Se tiver OAB, busca também pelo número
    if (mon.oab) {
      shouldClauses.push({ match: { "_all": mon.oab } });
      shouldClauses.push({ query_string: { query: `"${mon.oab}"` } });
    }
    return {
      query: {
        bool: {
          must: [dateFilter],
          should: shouldClauses,
          minimum_should_match: 1,
        }
      },
      size: 20,
      _source: ["numeroProcesso", "classe.nome", "orgaoJulgador.nome", "movimentos", "dataAjuizamento", "assuntos"],
      sort: [{ "dataHoraUltimaAtualizacao": { order: "desc" } }]
    };
  }

  if (mon.tipo === 'parte') {
    // Parte: busca pelo nome da parte em campos genéricos
    return {
      query: {
        bool: {
          must: [
            dateFilter,
            {
              bool: {
                should: [
                  { match_phrase: { "_all": termo } },
                  { query_string: { query: `"${termo}"`, default_operator: "AND" } },
                ],
                minimum_should_match: 1,
              }
            }
          ],
        }
      },
      size: 20,
      _source: ["numeroProcesso", "classe.nome", "orgaoJulgador.nome", "movimentos", "dataAjuizamento", "assuntos"],
      sort: [{ "dataHoraUltimaAtualizacao": { order: "desc" } }]
    };
  }

  // Palavras-chave (default): busca em complementos de movimentações E assuntos
  return {
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                { match_phrase: { "movimentos.complementosTabelados.descricao": termo } },
                { match_phrase: { "assuntos.nome": termo } },
                { query_string: { query: `"${termo}"`, default_operator: "AND" } },
              ],
              minimum_should_match: 1,
            }
          }
        ],
        filter: [dateFilter]
      }
    },
    size: 20,
    _source: ["numeroProcesso", "classe.nome", "orgaoJulgador.nome", "movimentos", "dataAjuizamento", "assuntos"],
    sort: [{ "dataHoraUltimaAtualizacao": { order: "desc" } }]
  };
}

async function buscarDataJud(tribunal: string, query: object): Promise<any[]> {
  const endpoint = TRIBUNAL_ENDPOINTS[tribunal];
  if (!endpoint) return [];

  const url = `${DATAJUD_BASE}/${endpoint}/_search`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `ApiKey ${DATAJUD_API_KEY}` },
      body: JSON.stringify(query),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) { console.warn(`DataJud ${tribunal}: HTTP ${resp.status}`); return []; }
    const data = await resp.json();
    return data?.hits?.hits?.map((h: any) => h._source) || [];
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') console.warn(`DataJud ${tribunal}: timeout`);
    else console.warn(`DataJud ${tribunal}: ${e.message}`);
    return [];
  }
}

function extrairMovimentacoes(source: any, tribunal: string, monId: string, coordId: string) {
  const numero = source.numeroProcesso || '';
  const classe = source.classe?.nome || '';
  const orgao = source.orgaoJulgador?.nome || '';
  const assuntos = (source.assuntos || []).map((a: any) => a.nome || '').filter(Boolean).join('; ');
  const movs = source.movimentos || [];
  const records: any[] = [];

  for (const mov of movs) {
    const tipo = mov.nome || mov.codigo?.toString() || 'Movimentação';
    const dataStr = mov.dataHora?.substring(0, 10) || null;
    const complementos = (mov.complementosTabelados || [])
      .map((c: any) => c.descricao || c.nome || '')
      .filter(Boolean)
      .join(' | ');

    records.push({
      monitoramento_id: monId, coordenacao_id: coordId,
      numero_processo: numero, tribunal,
      orgao_julgador: orgao,
      tipo_movimentacao: tipo.substring(0, 200),
      data_movimentacao: dataStr,
      complemento: complementos.substring(0, 2000) || null,
      classe_processual: classe || null,
      assuntos: assuntos || null,
    });
  }

  if (records.length === 0 && numero) {
    records.push({
      monitoramento_id: monId, coordenacao_id: coordId,
      numero_processo: numero, tribunal,
      orgao_julgador: orgao,
      tipo_movimentacao: 'Processo encontrado',
      data_movimentacao: null,
      complemento: `Classe: ${classe}`,
      classe_processual: classe || null,
      assuntos: assuntos || null,
    });
  }
  return records;
}

async function updateMetadata(supabase: any, metadata: Record<string, any>) {
  await supabase
    .from('configuracoes_monitoramento')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('tipo', 'datajud_termos')
    .is('coordenacao_id', null);
}

async function updateExecucao(supabase: any, execId: string, updates: Record<string, any>) {
  await supabase.from('execucoes_agendadas').update(updates).eq('id', execId);
}

// ========== BACKGROUND PROCESSING ==========
async function processDataJud(
  execucaoId: string,
  diasBusca: number,
  filtros?: { coordenacaoId?: string; monitoramentoIds?: string[] },
) {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startTime = Date.now();

  try {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - diasBusca);
    const dataInicio = inicio.toISOString().substring(0, 10);
    const dataFim = hoje.toISOString().substring(0, 10);

    // Mark as running
    await updateMetadata(supabaseClient, {
      status: 'em_andamento',
      started_at: new Date().toISOString(),
      execucaoId,
      novas: 0, duplicadas: 0, tribunaisProcessados: 0, erros: [],
      filtros: filtros || null,
    });

    await updateExecucao(supabaseClient, execucaoId, {
      status: 'executando',
      iniciado_em: new Date().toISOString(),
    });

    // Fetch active DJEN monitorings (with optional filters)
    let query = supabaseClient
      .from('monitoramentos_djen')
      .select('id, termo_busca, tipo, oab, uf, coordenacao_id, tribunais_ufs')
      .eq('ativo', true);

    if (filtros?.coordenacaoId) {
      query = query.eq('coordenacao_id', filtros.coordenacaoId);
    }
    if (filtros?.monitoramentoIds && filtros.monitoramentoIds.length > 0) {
      query = query.in('id', filtros.monitoramentoIds);
    }

    const { data: monitoramentos, error: monErr } = await query;

    if (monErr) throw monErr;
    if (!monitoramentos || monitoramentos.length === 0) {
      await updateMetadata(supabaseClient, { status: 'concluido', novas: 0, duplicadas: 0, tribunaisProcessados: 0, monitoramentos: 0 });
      await updateExecucao(supabaseClient, execucaoId, {
        status: 'concluido', finalizado_em: new Date().toISOString(),
        registros_processados: 0, registros_encontrados: 0,
        detalhes: { novas: 0, duplicadas: 0, tribunaisProcessados: 0 },
      });
      return;
    }

    // Calculate total tribunais for progress
    let totalTribunaisEstimado = 0;
    for (const mon of monitoramentos as MonitoramentoDjen[]) {
      totalTribunaisEstimado += getTribunaisParaBuscar(mon).length;
    }

    let totalNovas = 0, totalDuplicadas = 0, totalTribunais = 0;
    const totalErros: string[] = [];
    let monProcessados = 0;

    for (const mon of monitoramentos as MonitoramentoDjen[]) {
      const tribunais = getTribunaisParaBuscar(mon);
      const query = buildSearchQuery(mon, dataInicio, dataFim);

      for (const tribunal of tribunais) {
        try {
          const resultados = await buscarDataJud(tribunal, query);
          totalTribunais++;

          if (resultados.length > 0) {
            const records: any[] = [];
            for (const source of resultados) {
              records.push(...extrairMovimentacoes(source, tribunal, mon.id, mon.coordenacao_id));
            }

            if (records.length > 0) {
              const { data: inserted, error: insertErr } = await supabaseClient
                .from('movimentacoes_datajud')
                .upsert(records, {
                  onConflict: 'monitoramento_id,numero_processo,data_movimentacao,tipo_movimentacao',
                  ignoreDuplicates: true,
                })
                .select('id');

              if (insertErr) {
                console.warn(`Insert error ${tribunal}: ${insertErr.message}`);
                totalErros.push(`${tribunal}: ${insertErr.message}`);
              } else {
                const newCount = inserted?.length || 0;
                totalNovas += newCount;
                totalDuplicadas += records.length - newCount;
              }
            }
          }
        } catch (e: any) {
          totalErros.push(`${tribunal}: ${e.message}`);
        }

        // Update progress every 3 tribunais
        if (totalTribunais % 3 === 0) {
          const pct = totalTribunaisEstimado > 0 ? Math.round((totalTribunais / totalTribunaisEstimado) * 100) : 0;
          await updateMetadata(supabaseClient, {
            status: 'em_andamento',
            novas: totalNovas, duplicadas: totalDuplicadas,
            tribunaisProcessados: totalTribunais,
            totalTribunais: totalTribunaisEstimado,
            monitoramentosProcessados: monProcessados,
            percentage: pct,
            termoAtual: mon.termo_busca,
            termoTipo: mon.tipo,
          });
          await updateExecucao(supabaseClient, execucaoId, {
            registros_processados: totalTribunais,
            registros_encontrados: totalNovas,
            total_lotes: totalTribunaisEstimado,
            lotes_processados: totalTribunais,
            detalhes: {
              novas: totalNovas, duplicadas: totalDuplicadas,
              tribunaisProcessados: totalTribunais,
              totalTribunais: totalTribunaisEstimado,
              progress: { current: totalTribunais, total: totalTribunaisEstimado, percentage: pct },
            },
          });
        }
      }
      monProcessados++;
    }

    const duracao = Math.round((Date.now() - startTime) / 1000);

    // Final metadata
    await updateMetadata(supabaseClient, {
      status: 'concluido',
      novas: totalNovas, duplicadas: totalDuplicadas,
      tribunaisProcessados: totalTribunais,
      totalTribunais: totalTribunaisEstimado,
      monitoramentosProcessados: monProcessados,
      erros: totalErros.slice(0, 10),
      finished_at: new Date().toISOString(),
      diasBusca, duracao,
      percentage: 100,
    });

    await updateExecucao(supabaseClient, execucaoId, {
      status: 'concluido',
      finalizado_em: new Date().toISOString(),
      registros_processados: totalTribunais,
      registros_encontrados: totalNovas,
      total_lotes: totalTribunaisEstimado,
      lotes_processados: totalTribunais,
      detalhes: {
        novas: totalNovas, duplicadas: totalDuplicadas,
        tribunaisProcessados: totalTribunais,
        totalTribunais: totalTribunaisEstimado,
        erros: totalErros.slice(0, 10),
        duracao, diasBusca,
        progress: { current: totalTribunais, total: totalTribunaisEstimado, percentage: 100 },
      },
    });

    console.log(`DataJud concluído: ${totalNovas} novas, ${totalDuplicadas} duplicadas, ${totalTribunais} tribunais em ${duracao}s`);
  } catch (e: any) {
    console.error('Error in processDataJud:', e);
    await updateMetadata(supabaseClient, {
      status: 'erro', erro: e.message,
      finished_at: new Date().toISOString(),
    });
    await updateExecucao(supabaseClient, execucaoId, {
      status: 'falhou',
      finalizado_em: new Date().toISOString(),
      ultimo_erro: e.message,
    });
  }
}

// ========== HANDLER ==========
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    let diasBusca = 7;
    let filtros: { coordenacaoId?: string; monitoramentoIds?: string[] } | undefined;
    let forceReset = false;

    try {
      const body = await req.json();
      if (body?.dias) diasBusca = Math.min(body.dias, 30);
      if (body?.coordenacaoId) {
        filtros = filtros || {};
        filtros.coordenacaoId = body.coordenacaoId;
      }
      if (body?.monitoramentoIds && Array.isArray(body.monitoramentoIds)) {
        filtros = filtros || {};
        filtros.monitoramentoIds = body.monitoramentoIds;
      }
      if (body?.forceReset) forceReset = true;
    } catch { /* use default */ }

    // Force reset: clear metadata and return
    if (forceReset) {
      await updateMetadata(supabaseClient, {
        status: 'idle',
        novas: 0, duplicadas: 0, tribunaisProcessados: 0,
        percentage: 0, erros: [],
      });
      return new Response(JSON.stringify({ status: 'reset', message: 'Estado resetado com sucesso' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create execution record
    const { data: exec, error: execErr } = await supabaseClient
      .from('execucoes_agendadas')
      .insert({
        tipo: 'datajud_termos',
        status: 'executando',
        iniciado_em: new Date().toISOString(),
        detalhes: { diasBusca, filtros },
      })
      .select('id')
      .single();

    if (execErr) throw execErr;

    const execucaoId = exec.id;

    // Use EdgeRuntime.waitUntil to run processing in background
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processDataJud(execucaoId, diasBusca, filtros).catch((err) => {
        console.error('Background processDataJud failed:', err);
      })
    );

    // Return immediately
    return new Response(JSON.stringify({
      status: 'iniciado',
      execucaoId,
      message: 'Processamento DataJud iniciado em background',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Error starting monitorar-datajud-termos:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
