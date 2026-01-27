import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfDay, endOfDay } from "date-fns";
import { dedupePublicacoesDjen } from "@/utils/djenDedup";

// Helper para formatar data em ISO com timezone UTC
const formatToUTC = (date: Date) => date.toISOString();

export interface PublicacaoUnificada {
  id: string;
  tipo_origem: 'termo' | 'processo' | 'descartada';
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
  // Dados de descarte (para tipo descartada)
  motivo_descarte?: string | null;
}

export interface FiltrosUnificados {
  coordenacaoId?: string;
  dataInicio?: string;
  dataFim?: string;
  termoBusca?: string;
  apenasNaoLidas?: boolean;
  apenasHoje?: boolean;
  tipoOrigem?: 'termo' | 'processo' | 'descartada' | 'todos';
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
        apenasHoje: filtros.apenasHoje ?? null,
        dataInicio: filtros.dataInicio ?? null,
        dataFim: filtros.dataFim ?? null,
        apenasNaoLidas: filtros.apenasNaoLidas ?? null,
      },
    ],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Mesma lógica de período do hook principal
      const dataInicioFiltro = filtros.apenasHoje
        ? formatToUTC(startOfDay(new Date()))
        : filtros.dataInicio
          ? `${filtros.dataInicio}T00:00:00Z`
          : undefined;

      const dataFimFiltro = filtros.apenasHoje
        ? formatToUTC(endOfDay(new Date()))
        : filtros.dataFim
          ? `${filtros.dataFim}T23:59:59Z`
          : undefined;

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
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Usar timezone UTC para filtros de data
      const dataInicioFiltro = filtros.apenasHoje 
        ? formatToUTC(startOfDay(new Date()))
        : filtros.dataInicio 
          ? `${filtros.dataInicio}T00:00:00Z`
          : undefined;
      
      const dataFimFiltro = filtros.apenasHoje
        ? formatToUTC(endOfDay(new Date()))
        : filtros.dataFim
          ? `${filtros.dataFim}T23:59:59Z`
          : undefined;

      const resultados: PublicacaoUnificada[] = [];
      const numerosProcessosTermo: string[] = [];

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

          // Filtrar por termo de busca
          if (filtros.termoBusca) {
            const termo = filtros.termoBusca.toLowerCase();
            const match = 
              pub.conteudo?.toLowerCase().includes(termo) ||
              pub.processo_numero?.toLowerCase().includes(termo) ||
              pub.monitoramento?.termo_busca?.toLowerCase().includes(termo);
            if (!match) return;
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
            polo_ativo: null,
            polo_passivo: null,
            tribunal: null,
          });
        });
      }

      // Buscar publicações de PROCESSOS (publicacoes_djen_processos)
      // Obs: quando filtrando EXCLUSIVAMENTE por 'descartada', não deve trazer termos/processos.
      if (filtros.tipoOrigem !== 'termo' && filtros.tipoOrigem !== 'descartada') {
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
            const match = 
              pub.conteudo?.toLowerCase().includes(termo) ||
              pub.processo_numero?.toLowerCase().includes(termo) ||
              pub.processo?.polo_ativo?.toLowerCase().includes(termo) ||
              pub.processo?.polo_passivo?.toLowerCase().includes(termo);
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
            monitoramento:monitoramentos_djen!inner(
              id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
              coordenacao:coordenacoes(id, nome)
            )
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) queryDescartadas = queryDescartadas.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) queryDescartadas = queryDescartadas.lte('created_at', dataFimFiltro);

        const { data: descartadasData } = await queryDescartadas.limit(200);

        (descartadasData || []).forEach((pub: any) => {
          // Filtrar por coordenação se especificado
          if (filtros.coordenacaoId && pub.monitoramento?.coordenacao_id !== filtros.coordenacaoId) {
            return;
          }

          // Filtrar por termo de busca
          if (filtros.termoBusca) {
            const termo = filtros.termoBusca.toLowerCase();
            const match = 
              pub.conteudo?.toLowerCase().includes(termo) ||
              pub.processo_numero?.toLowerCase().includes(termo) ||
              pub.monitoramento?.termo_busca?.toLowerCase().includes(termo) ||
              pub.motivo_descarte?.toLowerCase().includes(termo);
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
            motivo_descarte: pub.motivo_descarte,
          });
        });
      }

      let deduped = dedupePublicacoesDjen(resultados);

      // Se estamos filtrando apenas descartadas, garantir que só venham descartadas
      if (filtros.tipoOrigem === 'descartada') {
        deduped = deduped.filter(p => p.tipo_origem === 'descartada');
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

  // Marcar como lida
  const marcarComoLida = useMutation({
    mutationFn: async (items: { id: string; tipo_origem: 'termo' | 'processo' | 'descartada' }[]) => {
      const termos = items.filter(i => i.tipo_origem === 'termo').map(i => i.id);
      const processos = items.filter(i => i.tipo_origem === 'processo').map(i => i.id);
      const descartadas = items.filter(i => i.tipo_origem === 'descartada').map(i => i.id);

      if (termos.length > 0) {
        await supabase
          .from('publicacoes_djen')
          .update({ lida: true })
          .in('id', termos);
      }

      if (processos.length > 0) {
        await supabase
          .from('publicacoes_djen_processos')
          .update({ lida: true })
          .in('id', processos);
      }

      if (descartadas.length > 0) {
        // Cast para contornar tipagem até regenerar types
        const { error } = await (supabase
          .from('publicacoes_djen_descartadas') as any)
          .update({ lida: true })
          .in('id', descartadas);
        if (error) console.error('Erro ao marcar descartadas:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      toast.success("Publicação(ões) marcada(s) como lida(s)");
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
