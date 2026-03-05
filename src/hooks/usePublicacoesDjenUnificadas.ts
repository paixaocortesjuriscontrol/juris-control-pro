import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfDay, endOfDay } from "date-fns";
import { dedupePublicacoesDjen } from "@/utils/djenDedup";
import { conteudoContemFraseExata } from "@/utils/djenTermoMatch";
import { addDays, parse } from "date-fns";

// Helper para formatar data em ISO com timezone UTC
const formatToUTC = (date: Date) => date.toISOString();

/** Parse seguro de advogados_json/partes_json: evita throw e retorna array ou null. */
function parseJsonArraySafe(value: unknown): string[] | null {
  if (value == null) return null;
  let arr: string[];
  if (Array.isArray(value)) {
    arr = value.map((x) => String(x ?? "").trim()).filter(Boolean);
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return null;
      arr = parsed.map((x: unknown) => String(x ?? "").trim()).filter(Boolean);
    } catch {
      return null;
    }
  } else {
    return null;
  }
  return arr.length ? arr : null;
}

// Helper para converter data local (YYYY-MM-DD) para range UTC considerando BRT (UTC-3)
// Se usuário seleciona 30/01, deve buscar:
// - Início: 30/01 00:00 BRT = 30/01 03:00 UTC
// - Fim: 30/01 23:59:59 BRT = 31/01 02:59:59 UTC
const dateLocalToUTCRange = (dateStr: string, isEnd: boolean): string => {
  // Parse a data como componentes locais para evitar interpretação UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  
  if (isEnd) {
    // Fim do dia em BRT (23:59:59) = próximo dia às 02:59:59 UTC
    // Usar Date para calcular corretamente a virada de mês/ano
    const nextDay = addDays(new Date(year, month - 1, day), 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T02:59:59.999Z`;
  } else {
    // Início do dia em BRT (00:00) = mesmo dia às 03:00 UTC
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T03:00:00Z`;
  }
};

function normalizarTermo(valor: string | null | undefined): string {
  return String(valor || "").trim();
}

function parseTermosOr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => normalizarTermo(String(v))).filter(Boolean);
}

function identificarTermoCorrespondente(
  conteudo: string | null,
  termoPrincipal: string | null,
  termosOr: string[]
): string | null {
  if (!conteudo) return null;

  const candidatos = [...termosOr, termoPrincipal]
    .map((t) => normalizarTermo(t))
    .filter(Boolean);

  for (const candidato of candidatos) {
    if (conteudoContemFraseExata(conteudo, candidato)) {
      return candidato;
    }
  }

  return null;
}

async function enriquecerPublicacoesComMonitoramento(
  publicacoes: PublicacaoUnificada[]
): Promise<PublicacaoUnificada[]> {
  const monitoramentoIds = [...new Set(
    publicacoes
      .filter((p) => (p.tipo_origem === 'termo' || p.tipo_origem === 'descartada') && !!p.monitoramento_id)
      .map((p) => p.monitoramento_id as string)
  )];

  if (monitoramentoIds.length === 0) return publicacoes;

  const { data: monitoramentos, error } = await supabase
    .from('monitoramentos_djen')
    .select('id, termo_busca, descricao, termos_or')
    .in('id', monitoramentoIds);

  if (error || !monitoramentos) {
    console.warn('[DJEN] Falha ao enriquecer monitoramentos para exibição:', error);
    return publicacoes;
  }

  const monitoramentoMap = new Map<string, {
    termo_busca: string | null;
    descricao: string | null;
    termos_or: string[];
  }>();

  monitoramentos.forEach((m: any) => {
    monitoramentoMap.set(m.id, {
      termo_busca: normalizarTermo(m.termo_busca) || null,
      descricao: normalizarTermo(m.descricao) || null,
      termos_or: parseTermosOr(m.termos_or),
    });
  });

  return publicacoes.map((pub) => {
    if (!pub.monitoramento_id || (pub.tipo_origem !== 'termo' && pub.tipo_origem !== 'descartada')) {
      return pub;
    }

    const monitoramento = monitoramentoMap.get(pub.monitoramento_id);
    const termoPrincipal = pub.monitoramento_termo || monitoramento?.termo_busca || null;
    const descricao = pub.monitoramento_descricao || monitoramento?.descricao || null;
    const termosOr = monitoramento?.termos_or || [];
    const termoMatch = identificarTermoCorrespondente(pub.conteudo, termoPrincipal, termosOr);

    return {
      ...pub,
      monitoramento_termo: termoMatch || termoPrincipal,
      monitoramento_descricao: descricao,
    };
  });
}

