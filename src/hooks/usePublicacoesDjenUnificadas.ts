import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfDay, endOfDay, format } from "date-fns";
import { dedupePublicacoesDjen } from "@/utils/djenDedup";

export interface PublicacaoUnificada {
  id: string;
  tipo_origem: 'termo' | 'processo';
  processo_id: string | null;
  processo_numero: string | null;
  conteudo: string | null;
  data_publicacao: string | null;
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
}

export interface FiltrosUnificados {
  coordenacaoId?: string;
  dataInicio?: string;
  dataFim?: string;
  termoBusca?: string;
  apenasNaoLidas?: boolean;
  apenasHoje?: boolean;
  tipoOrigem?: 'termo' | 'processo' | 'todos';
}

export interface EstatisticasCoordenacao {
  coordenacao_id: string;
  coordenacao_nome: string;
  total: number;
  nao_lidas: number;
  por_tipo: {
    termo: number;
    processo: number;
  };
}

export function usePublicacoesDjenUnificadas(filtros: FiltrosUnificados = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar estatísticas por coordenação - AGORA FILTRA POR COORDENAÇÃO TAMBÉM
  const { data: estatisticas = [], isLoading: loadingStats } = useQuery({
    queryKey: ['publicacoes-unificadas-stats', filtros.dataInicio, filtros.dataFim, filtros.apenasHoje, filtros.coordenacaoId],
    queryFn: async () => {
      const dataInicioFiltro = filtros.apenasHoje 
        ? format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss")
        : filtros.dataInicio 
          ? `${filtros.dataInicio}T00:00:00`
          : undefined;
      
      const dataFimFiltro = filtros.apenasHoje
        ? format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss")
        : filtros.dataFim
          ? `${filtros.dataFim}T23:59:59`
          : undefined;

      // Buscar publicações de termos agrupadas
      let queryTermos = supabase
        .from('publicacoes_djen')
        .select(`
          id, lida,
          monitoramento:monitoramentos_djen(coordenacao_id, coordenacao:coordenacoes(nome))
        `);

      if (dataInicioFiltro) queryTermos = queryTermos.gte('created_at', dataInicioFiltro);
      if (dataFimFiltro) queryTermos = queryTermos.lte('created_at', dataFimFiltro);

      const { data: termosData } = await queryTermos;

      // Buscar publicações de processos agrupadas
      let queryProcessos = supabase
        .from('publicacoes_djen_processos')
        .select(`
          id, lida,
          processo:processos(coordenacao_id, coordenacao:coordenacoes(nome))
        `);

      if (dataInicioFiltro) queryProcessos = queryProcessos.gte('created_at', dataInicioFiltro);
      if (dataFimFiltro) queryProcessos = queryProcessos.lte('created_at', dataFimFiltro);

      const { data: processosData } = await queryProcessos;

      // Agrupar por coordenação
      const statsMap = new Map<string, EstatisticasCoordenacao>();

      // Processar publicações de termos
      (termosData || []).forEach((pub: any) => {
        const coordId = pub.monitoramento?.coordenacao_id || 'sem-coordenacao';
        const coordNome = pub.monitoramento?.coordenacao?.nome || 'Sem Coordenação';
        
        // FILTRAR por coordenação se especificado
        if (filtros.coordenacaoId && coordId !== filtros.coordenacaoId) {
          return;
        }
        
        if (!statsMap.has(coordId)) {
          statsMap.set(coordId, {
            coordenacao_id: coordId,
            coordenacao_nome: coordNome,
            total: 0,
            nao_lidas: 0,
            por_tipo: { termo: 0, processo: 0 }
          });
        }
        
        const stats = statsMap.get(coordId)!;
        stats.total++;
        stats.por_tipo.termo++;
        if (!pub.lida) stats.nao_lidas++;
      });

      // Processar publicações de processos
      (processosData || []).forEach((pub: any) => {
        const coordId = pub.processo?.coordenacao_id || 'sem-coordenacao';
        const coordNome = pub.processo?.coordenacao?.nome || 'Sem Coordenação';
        
        // FILTRAR por coordenação se especificado
        if (filtros.coordenacaoId && coordId !== filtros.coordenacaoId) {
          return;
        }
        
        if (!statsMap.has(coordId)) {
          statsMap.set(coordId, {
            coordenacao_id: coordId,
            coordenacao_nome: coordNome,
            total: 0,
            nao_lidas: 0,
            por_tipo: { termo: 0, processo: 0 }
          });
        }
        
        const stats = statsMap.get(coordId)!;
        stats.total++;
        stats.por_tipo.processo++;
        if (!pub.lida) stats.nao_lidas++;
      });

      return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
    },
    enabled: !!user?.id,
  });

  // Buscar publicações unificadas
  const { data: publicacoes = [], isLoading } = useQuery({
    queryKey: ['publicacoes-unificadas', user?.id, filtros],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const dataInicioFiltro = filtros.apenasHoje 
        ? format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss")
        : filtros.dataInicio 
          ? `${filtros.dataInicio}T00:00:00`
          : undefined;
      
      const dataFimFiltro = filtros.apenasHoje
        ? format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss")
        : filtros.dataFim
          ? `${filtros.dataFim}T23:59:59`
          : undefined;

      const resultados: PublicacaoUnificada[] = [];

      // Buscar publicações de TERMOS (monitoramentos_djen)
      if (filtros.tipoOrigem !== 'processo') {
        let queryTermos = supabase
          .from('publicacoes_djen')
          .select(`
            id,
            monitoramento_id,
            processo_numero,
            conteudo,
            data_publicacao,
            fonte,
            lida,
            created_at,
          monitoramento:monitoramentos_djen(
            id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
            coordenacao:coordenacoes(id, nome)
          )
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) queryTermos = queryTermos.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) queryTermos = queryTermos.lte('created_at', dataFimFiltro);
        if (filtros.apenasNaoLidas) queryTermos = queryTermos.eq('lida', false);

        const { data: termosData } = await queryTermos.limit(300);

        (termosData || []).forEach((pub: any) => {
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
              pub.monitoramento?.termo_busca?.toLowerCase().includes(termo);
            if (!match) return;
          }

          resultados.push({
            id: pub.id,
            tipo_origem: 'termo',
            processo_id: null,
            processo_numero: pub.processo_numero,
            conteudo: pub.conteudo,
            data_publicacao: pub.data_publicacao,
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
      if (filtros.tipoOrigem !== 'termo') {
        let queryProcessos = supabase
          .from('publicacoes_djen_processos')
          .select(`
            id,
            processo_id,
            processo_numero,
            conteudo,
            data_publicacao,
            fonte,
            lida,
            created_at,
            processo:processos(
              id, numero, polo_ativo, polo_passivo, tribunal,
              coordenacao_id, coordenacao:coordenacoes(id, nome)
            )
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) queryProcessos = queryProcessos.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) queryProcessos = queryProcessos.lte('created_at', dataFimFiltro);
        if (filtros.apenasNaoLidas) queryProcessos = queryProcessos.eq('lida', false);

        const { data: processosData } = await queryProcessos.limit(300);

        (processosData || []).forEach((pub: any) => {
          // Filtrar por coordenação se especificado
          if (filtros.coordenacaoId && pub.processo?.coordenacao_id !== filtros.coordenacaoId) {
            return;
          }

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

      const deduped = dedupePublicacoesDjen(resultados);

      // Ordenar por data de criação (mais recentes primeiro)
      return deduped.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!user?.id,
  });

  // Marcar como lida
  const marcarComoLida = useMutation({
    mutationFn: async (items: { id: string; tipo_origem: 'termo' | 'processo' }[]) => {
      const termos = items.filter(i => i.tipo_origem === 'termo').map(i => i.id);
      const processos = items.filter(i => i.tipo_origem === 'processo').map(i => i.id);

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
      toast.success("Publicação(ões) marcada(s) como lida(s)");
    },
  });

  return {
    publicacoes,
    estatisticas,
    isLoading,
    loadingStats,
    marcarComoLida,
    totalHoje: estatisticas.reduce((acc, s) => acc + s.total, 0),
    naoLidasHoje: estatisticas.reduce((acc, s) => acc + s.nao_lidas, 0),
  };
}
