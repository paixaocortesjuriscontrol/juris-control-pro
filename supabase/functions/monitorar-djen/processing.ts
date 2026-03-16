// ============================================================================
// PUBLICATION PROCESSING FUNCTIONS for monitorar-djen
// ============================================================================

import {
  generateHash,
  extractProcessoNumero,
  calcularPrimeiroDiaUtil,
  formatLocalDate,
  extrairDadosLadoEsquerdo,
  conteudoAteLadoEsquerdo,
  extrairLadoEsquerdoDeRawJson,
} from "./utils.ts";

import {
  Monitoramento,
  normalizarParaBusca,
  extrairPalavraChavePura,
  buildAdvogadoTargets,
  conteudoContemTermoOuOr,
  condicaoConcomitanteAtendida,
  shouldExclude,
  detectAudiencia,
} from "./validation.ts";

import { expandirTribunais } from "./tribunais.ts";
import { criarTarefasParaResponsaveis } from "./tarefas.ts";

export interface TribunalStats {
  tribunal: string | null;
  paginas: number;
  resultados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
}

export interface SearchParams {
  texto?: string;
  numeroOab?: string;
  ufOab?: string;
  nomeAdvogado?: string;
  siglaTribunal?: string | null;
  dataInicio?: string;
  dataFim?: string;
}