export interface PublicacaoUnificada {
  id: string;
  tipo_origem: 'termo' | 'processo' | 'descartada' | 'datajud';
  processo_id: string | null;
  processo_numero: string | null;
  conteudo: string | null;
  data_publicacao: string | null;
  data_disponibilizacao: string | null;
  fonte: string | null;
  lida: boolean;
  created_at: string;
  // Dados do monitoramento (para tipo termo)
  monitoramento_id: string | null;
  monitoramento_termo: string | null;
  monitoramento_descricao: string | null;
  
  monitoramento_tipo: string | null;
  monitoramento_oab: string | null;
  monitoramento_uf: string | null;
  // Dados da coordenação
  coordenacao_id: string | null;
  coordenacao_nome: string | null;
  // Dados do processo (para tipo processo)
  polo_ativo: string | null;
  polo_passivo: string | null;
  tribunal: string | null;
  // Campos estruturados da API
  orgao?: string | null;
  tipo_comunicacao?: string | null;
  meio?: string | null;
  advogados_json?: string[] | null;
  partes_json?: string[] | null;
  // Dados de descarte (para tipo descartada)
  motivo_descarte?: string | null;
}

export interface FiltrosUnificados {
  coordenacaoId?: string;
  dataInicio?: string;
  dataFim?: string;
  termoBusca?: string;
  monitoramentoId?: string;
  apenasNaoLidas?: boolean;
  apenasHoje?: boolean;
  // `tipoOrigem` é o filtro do UI "Tipo de Origem":
  // - termo: publicações vindas de monitoramentos (palavra-chave / advogado / parte)
  // - parte: subconjunto de "termo" onde monitoramento_tipo === 'parte'
  // - processo: publicações vindas de processos cadastrados
  // - descartada: auditoria
  // - todos: (legado) mantido por compatibilidade
  tipoOrigem?: 'termo' | 'parte' | 'processo' | 'descartada' | 'todos';
  incluirDescartadas?: boolean;
}

export interface EstatisticasCoordenacao {
  coordenacao_id: string;
  coordenacao_nome: string;
  total: number;
  nao_lidas: number;
  por_tipo: {
    termo: number;
    processo: number;
    descartada: number;
  };
}

