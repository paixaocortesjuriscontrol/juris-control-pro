import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface IntimacaoDetectada {
  id: string;
  processo_numero: string | null;
  processo_id: string | null;
  movimentacao_id: string | null;
  data_disponibilizacao: string | null; // Data que o DJEN publicou
  data_intimacao: string | null; // Primeiro dia útil seguinte (publicação oficial)
  data_limite: string | null; // Prazo final
  tipo_intimacao: string | null;
  orgao_intimante: string | null;
  descricao: string | null;
  contexto: string | null;
  conteudo_publicacao: string | null;
  status: string;
  prazo_dias: number | null;
  prioridade: string | null;
  observacoes: string | null;
  providencias_tomadas: string | null;
  tratado_por: string | null;
  tratado_em: string | null;
  origem: string | null;
  criado_por: string | null;
  hash_dedup: string | null;
  created_at: string;
  updated_at: string;
  // Campos do processo vinculado
  polo_ativo: string | null;
  polo_passivo: string | null;
}

export type StatusIntimacao = 'pendente' | 'tratado' | 'ignorado' | 'em_andamento';

export const STATUS_INTIMACAO_LABELS: Record<StatusIntimacao, string> = {
  pendente: 'Pendente',
  tratado: 'Tratado',
  ignorado: 'Ignorado',
  em_andamento: 'Em Andamento',
};

interface FiltrosIntimacao {
  status?: string;
  search?: string;
  dataInicio?: Date;
  dataFim?: Date;
  coordenacaoId?: string;
}

export function useIntimacoesDetectadas(filtros: FiltrosIntimacao = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query para buscar intimações filtradas (para a lista)
  const { data: intimacoes = [], isLoading } = useQuery({
    queryKey: ['intimacoes-detectadas', filtros],
    queryFn: async () => {
      // Filtro por coordenação: evita buscar milhares de processo_ids (pode estourar limite de URL no PostgREST).
      const coordAtiva = Boolean(
        filtros.coordenacaoId && filtros.coordenacaoId !== "todas"
      );

      // Sempre buscar dados do processo para exibir polo_ativo/polo_passivo
      const selectClause = coordAtiva
        ? "*, processos!inner(coordenacao_id, polo_ativo, polo_passivo)"
        : "*, processos(polo_ativo, polo_passivo)";

      let query = (supabase as any)
        .from("intimacoes_detectadas")
        .select(selectClause)
        .order("data_limite", { ascending: true, nullsFirst: false });

      if (coordAtiva) {
        query = query.eq("processos.coordenacao_id", filtros.coordenacaoId as string);
      }

      if (filtros.status && filtros.status !== "todos") {
        query = query.eq("status", filtros.status);
      }

      if (filtros.dataInicio) {
        query = query.gte("data_intimacao", filtros.dataInicio.toISOString());
      }

      if (filtros.dataFim) {
        query = query.lte("data_intimacao", filtros.dataFim.toISOString());
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar intimações:', error);
        throw error;
      }

      let result: any[] = (data as any[]) || [];

      // Extrair polo_ativo e polo_passivo do processo aninhado
      result = result.map(({ processos, ...rest }) => ({
        ...rest,
        polo_ativo: processos?.polo_ativo || null,
        polo_passivo: processos?.polo_passivo || null,
      }));

      // Filtro de busca client-side
      if (filtros.search) {
        const searchLower = filtros.search.toLowerCase();
        result = result.filter(i => 
          i.processo_numero?.toLowerCase().includes(searchLower) ||
          i.descricao?.toLowerCase().includes(searchLower) ||
          i.tipo_intimacao?.toLowerCase().includes(searchLower) ||
          i.orgao_intimante?.toLowerCase().includes(searchLower)
        );
      }

      return result as IntimacaoDetectada[];
    },
  });

  // Query separada para estatísticas (todas as intimações da coordenação, sem filtro de status)
  const { data: allIntimacoesForStats = [] } = useQuery({
    queryKey: ['intimacoes-detectadas-stats', filtros.coordenacaoId],
    queryFn: async () => {
      const coordAtiva = Boolean(
        filtros.coordenacaoId && filtros.coordenacaoId !== "todas"
      );

      const selectClause = coordAtiva
        ? "id, status, data_limite, processos!inner(coordenacao_id)"
        : "id, status, data_limite";

      let query = (supabase as any)
        .from("intimacoes_detectadas")
        .select(selectClause);

      if (coordAtiva) {
        query = query.eq("processos.coordenacao_id", filtros.coordenacaoId as string);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar stats intimações:', error);
        return [];
      }

      return (data as any[]) || [];
    },
  });

  const atualizarIntimacao = useMutation({
    mutationFn: async ({ id, status, observacoes, providencias_tomadas }: { 
      id: string; 
      status: string; 
      observacoes?: string;
      providencias_tomadas?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('intimacoes_detectadas')
        .update({ 
          status, 
          observacoes,
          providencias_tomadas,
          tratado_por: user?.user?.id,
          tratado_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intimacoes-detectadas'] });
      toast({
        title: "Intimação atualizada",
        description: "O status da intimação foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      console.error('Erro ao atualizar intimação:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar a intimação.",
        variant: "destructive",
      });
    },
  });

  const criarIntimacao = useMutation({
    mutationFn: async (intimacao: Partial<IntimacaoDetectada>) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('intimacoes_detectadas')
        .insert({
          ...intimacao,
          origem: 'manual',
          criado_por: user?.user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intimacoes-detectadas'] });
      toast({
        title: "Intimação cadastrada",
        description: "A intimação foi cadastrada com sucesso.",
      });
    },
    onError: (error) => {
      console.error('Erro ao criar intimação:', error);
      toast({
        title: "Erro ao cadastrar",
        description: "Não foi possível cadastrar a intimação.",
        variant: "destructive",
      });
    },
  });

  // Estatísticas - usar query separada que inclui todas as intimações da coordenação
  const stats = allIntimacoesForStats || [];
  const pendentes = stats.filter((i: any) => i.status === 'pendente').length;
  const tratadas = stats.filter((i: any) => i.status === 'tratado').length;
  const ignoradas = stats.filter((i: any) => i.status === 'ignorado').length;
  const emAndamento = stats.filter((i: any) => i.status === 'em_andamento').length;
  
  // Próximas 7 dias
  const hoje = new Date();
  const seteDias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
  const proximas = stats.filter((i: any) => {
    if (i.status !== 'pendente' || !i.data_limite) return false;
    const dataLimite = new Date(i.data_limite);
    return dataLimite >= hoje && dataLimite <= seteDias;
  }).length;

  // Vencidas
  const vencidas = stats.filter((i: any) => {
    if (i.status !== 'pendente' || !i.data_limite) return false;
    const dataLimite = new Date(i.data_limite);
    return dataLimite < hoje;
  }).length;

  return {
    intimacoes,
    isLoading,
    atualizarIntimacao,
    criarIntimacao,
    pendentes,
    tratadas,
    ignoradas,
    emAndamento,
    proximas,
    vencidas,
  };
}