export async function processPublicationFromIndex(
  supabase: any,
  pub: any,
  monitoramento: Monitoramento,
  tribunalStat: TribunalStats,
  stats: { novas: number; descartadas: number; duplicatas: number },
  tribunal: string | null,
  dataAtual: string,
  allMonitoramentos?: Monitoramento[]
) {
  const conteudo = String(pub?.conteudo || pub?.texto || pub?.teor || pub?.descricao || "");
  const hashConteudo = generateHash(conteudo + (pub.data_disponibilizacao || pub.data_publicacao || pub.data || ''));

  const rawDataDisponibilizacao = pub.data_disponibilizacao || pub.dataDisponibilizacao || null;
  const rawDataPublicacao = pub.data_publicacao || pub.dataPublicacao || null;

  let dataDisponibilizacao = rawDataDisponibilizacao;
  let dataPublicacao: string | null = null;

  // REGRA ABSOLUTA: data_publicacao é sempre o próximo dia útil após data_disponibilizacao
  if (dataDisponibilizacao) {
    try {
      const dispDate = new Date(dataDisponibilizacao);
      if (!isNaN(dispDate.getTime())) {
        dispDate.setDate(dispDate.getDate() + 1);
        const proximoDiaUtil = calcularPrimeiroDiaUtil(dispDate);
        dataPublicacao = formatLocalDate(proximoDiaUtil);
      }
    } catch {
      // ignore
    }
  }

  if (!dataDisponibilizacao && !dataPublicacao) {
    dataDisponibilizacao = dataAtual;
    const hoje = new Date(dataAtual);
    hoje.setDate(hoje.getDate() + 1);
    const proximoDiaUtil = calcularPrimeiroDiaUtil(hoje);
    dataPublicacao = formatLocalDate(proximoDiaUtil);
  }

  if (!conteudoContemTermoOuOr(conteudo, monitoramento)) {
    stats.descartadas++;
    tribunalStat.descartadas++;
    return;
  }

  // Deduplicação por hash_conteudo + monitoramento_id (permite mesma pub em termos diferentes)

  const processoNumero = extractProcessoNumero(conteudo, pub.processo_numero || pub.numeroProcesso || pub.processo);

  // Extrair metadados estruturados ANTES dos checks de descarte
  const ladoRaw = pub.raw_json ? extrairLadoEsquerdoDeRawJson(pub.raw_json) : null;
  const conteudoLeftOnly = conteudoAteLadoEsquerdo(conteudo);
  const ladoConteudo = extrairDadosLadoEsquerdo(conteudoLeftOnly);
  const orgao = (ladoRaw?.orgao) ?? ladoConteudo.orgao ?? null;
  const tipoComunicacao = (ladoRaw?.tipo_comunicacao) ?? ladoConteudo.tipo_comunicacao ?? null;
  const meio = (ladoRaw?.meio) ?? ladoConteudo.meio ?? null;
  const partesFinais = (ladoRaw?.partes?.length ? ladoRaw.partes : null) ?? ladoConteudo.partes;
  const advogadosFinais = (ladoRaw?.advogados?.length ? ladoRaw.advogados : null) ?? ladoConteudo.advogados;

  const metadataDescartada = {
    orgao: orgao || null,
    tipo_comunicacao: tipoComunicacao || null,
    meio: meio || null,
    partes_json: partesFinais.length > 0 ? partesFinais : null,
    advogados_json: advogadosFinais.length > 0 ? advogadosFinais : null,
  };

  if (!condicaoConcomitanteAtendida(conteudo, monitoramento.condicao_concomitante)) {
    // RESGATE INLINE: tentar salvar sob outro monitoramento sem condição concomitante
    let rescuedId: string | null = null;
    if (allMonitoramentos && allMonitoramentos.length > 0) {
      for (const cand of allMonitoramentos) {
        if (cand.id === monitoramento.id) continue;
        if (cand.condicao_concomitante?.trim()) continue;
        
        const conteudoNorm = normalizar(conteudo);
        const termoPuro = extrairPalavraChavePura(cand.termo_busca);
        const termosOrPuros = (cand.termos_or || []).map((t: string) => extrairPalavraChavePura(t.trim())).filter(Boolean);
        const todosNomes = [termoPuro, ...termosOrPuros].filter(Boolean);
        
        const nomeMatch = todosNomes.some(nome => {
          const nomeNorm = normalizar(nome);
          return nomeNorm ? conteudoNorm.includes(nomeNorm) : false;
        });
        
        let oabMatch = false;
        if (!nomeMatch && cand.oab) {
          const oabDigits = String(cand.oab).replace(/\D/g, '');
          if (oabDigits.length >= 3 && conteudo.includes(oabDigits)) oabMatch = true;
        }
        
        if (!nomeMatch && !oabMatch) continue;
        
        // Verificar exclusões do candidato
        const excluido = shouldExclude(conteudo, cand.exclusoes || [], metadataDescartada.partes_json, metadataDescartada.advogados_json);
        if (excluido) continue;
        
        rescuedId = cand.id;
        console.log(`Resgate inline: processo=${processoNumero}, de=${monitoramento.termo_busca} → para=${cand.termo_busca}`);
        break;
      }
    }
    
    if (!rescuedId) {
      await supabase.from('publicacoes_djen_descartadas').insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        conteudo,
        data_publicacao: dataPublicacao,
        data_disponibilizacao: dataDisponibilizacao,
        processo_numero: processoNumero,
        tribunal: tribunal || null,
        motivo_descarte: 'condicao_concomitante',
        ...metadataDescartada,
      });

      stats.descartadas++;
      tribunalStat.descartadas++;
      return;
    }
    
    // Resgatado: usar o ID do candidato para inserir
    // (continua o fluxo normal com monitoramento_id substituído)
    monitoramento = { ...monitoramento, id: rescuedId };
  }

  const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || [], metadataDescartada.partes_json, metadataDescartada.advogados_json);

  if (motivoExclusao) {
    await supabase.from('publicacoes_djen_descartadas').insert({
      monitoramento_id: monitoramento.id,
      hash_conteudo: hashConteudo,
      conteudo,
      data_publicacao: dataPublicacao,
      data_disponibilizacao: dataDisponibilizacao,
      processo_numero: processoNumero,
      tribunal: tribunal || null,
      motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
      ...metadataDescartada,
    });

    stats.descartadas++;
    tribunalStat.descartadas++;
    return;
  }

  const { data: existing } = await supabase
    .from('publicacoes_djen')
    .select('id')
    .eq('hash_conteudo', hashConteudo)
    .eq('monitoramento_id', monitoramento.id)
    .maybeSingle();

  if (existing) {
    stats.duplicatas++;
    tribunalStat.duplicatas++;
    return;
  }

  const { data: publicacao, error: insertError } = await supabase.from('publicacoes_djen').insert({
    monitoramento_id: monitoramento.id,
    hash_conteudo: hashConteudo,
    conteudo,
    data_publicacao: dataPublicacao,
    data_disponibilizacao: dataDisponibilizacao,
    processo_numero: processoNumero,
    tribunal: tribunal || null,
    ...metadataDescartada,
  }).select('id').single();

  if (insertError) {
    console.error(`Insert error:`, insertError);
    return;
  }

  stats.novas++;
  tribunalStat.novas++;
}