export function usePublicacoesDjenUnificadas(filtros: FiltrosUnificados = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query separada para contar descartadas NO MESMO CONTEXTO DE FILTROS (evita mostrar número incoerente)
  const { data: totalDescartadasHoje = 0 } = useQuery({
    queryKey: [
      'descartadas-count',
      user?.id,
      {
        coordenacaoId: filtros.coordenacaoId ?? null,
        monitoramentoId: filtros.monitoramentoId ?? null,
        apenasHoje: filtros.apenasHoje ?? null,
        dataInicio: filtros.dataInicio ?? null,
        dataFim: filtros.dataFim ?? null,
        apenasNaoLidas: filtros.apenasNaoLidas ?? null,
      },
    ],
    queryFn: async () => {
      if (!user?.id) return 0;

      // IMPORTANTE: Usar timezone local (BRT) para evitar off-by-one
      // Se não há filtro de data, buscar últimos 30 dias por padrão para capturar todas publicações não lidas
      const hoje = new Date();
      const trintaDiasAtras = new Date(hoje);
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const defaultInicioYmd = trintaDiasAtras.toISOString().slice(0, 10);

      const dataInicioFiltro = filtros.apenasHoje
        ? formatToUTC(startOfDay(new Date()))
        : filtros.dataInicio
          ? dateLocalToUTCRange(filtros.dataInicio, false)
          : dateLocalToUTCRange(defaultInicioYmd, false);

      const dataFimFiltro = filtros.apenasHoje
        ? formatToUTC(endOfDay(new Date()))
        : filtros.dataFim
          ? dateLocalToUTCRange(filtros.dataFim, true)
          : formatToUTC(endOfDay(new Date()));

      try {
        let q = (supabase
          .from('publicacoes_djen_descartadas') as any)
          .select(
            'id, monitoramento:monitoramentos_djen!inner(coordenacao_id)',
            { count: 'exact', head: true },
          );

        if (dataInicioFiltro) q = q.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) q = q.lte('created_at', dataFimFiltro);
        if (filtros.apenasNaoLidas) q = q.eq('lida', false);
        if (filtros.monitoramentoId) q = q.eq('monitoramento_id', filtros.monitoramentoId);

        // Respeita o filtro de coordenação
        if (filtros.coordenacaoId) {
          q = q.eq('monitoramento.coordenacao_id', filtros.coordenacaoId);
        }

        const { count, error } = await q;
        if (error) {
          console.warn('Erro ao contar descartadas:', error);
          return 0;
        }
        return count || 0;
      } catch (e) {
        console.warn('Erro ao contar descartadas:', e);
        return 0;
      }
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Buscar publicações unificadas
  const { data: publicacoes = [], isLoading } = useQuery({
    queryKey: ['publicacoes-unificadas', user?.id, filtros],
    staleTime: 60_000, // 1 minuto - evita refetches desnecessários
    queryFn: async () => {
      if (!user?.id) return [];
      
      // IMPORTANTE: Usar timezone local (BRT) para evitar off-by-one
      // Se usuário seleciona 30/01, deve buscar 30/01 00:00 BRT até 30/01 23:59 BRT
      // Se não há filtro de data, buscar últimos 30 dias por padrão para capturar todas publicações não lidas
      const hoje = new Date();
      const trintaDiasAtras = new Date(hoje);
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const defaultInicioYmd = trintaDiasAtras.toISOString().slice(0, 10);

      const dataInicioFiltro = filtros.apenasHoje 
        ? formatToUTC(startOfDay(new Date()))
        : filtros.dataInicio 
          ? dateLocalToUTCRange(filtros.dataInicio, false)
          : dateLocalToUTCRange(defaultInicioYmd, false);
      
      const dataFimFiltro = filtros.apenasHoje
        ? formatToUTC(endOfDay(new Date()))
        : filtros.dataFim
          ? dateLocalToUTCRange(filtros.dataFim, true)
          : formatToUTC(endOfDay(new Date()));

      const resultados: PublicacaoUnificada[] = [];
      const numerosProcessosTermo: string[] = [];

      // ===== FAST PATH (RPC) =====
      // Problema atual: muitos duplicados podem "consumir" o .limit(500) e derrubar o total (ex: 124 -> 90)
      // + ficar lento por 3 queries + dedup no client.
      // Para coordenação ESPECÍFICA, usamos RPC que já devolve a lista deduplicada e paginada no servidor.
      const canUseRpc = !!filtros.coordenacaoId && filtros.tipoOrigem !== 'descartada';
      if (canUseRpc) {
        try {
        console.debug('[DJEN] tentando RPC deduplicada');

        const PAGE = 200;

        const { data: countData, error: countError } = await (supabase as any)
          .rpc('count_djen_publicacoes_unificadas', {
            p_coordenacao_id: filtros.coordenacaoId,
            p_inicio: dataInicioFiltro ?? null,
            p_fim: dataFimFiltro ?? null,
            p_apenas_nao_lidas: !!filtros.apenasNaoLidas,
            p_search_query: filtros.termoBusca ?? null,
            p_monitoramento_id: filtros.monitoramentoId ?? null,
          });

        if (countError) {
          throw new Error(`RPC count error: ${countError.message || JSON.stringify(countError)}`);
        }

        const expectedTotal = typeof countData === 'number' ? countData : 0;

        const rawRows: any[] = [];
        for (let offset = 0; offset < expectedTotal; offset += PAGE) {
          const { data: pageRows, error: pageError } = await (supabase as any)
            .rpc('get_djen_publicacoes_unificadas', {
              p_coordenacao_id: filtros.coordenacaoId,
              p_inicio: dataInicioFiltro ?? null,
              p_fim: dataFimFiltro ?? null,
              p_apenas_nao_lidas: !!filtros.apenasNaoLidas,
              p_search_query: filtros.termoBusca ?? null,
              p_limit: PAGE,
              p_offset: offset,
              p_monitoramento_id: filtros.monitoramentoId ?? null,
            });

          if (pageError) {
            throw new Error(`RPC get error: ${pageError.message || JSON.stringify(pageError)}`);
          }

          const chunk = (pageRows || []) as any[];
          rawRows.push(...chunk);
          if (chunk.length < PAGE) break;
        }

        // mapear para o tipo do app
        const mapped: PublicacaoUnificada[] = rawRows.map((r) => ({
          id: r.id,
          tipo_origem: r.tipo_origem,
          processo_id: r.processo_id,
          processo_numero: r.processo_numero,
          conteudo: r.conteudo,
          data_publicacao: r.data_publicacao,
          data_disponibilizacao: r.data_disponibilizacao,
          fonte: r.fonte,
          lida: !!r.lida,
          created_at: r.created_at,
          monitoramento_id: r.monitoramento_id,
          monitoramento_termo: r.monitoramento_termo,
          monitoramento_descricao: r.monitoramento_descricao,
          monitoramento_tipo: r.monitoramento_tipo,
          monitoramento_oab: r.monitoramento_oab,
          monitoramento_uf: r.monitoramento_uf,
          coordenacao_id: r.coordenacao_id,
          coordenacao_nome: r.coordenacao_nome,
          polo_ativo: r.polo_ativo,
          polo_passivo: r.polo_passivo,
          tribunal: r.tribunal,
          orgao: r.orgao || null,
          tipo_comunicacao: r.tipo_comunicacao || null,
          meio: r.meio || null,
          advogados_json: parseJsonArraySafe(r.advogados_json),
          partes_json: parseJsonArraySafe(r.partes_json),
        }));

        let filteredByType = filtros.tipoOrigem === 'termo'
          ? mapped.filter((p) => p.tipo_origem === 'termo')
          : filtros.tipoOrigem === 'parte'
            ? mapped.filter((p) => p.tipo_origem === 'termo' && (p.monitoramento_tipo || '').toLowerCase() === 'parte')
            : filtros.tipoOrigem === 'processo'
              ? mapped.filter((p) => p.tipo_origem === 'processo')
              : mapped;
        if (filtros.monitoramentoId) {
          filteredByType = filteredByType.filter((p) => p.monitoramento_id === filtros.monitoramentoId);
        }

        // Resolver processo_id para publicações de termo
        const termoSemId = filteredByType.filter(
          (p) => p.tipo_origem === 'termo' && !p.processo_id && !!p.processo_numero
        );
        if (termoSemId.length > 0) {
          const uniqueNumeros = [...new Set(termoSemId.map((p) => p.processo_numero!).filter(Boolean))];
          const { data: processosExistentes } = await supabase
            .from('processos')
            .select('id, numero')
            .in('numero', uniqueNumeros);

          const processosExistentesMap: Record<string, string> = {};
          (processosExistentes || []).forEach((p: any) => {
            processosExistentesMap[p.numero] = p.id;
          });

          filteredByType.forEach((p) => {
            if (p.tipo_origem === 'termo' && !p.processo_id && p.processo_numero) {
              p.processo_id = processosExistentesMap[p.processo_numero] || null;
            }
          });
        }

        // incluir descartadas, se solicitado
        if (filtros.incluirDescartadas) {
          let queryDescartadas = (supabase
            .from('publicacoes_djen_descartadas') as any)
            .select(`
              id,
              monitoramento_id,
              processo_numero,
              conteudo,
              data_publicacao,
              data_disponibilizacao,
              tribunal,
              motivo_descarte,
              lida,
              created_at,
              orgao,
              tipo_comunicacao,
              meio,
              partes_json,
              advogados_json,
              monitoramento:monitoramentos_djen!inner(
                id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
                coordenacao:coordenacoes(id, nome)
              )
            `)
            .order('created_at', { ascending: false });

          if (dataInicioFiltro) queryDescartadas = queryDescartadas.gte('created_at', dataInicioFiltro);
          if (dataFimFiltro) queryDescartadas = queryDescartadas.lte('created_at', dataFimFiltro);
          if (filtros.apenasNaoLidas) queryDescartadas = queryDescartadas.eq('lida', false);
          queryDescartadas = queryDescartadas.eq('monitoramento.coordenacao_id', filtros.coordenacaoId);
          if (filtros.monitoramentoId) queryDescartadas = queryDescartadas.eq('monitoramento_id', filtros.monitoramentoId);

          const { data: descartadasData } = await queryDescartadas.limit(200);
          (descartadasData || []).forEach((pub: any) => {
            resultados.push({
              id: pub.id,
              tipo_origem: 'descartada',
              processo_id: null,
              processo_numero: pub.processo_numero,
              conteudo: pub.conteudo,
              data_publicacao: pub.data_publicacao,
              data_disponibilizacao: pub.data_disponibilizacao,
              fonte: null,
              lida: pub.lida ?? false,
              created_at: pub.created_at,
              monitoramento_id: pub.monitoramento_id,
              monitoramento_termo: pub.monitoramento?.termo_busca,
              monitoramento_descricao: pub.monitoramento?.descricao,
              monitoramento_tipo: pub.monitoramento?.tipo,
              monitoramento_oab: pub.monitoramento?.oab,
              monitoramento_uf: pub.monitoramento?.uf,
              coordenacao_id: pub.monitoramento?.coordenacao_id,
              coordenacao_nome: pub.monitoramento?.coordenacao?.nome,
              polo_ativo: null,
              polo_passivo: null,
              tribunal: pub.tribunal,
              orgao: pub.orgao || null,
              tipo_comunicacao: pub.tipo_comunicacao || null,
              meio: pub.meio || null,
              advogados_json: pub.advogados_json ? (typeof pub.advogados_json === 'string' ? JSON.parse(pub.advogados_json) : pub.advogados_json) : null,
              partes_json: pub.partes_json ? (typeof pub.partes_json === 'string' ? JSON.parse(pub.partes_json) : pub.partes_json) : null,
              motivo_descarte: pub.motivo_descarte,
            });
          });
        }

        // NÃO revalidar termo no client: a captura oficial já valida termo principal + termos_or.
        const merged = [...filteredByType, ...resultados];
        const enriquecidos = await enriquecerPublicacoesComMonitoramento(merged);

        const deduped = dedupePublicacoesDjen(enriquecidos);
        return deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        } catch (rpcError) {
          console.warn('[DJEN] RPC falhou, usando fallback com queries diretas:', rpcError);
          // Cai no código abaixo (queries diretas)
        }
      }

      // FALLBACK: queries diretas (usado quando RPC falha ou não há coordenação selecionada)

      // Buscar publicações de TERMOS (monitoramentos_djen)
      // Obs: quando filtrando EXCLUSIVAMENTE por 'descartada', não deve trazer termos/processos.
      if (filtros.tipoOrigem !== 'processo' && filtros.tipoOrigem !== 'descartada') {
        // IMPORTANTE: usar !inner para garantir que filtros por campos do relacionamento
        // (ex: monitoramento.coordenacao_id) sejam aplicados no banco e para evitar
        // publicações órfãs (monitoramento_id sem registro correspondente) que quebram
        // a deduplicação/estatísticas.
        let queryTermos = supabase
          .from('publicacoes_djen')
          .select(`
            id,
            monitoramento_id,
            processo_numero,
            conteudo,
            data_publicacao,
            data_disponibilizacao,
            fonte,
            lida,
            created_at,
            orgao,
            tipo_comunicacao,
            meio,
            advogados_json,
            partes_json,
            polo_ativo,
            polo_passivo,
          monitoramento:monitoramentos_djen!inner(
            id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
            coordenacao:coordenacoes(id, nome)
          )
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) queryTermos = queryTermos.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) queryTermos = queryTermos.lte('created_at', dataFimFiltro);
        if (filtros.apenasNaoLidas) queryTermos = queryTermos.eq('lida', false);
        
        // Filtrar por coordenação NO BANCO para performance
        if (filtros.coordenacaoId) {
          queryTermos = queryTermos.eq('monitoramento.coordenacao_id', filtros.coordenacaoId);
        }
        if (filtros.monitoramentoId) {
          queryTermos = queryTermos.eq('monitoramento_id', filtros.monitoramentoId);
        }

        // Filtro "Por Parte": só monitoramentos tipo 'parte'
        if (filtros.tipoOrigem === 'parte') {
          queryTermos = (queryTermos as any).eq('monitoramento.tipo', 'parte');
        }

        // Limitar a 500 registros para performance (contagem precisa é feita pelo RPC)
        const { data: termosData } = await queryTermos.limit(500);

        // Coletar números de processos para buscar IDs
        (termosData || []).forEach((pub: any) => {
          if (pub.processo_numero) {
            numerosProcessosTermo.push(pub.processo_numero);
          }
        });

        // Buscar IDs dos processos que já existem no banco
        let processosExistentesMap: Record<string, string> = {};
        if (numerosProcessosTermo.length > 0) {
          const uniqueNumeros = [...new Set(numerosProcessosTermo)];
          const { data: processosExistentes } = await supabase
            .from('processos')
            .select('id, numero')
            .in('numero', uniqueNumeros);
          
          (processosExistentes || []).forEach((p: any) => {
            processosExistentesMap[p.numero] = p.id;
          });
        }

          (termosData || []).forEach((pub: any) => {
          // Com !inner + filtro no banco, essa checagem vira redundante; manter apenas como guarda.
          if (filtros.coordenacaoId && pub.monitoramento?.coordenacao_id !== filtros.coordenacaoId) return;

          // Filtrar por termo de busca: FRASE EXATA no conteúdo (evita "Super" casar com "SUPERIOR")
          if (filtros.termoBusca) {
            const termoLower = filtros.termoBusca.toLowerCase();
            const termoDigits = termoLower.replace(/\D/g, '');
            const matchConteudo = conteudoContemFraseExata(pub.conteudo, filtros.termoBusca);
            const matchProcesso = pub.processo_numero?.toLowerCase().includes(termoLower);
            const matchTermoMonitor = pub.monitoramento?.termo_busca?.toLowerCase().includes(termoLower);
            // Busca normalizada por dígitos do processo
            const matchProcessoDigits = termoDigits.length >= 5 && pub.processo_numero
              ? (() => { const d = pub.processo_numero.replace(/\D/g, ''); return d.includes(termoDigits) || termoDigits.includes(d); })()
              : false;
            if (!matchConteudo && !matchProcesso && !matchTermoMonitor && !matchProcessoDigits) return;
          }

          // Verificar se o processo já existe no banco
          const processoId = pub.processo_numero ? processosExistentesMap[pub.processo_numero] || null : null;

          resultados.push({
            id: pub.id,
            tipo_origem: 'termo',
            processo_id: processoId,
            processo_numero: pub.processo_numero,
            conteudo: pub.conteudo,
            data_publicacao: pub.data_publicacao,
            data_disponibilizacao: pub.data_disponibilizacao,
            fonte: pub.fonte,
            lida: pub.lida,
            created_at: pub.created_at,
            monitoramento_id: pub.monitoramento_id,
            monitoramento_termo: pub.monitoramento?.termo_busca,
            monitoramento_descricao: pub.monitoramento?.descricao,
            monitoramento_tipo: pub.monitoramento?.tipo,
            monitoramento_oab: pub.monitoramento?.oab,
            monitoramento_uf: pub.monitoramento?.uf,
            coordenacao_id: pub.monitoramento?.coordenacao_id,
            coordenacao_nome: pub.monitoramento?.coordenacao?.nome,
            polo_ativo: pub.polo_ativo || null,
            polo_passivo: pub.polo_passivo || null,
            tribunal: null,
            orgao: pub.orgao || null,
            tipo_comunicacao: pub.tipo_comunicacao || null,
            meio: pub.meio || null,
            advogados_json: parseJsonArraySafe(pub.advogados_json),
            partes_json: parseJsonArraySafe(pub.partes_json),
          });
        });
      }

      // Buscar publicações de PROCESSOS (publicacoes_djen_processos)
      // Obs: quando filtrando EXCLUSIVAMENTE por 'descartada', não deve trazer termos/processos.
      // "parte" é um subconjunto de "termo" — não deve buscar publicações de processos
      if (filtros.tipoOrigem !== 'termo' && filtros.tipoOrigem !== 'parte' && filtros.tipoOrigem !== 'descartada') {
        // IMPORTANTE: usar !inner para garantir que filtros por campos do relacionamento
        // (ex: processo.coordenacao_id) sejam aplicados no banco.
        let queryProcessos = supabase
          .from('publicacoes_djen_processos')
          .select(`
            id,
            processo_id,
            processo_numero,
            conteudo,
            data_publicacao,
            data_disponibilizacao,
            fonte,
            lida,
            created_at,
            orgao,
            tipo_comunicacao,
            meio,
            advogados_json,
            partes_json,
            processo:processos!inner(
              id, numero, polo_ativo, polo_passivo, tribunal,
              coordenacao_id, coordenacao:coordenacoes(id, nome)
            )
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) queryProcessos = queryProcessos.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) queryProcessos = queryProcessos.lte('created_at', dataFimFiltro);
        if (filtros.apenasNaoLidas) queryProcessos = queryProcessos.eq('lida', false);
        
        // Filtrar por coordenação NO BANCO para performance
        if (filtros.coordenacaoId) {
          queryProcessos = queryProcessos.eq('processo.coordenacao_id', filtros.coordenacaoId);
        }

        // Limitar a 500 registros para performance (contagem precisa é feita pelo RPC)
        const { data: processosData } = await queryProcessos.limit(500);

        (processosData || []).forEach((pub: any) => {
          // Com !inner + filtro no banco, essa checagem vira redundante; manter apenas como guarda.
          if (filtros.coordenacaoId && pub.processo?.coordenacao_id !== filtros.coordenacaoId) return;

          // Filtrar por termo de busca
          if (filtros.termoBusca) {
            const termo = filtros.termoBusca.toLowerCase();
            const termoDigits = termo.replace(/\D/g, '');
            const matchProcessoDigits = termoDigits.length >= 5 && pub.processo_numero
              ? (() => { const d = pub.processo_numero.replace(/\D/g, ''); return d.includes(termoDigits) || termoDigits.includes(d); })()
              : false;
            const match = 
              pub.conteudo?.toLowerCase().includes(termo) ||
              pub.processo_numero?.toLowerCase().includes(termo) ||
              pub.processo?.polo_ativo?.toLowerCase().includes(termo) ||
              pub.processo?.polo_passivo?.toLowerCase().includes(termo) ||
              matchProcessoDigits;
            if (!match) return;
          }

          resultados.push({
            id: pub.id,
            tipo_origem: 'processo',
            processo_id: pub.processo_id,
            processo_numero: pub.processo_numero,
            conteudo: pub.conteudo,
            data_publicacao: pub.data_publicacao,
            data_disponibilizacao: pub.data_disponibilizacao,
            fonte: pub.fonte,
            lida: pub.lida,
            created_at: pub.created_at,
            monitoramento_id: null,
            monitoramento_termo: null,
            monitoramento_descricao: null,
            monitoramento_tipo: null,
            monitoramento_oab: null,
            monitoramento_uf: null,
            coordenacao_id: pub.processo?.coordenacao_id,
            coordenacao_nome: pub.processo?.coordenacao?.nome,
            polo_ativo: pub.processo?.polo_ativo,
            polo_passivo: pub.processo?.polo_passivo,
            tribunal: pub.processo?.tribunal,
            orgao: pub.orgao || null,
            tipo_comunicacao: pub.tipo_comunicacao || null,
            meio: pub.meio || null,
            advogados_json: parseJsonArraySafe(pub.advogados_json),
            partes_json: parseJsonArraySafe(pub.partes_json),
          });
        });
      }

      // Buscar publicações DESCARTADAS
      if (filtros.incluirDescartadas || filtros.tipoOrigem === 'descartada') {
        let queryDescartadas = (supabase
          .from('publicacoes_djen_descartadas') as any)
          .select(`
            id,
            monitoramento_id,
            processo_numero,
            conteudo,
            data_publicacao,
            data_disponibilizacao,
            tribunal,
            motivo_descarte,
            lida,
            created_at,
            orgao,
            tipo_comunicacao,
            meio,
            partes_json,
            advogados_json,
            monitoramento:monitoramentos_djen!inner(
              id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
              coordenacao:coordenacoes(id, nome)
            )
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) queryDescartadas = queryDescartadas.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) queryDescartadas = queryDescartadas.lte('created_at', dataFimFiltro);
        if (filtros.coordenacaoId) queryDescartadas = queryDescartadas.eq('monitoramento.coordenacao_id', filtros.coordenacaoId);
        if (filtros.monitoramentoId) queryDescartadas = queryDescartadas.eq('monitoramento_id', filtros.monitoramentoId);

        const { data: descartadasData } = await queryDescartadas.limit(500);

        (descartadasData || []).forEach((pub: any) => {
          // Filtrar por coordenação se especificado
          if (filtros.coordenacaoId && pub.monitoramento?.coordenacao_id !== filtros.coordenacaoId) {
            return;
          }

          // Filtrar por termo de busca
          if (filtros.termoBusca) {
            const termo = filtros.termoBusca.toLowerCase();
            const termoDigits = termo.replace(/\D/g, '');
            const matchProcessoDigits = termoDigits.length >= 5 && pub.processo_numero
              ? (() => { const d = pub.processo_numero.replace(/\D/g, ''); return d.includes(termoDigits) || termoDigits.includes(d); })()
              : false;
            const match = 
              pub.conteudo?.toLowerCase().includes(termo) ||
              pub.processo_numero?.toLowerCase().includes(termo) ||
              pub.monitoramento?.termo_busca?.toLowerCase().includes(termo) ||
              pub.motivo_descarte?.toLowerCase().includes(termo) ||
              matchProcessoDigits;
            if (!match) return;
          }

          resultados.push({
            id: pub.id,
            tipo_origem: 'descartada',
            processo_id: null,
            processo_numero: pub.processo_numero,
            conteudo: pub.conteudo,
            data_publicacao: pub.data_publicacao,
            data_disponibilizacao: pub.data_disponibilizacao,
            fonte: null,
            lida: pub.lida ?? false,
            created_at: pub.created_at,
            monitoramento_id: pub.monitoramento_id,
            monitoramento_termo: pub.monitoramento?.termo_busca,
            monitoramento_descricao: pub.monitoramento?.descricao,
            monitoramento_tipo: pub.monitoramento?.tipo,
            monitoramento_oab: pub.monitoramento?.oab,
            monitoramento_uf: pub.monitoramento?.uf,
            coordenacao_id: pub.monitoramento?.coordenacao_id,
            coordenacao_nome: pub.monitoramento?.coordenacao?.nome,
            polo_ativo: null,
            polo_passivo: null,
            tribunal: pub.tribunal,
            orgao: pub.orgao || null,
            tipo_comunicacao: pub.tipo_comunicacao || null,
            meio: pub.meio || null,
            advogados_json: pub.advogados_json ? (typeof pub.advogados_json === 'string' ? JSON.parse(pub.advogados_json) : pub.advogados_json) : null,
            partes_json: pub.partes_json ? (typeof pub.partes_json === 'string' ? JSON.parse(pub.partes_json) : pub.partes_json) : null,
            motivo_descarte: pub.motivo_descarte,
          });
        });
      }

      // NÃO revalidar termo no client: a captura oficial já valida termo principal + termos_or.
      const resultadosFiltrados = await enriquecerPublicacoesComMonitoramento(resultados);

      let deduped = dedupePublicacoesDjen(resultadosFiltrados);

      // Se estamos filtrando apenas descartadas, garantir que só venham descartadas
      if (filtros.tipoOrigem === 'descartada') {
        deduped = deduped.filter(p => p.tipo_origem === 'descartada');
      }

      // Se estamos filtrando apenas "parte", garantir que só venham termos do tipo 'parte'
      if (filtros.tipoOrigem === 'parte') {
        deduped = deduped.filter(
          (p) => p.tipo_origem === 'termo' && (p.monitoramento_tipo || '').toLowerCase() === 'parte'
        );
      }

      // Ordenar por data de criação (mais recentes primeiro)
      return deduped.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!user?.id,
  });

  // Estatísticas devem refletir EXATAMENTE a listagem (incluindo filtros como: Não Lidas, Termo de busca,
  // Todas (inclui descartadas), Descartadas, etc.).
  const estatisticas: EstatisticasCoordenacao[] = (() => {
    const statsMap = new Map<string, EstatisticasCoordenacao>();

    publicacoes.forEach((pub) => {
      const coordId = pub.coordenacao_id || 'sem-coordenacao';
      const coordNome = pub.coordenacao_nome || 'Sem Coordenação';

    if (!statsMap.has(coordId)) {
        statsMap.set(coordId, {
          coordenacao_id: coordId,
          coordenacao_nome: coordNome,
          total: 0,
          nao_lidas: 0,
          por_tipo: { termo: 0, processo: 0, descartada: 0 },
        });
      }

      const stats = statsMap.get(coordId)!;
      stats.total++;
      if (!pub.lida) stats.nao_lidas++;
      if (pub.tipo_origem === 'termo') stats.por_tipo.termo++;
      if (pub.tipo_origem === 'processo') stats.por_tipo.processo++;
      if (pub.tipo_origem === 'descartada') stats.por_tipo.descartada++;
    });

    return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
  })();

  // Marcar como lida - usa RPC que marca TODOS os registros duplicados (mesmo hash de dedup)
  // Isso resolve o problema onde a UI mostra 1 publicação deduplicada, mas existem N registros subjacentes
  const marcarComoLida = useMutation({
    mutationFn: async (items: { id: string; tipo_origem: 'termo' | 'processo' | 'descartada' | 'datajud' }[]) => {
      const termos = items.filter(i => i.tipo_origem === 'termo').map(i => i.id);
      const processos = items.filter(i => i.tipo_origem === 'processo').map(i => i.id);
      const descartadas = items.filter(i => i.tipo_origem === 'descartada').map(i => i.id);
      const datajudIds = items.filter(i => i.tipo_origem === 'datajud').map(i => i.id);

      // Mark DataJud items directly
      if (datajudIds.length > 0) {
        await supabase
          .from('movimentacoes_datajud')
          .update({ lida: true })
          .in('id', datajudIds);
      }

      // Usa RPC que encontra e marca TODOS os registros que compartilham o mesmo hash de deduplicação
      const { data, error } = await (supabase as any).rpc('marcar_publicacoes_lidas_por_dedup', {
        p_ids_termos: termos.length > 0 ? termos : null,
        p_ids_processos: processos.length > 0 ? processos : null,
        p_ids_descartadas: descartadas.length > 0 ? descartadas : null,
      });

      if (error) {
        console.error('Erro ao marcar publicações lidas via RPC:', error);
        throw new Error(error.message);
      }

      console.log('[DJEN] Publicações marcadas via dedup:', data);
      return { rpcResult: data, itemIds: items.map(i => i.id) };
    },
    // Optimistic update: marca imediatamente na UI antes do servidor responder
    onMutate: async (items) => {
      // Cancelar queries em andamento para evitar sobrescrever o optimistic update
      await queryClient.cancelQueries({ queryKey: ['publicacoes-unificadas'] });

      // Snapshot do estado atual
      const previousData = queryClient.getQueriesData<PublicacaoUnificada[]>({ queryKey: ['publicacoes-unificadas'] });

      // Atualizar otimisticamente todas as queries de publicações
      const idsToMark = new Set(items.map(i => i.id));
      queryClient.setQueriesData<PublicacaoUnificada[]>(
        { queryKey: ['publicacoes-unificadas'] },
        (old) => {
          if (!old) return old;
          return old.map(pub => idsToMark.has(pub.id) ? { ...pub, lida: true } : pub);
        }
      );

      return { previousData };
    },
    onSuccess: (result) => {
      // Refetch em background para sincronizar com o servidor (sem bloquear a UI)
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      queryClient.invalidateQueries({ queryKey: ['descartadas-count'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });
      
      const data = result.rpcResult;
      const total = (data?.termos_atualizados || 0) + (data?.processos_atualizados || 0) + (data?.descartadas_atualizados || 0);
      toast.success(`${total} publicação(ões) marcada(s) como lida(s)`);
    },
    onError: (error, _variables, context) => {
      // Reverter ao estado anterior em caso de erro
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      toast.error(`Erro ao marcar publicações: ${error.message}`);
    },
  });

  return {
    publicacoes,
    estatisticas,
    isLoading,
    loadingStats: isLoading,
    marcarComoLida,
    totalHoje: estatisticas.reduce((acc, s) => acc + s.total, 0),
    naoLidasHoje: estatisticas.reduce((acc, s) => acc + s.nao_lidas, 0),
    totalDescartadasHoje,
  };
}
