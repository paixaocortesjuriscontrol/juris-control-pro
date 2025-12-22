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
  resumo_ia: string | null;
  resumo_gerado_em: string | null;
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

export interface FiltrosAnalise {
  coordenacaoId?: string;
  dataInicio?: string;
  dataFim?: string;
  termoBusca?: string;
  apenasNaoLidas?: boolean;
}

export function useAnaliseDjen(filtros: FiltrosAnalise = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: publicacoes = [], isLoading } = useQuery({
    queryKey: ['analise-djen', user?.id, filtros],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('publicacoes_djen')
        .select(`
          *,
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

      if (filtros.termoBusca) {
        const termo = filtros.termoBusca.toLowerCase();
        filtered = filtered.filter(p => 
          p.monitoramento?.termo_busca?.toLowerCase().includes(termo) ||
          p.conteudo?.toLowerCase().includes(termo) ||
          p.processo_numero?.toLowerCase().includes(termo)
        );
      }

      return filtered;
    },
    enabled: !!user?.id,
  });

  const gerarResumoIA = useMutation({
    mutationFn: async (publicacaoIds: string[]) => {
      const pubsParaResumir = publicacoes.filter(p => publicacaoIds.includes(p.id));
      
      if (pubsParaResumir.length === 0) {
        throw new Error("Nenhuma publicação selecionada");
      }

      const { data, error } = await supabase.functions.invoke('resumir-publicacoes', {
        body: { 
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

      // Save resumo to each publication
      for (const pubId of publicacaoIds) {
        await supabase
          .from('publicacoes_djen')
          .update({ 
            resumo_ia: data.resumo,
            resumo_gerado_em: new Date().toISOString()
          })
          .eq('id', pubId);
      }

      return data.resumo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analise-djen'] });
      toast.success("Resumo gerado e salvo com sucesso!");
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
    gerarResumoIA,
    marcarComoLida,
  };
}