export async function buscarNoIndiceDiario(
  supabase: any,
  diarioYmd: string,
  tribunal: string | null,
  termo: string
): Promise<any[]> {
  const termoBusca = normalizarParaBusca(termo);
  if (!termoBusca) return [];

  const pageSize = 500;
  let from = 0;
  let results: any[] = [];
  let done = false;

  while (!done) {
    let query = supabase
      .from('djen_diario_publicacoes')
      .select('id, conteudo, data_disponibilizacao, data_publicacao, processo_numero, tribunal, raw_json')
      .eq('diario_ymd', diarioYmd)
      .textSearch('conteudo_tsv', termoBusca, { type: 'phrase', config: 'portuguese' })
      .range(from, from + pageSize - 1);

    if (tribunal) {
      query = query.eq('tribunal', tribunal);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      done = true;
      break;
    }
    results.push(...data);
    if (data.length < pageSize) done = true;
    from += pageSize;
  }

  return results;
}

export async function buscarNoIndiceOab(
  supabase: any,
  diarioYmd: string,
  tribunal: string | null,
  oabDigits: string
): Promise<any[]> {
  if (!oabDigits) return [];
  const pageSize = 500;
  let from = 0;
  let results: any[] = [];
  let done = false;

  while (!done) {
    let query = supabase
      .from('djen_diario_publicacoes')
      .select('id, conteudo, data_disponibilizacao, data_publicacao, processo_numero, tribunal, raw_json')
      .eq('diario_ymd', diarioYmd)
      .ilike('conteudo', `%${oabDigits}%`)
      .range(from, from + pageSize - 1);

    if (tribunal) {
      query = query.eq('tribunal', tribunal);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      done = true;
      break;
    }
    results.push(...data);
    if (data.length < pageSize) done = true;
    from += pageSize;
  }

  return results;
}

export async function processMonitoramentoIndexed(
  supabase: any,
  monitoramento: Monitoramento,
  diarioYmd: string,
  allMonitoramentos?: Monitoramento[]
): Promise<{ novas: number; descartadas: number; duplicatas: number; tribunaisStats: TribunalStats[] }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const tribunaisStats: TribunalStats[] = [];
  const dataAtual = formatLocalDate(new Date());

  const tribunaisExpandidos = expandirTribunais(monitoramento.tribunais);
  const tribunais = tribunaisExpandidos && tribunaisExpandidos.length > 0
    ? tribunaisExpandidos
    : [null];

  for (const tribunal of tribunais) {
    const tribunalStat: TribunalStats = {
      tribunal,
      paginas: 0,
      resultados: 0,
      novas: 0,
      descartadas: 0,
      duplicatas: 0,
    };

    const candidatos = new Map<string, any>();
    const termosBase = [
      monitoramento.termo_busca,
      ...(monitoramento.termos_or || []),
    ].filter(Boolean) as string[];

    if (monitoramento.tipo === 'advogado' || monitoramento.tipo === 'nome') {
      const termoPuro = extrairPalavraChavePura(monitoramento.termo_busca);
      const termosOrPuros = (monitoramento.termos_or || []).map((t) => extrairPalavraChavePura(t.trim())).filter(Boolean);
      const targets = monitoramento.tipo === 'advogado'
        ? buildAdvogadoTargets(termoPuro, termosOrPuros.length > 0 ? termosOrPuros : undefined, monitoramento.oab, monitoramento.uf)
        : [{ nome: termoPuro || undefined }];
      for (const target of targets) {
        if (target.oabDigits) {
          const items = await buscarNoIndiceOab(supabase, diarioYmd, tribunal, target.oabDigits);
          for (const item of items) candidatos.set(item.id, item);
        }
        if (target.nome) {
          const items = await buscarNoIndiceDiario(supabase, diarioYmd, tribunal, target.nome);
          for (const item of items) candidatos.set(item.id, item);
        }
      }
    } else if (monitoramento.tipo === 'processo') {
      const numero = String(monitoramento.termo_busca || '').replace(/\D/g, '');
      const items = await buscarNoIndiceOab(supabase, diarioYmd, tribunal, numero);
      for (const item of items) candidatos.set(item.id, item);
    } else {
      for (const termo of termosBase) {
        const items = await buscarNoIndiceDiario(supabase, diarioYmd, tribunal, termo);
        for (const item of items) candidatos.set(item.id, item);
      }
    }

    tribunalStat.resultados = candidatos.size;

    for (const pub of candidatos.values()) {
      await processPublicationFromIndex(supabase, pub, monitoramento, tribunalStat, stats, tribunal || pub.tribunal, dataAtual, allMonitoramentos);
    }

    tribunaisStats.push(tribunalStat);
  }

  console.log(`Monitoramento ${monitoramento.id} (indexado): novas=${stats.novas}, descartadas=${stats.descartadas}, duplicatas=${stats.duplicatas}`);
  return { ...stats, tribunaisStats };
}
