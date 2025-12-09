import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Redistribuicao {
  id: string;
  processo_id: string;
  processo_numero: string;
  processo_area: string;
  coordenacao_nome: string | null;
  advogado_nome: string | null;
  vara_antiga: string;
  vara_nova: string;
  data_redistribuicao: string;
}

export function useRedistribuicoes(filters?: {
  dataInicio?: string;
  dataFim?: string;
  processoNumero?: string;
  coordenacaoId?: string;
}) {
  return useQuery({
    queryKey: ['redistribuicoes', filters],
    queryFn: async () => {
      let query = supabase
        .from('movimentacoes')
        .select(`
          id,
          processo_id,
          descricao,
          data_movimentacao,
          processos (
            numero,
            area,
            vara,
            coordenacao_id,
            coordenacoes (nome),
            advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey (nome)
          )
        `)
        .eq('tipo', 'Redistribuição')
        .order('data_movimentacao', { ascending: false });

      if (filters?.dataInicio) {
        query = query.gte('data_movimentacao', filters.dataInicio);
      }
      if (filters?.dataFim) {
        query = query.lte('data_movimentacao', filters.dataFim + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) throw error;

      // Parse e formatar os dados
      const redistribuicoes: Redistribuicao[] = (data || [])
        .filter((mov: any) => {
          // Filtrar por número do processo se especificado
          if (filters?.processoNumero) {
            return mov.processos?.numero?.toLowerCase().includes(filters.processoNumero.toLowerCase());
          }
          // Filtrar por coordenação se especificado
          if (filters?.coordenacaoId && filters.coordenacaoId !== 'all') {
            return mov.processos?.coordenacao_id === filters.coordenacaoId;
          }
          return true;
        })
        .map((mov: any) => {
          // Parse da descrição para extrair vara antiga e nova
          // Formato esperado: "Redistribuição detectada: vara_antiga -> vara_nova"
          const match = mov.descricao?.match(/Redistribuição detectada: (.+) -> (.+)/);
          const varaAntiga = match?.[1] || 'N/A';
          const varaNova = match?.[2] || mov.processos?.vara || 'N/A';

          return {
            id: mov.id,
            processo_id: mov.processo_id,
            processo_numero: mov.processos?.numero || 'N/A',
            processo_area: mov.processos?.area || 'civil',
            coordenacao_nome: mov.processos?.coordenacoes?.nome || null,
            advogado_nome: mov.processos?.advogado_responsavel?.nome || null,
            vara_antiga: varaAntiga,
            vara_nova: varaNova,
            data_redistribuicao: mov.data_movimentacao,
          };
        });

      return redistribuicoes;
    },
  });
}

// Hook para verificar se um processo teve redistribuição recente (últimos 7 dias)
export function useProcessosComRedistribuicaoRecente() {
  return useQuery({
    queryKey: ['processos-redistribuicao-recente'],
    queryFn: async () => {
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const { data, error } = await supabase
        .from('movimentacoes')
        .select('processo_id')
        .eq('tipo', 'Redistribuição')
        .gte('data_movimentacao', seteDiasAtras.toISOString());

      if (error) throw error;

      // Retorna um Set de IDs de processos com redistribuição recente
      return new Set((data || []).map((m: any) => m.processo_id));
    },
  });
}
