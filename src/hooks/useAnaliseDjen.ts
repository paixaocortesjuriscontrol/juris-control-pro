import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PublicacaoAnalise {
  id: string;
  monitoramento_id: string;
  hash_conteudo: string;
  data_publicacao: string | null;
  processo_numero: string | null;
  conteudo: string | null;
  fonte: string | null;
  lida: boolean;
  created_at: string;
  monitoramento?: {
    id: string;
    tipo: string;
    termo_busca: string;
    oab: string | null;
    uf: string | null;
    coordenacao_id: string | null;
    coordenacao?: {
      id: string;
      nome: string;
    } | null;
  };
}

export interface ResumoMonitoramento {
  id: string;
  monitoramento_id: string;
  resumo: string;
  data_busca: string;
  publicacoes_incluidas: string[];
  created_at: string;
}

export interface FiltrosAnalise {
  coordenacaoId?: string;
  monitoramentoId?: string;
  dataInicio?: string;
  dataFim?: string;
  termoBusca?: string;
  apenasNaoLidas?: boolean;
}

export function useAnaliseDjen(filtros: FiltrosAnalise = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar publicações
  const { data: publicacoes = [], isLoading } = useQuery({
    queryKey: ['analise-djen', user?.id, filtros],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('publicacoes_djen')
        .select(`
          id,
          monitoramento_id,
          hash_conteudo,
          data_publicacao,
          processo_numero,
          conteudo,
          fonte,
          lida,
          created_at,
          monitoramento:monitoramentos_djen(
            id,
            tipo,
            termo_busca,
            oab,
            uf,
            coordenacao_id,
            coordenacao:coordenacoes(id, nome)
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filtros.dataInicio) {
        query = query.gte('created_at', filtros.dataInicio);
      }
      
      if (filtros.dataFim) {
        query = query.lte('created_at', `${filtros.dataFim}T23:59:59`);
      }

      if (filtros.apenasNaoLidas) {
        query = query.eq('lida', false);
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;

      // Filter by coordenacao on client side (nested filter)
      let filtered = data as PublicacaoAnalise[];
      
      if (filtros.coordenacaoId) {
        filtered = filtered.filter(p => 
          p.monitoramento?.coordenacao_id === filtros.coordenacaoId
        );
      }

      if (filtros.monitoramentoId) {
        filtered = filtered.filter(p => 
          p.monitoramento_id === filtros.monitoramentoId
        );
      }

      if (filtros.termoBusca) {
        const termo = filtros.termoBusca.toLowerCase();
        const termoDigits = termo.replace(/\D/g, '');
        filtered = filtered.filter(p => {
          if (p.monitoramento?.termo_busca?.toLowerCase().includes(termo)) return true;
          if (p.conteudo?.toLowerCase().includes(termo)) return true;
          if (p.processo_numero?.toLowerCase().includes(termo)) return true;
          // Busca por número de processo normalizado (sem pontos/traços)
          if (termoDigits.length >= 5 && p.processo_numero) {
            const procDigits = p.processo_numero.replace(/\D/g, '');
            if (procDigits.includes(termoDigits) || termoDigits.includes(procDigits)) return true;
          }
          return false;
        });
      }

      return filtered;
    },
    enabled: !!user?.id,
  });

  // Buscar último resumo do monitoramento selecionado
  const { data: ultimoResumo, isLoading: loadingResumo } = useQuery({
    queryKey: ['resumo-monitoramento', filtros.monitoramentoId],
    queryFn: async () => {
      if (!filtros.monitoramentoId) return null;
      
      const { data, error } = await supabase
        .from('resumos_monitoramento_djen')
        .select('*')
        .eq('monitoramento_id', filtros.monitoramentoId)
        .order('data_busca', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ResumoMonitoramento | null;
    },
    enabled: !!filtros.monitoramentoId,
  });

  const gerarResumoIA = useMutation({
    mutationFn: async ({ publicacoes: pubsParaResumir, monitoramentoId }: { publicacoes: PublicacaoAnalise[], monitoramentoId?: string }) => {
      if (pubsParaResumir.length === 0) {
        throw new Error("Nenhuma publicação selecionada para resumir");
      }

      const { data, error } = await supabase.functions.invoke('resumir-publicacoes', {
        body: { 
          monitoramentoId: monitoramentoId || null,
          publicacoes: pubsParaResumir.map(p => ({
            id: p.id,
            conteudo: p.conteudo,
            data: p.data_publicacao,
            processo: p.processo_numero,
          }))
        }
      });

      if (error) throw error;
      if (!data.resumo) throw new Error("Erro ao gerar resumo");

      return data.resumo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumo-monitoramento'] });
      toast.success("Resumo gerado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao gerar resumo: ${error.message}`);
    },
  });

  const marcarComoLida = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('publicacoes_djen')
        .update({ lida: true })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analise-djen'] });
      toast.success("Publicação(ões) marcada(s) como lida(s)");
    },
  });

  return {
    publicacoes,
    isLoading,
    ultimoResumo,
    loadingResumo,
    gerarResumoIA,
    marcarComoLida,
  };
}
