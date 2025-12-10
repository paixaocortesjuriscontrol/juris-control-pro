import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MonitoramentoPje {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo';
  termo_busca: string;
  oab?: string;
  uf?: string;
  ativo: boolean;
  criado_por: string;
  created_at: string;
  updated_at: string;
}

export interface PublicacaoPje {
  id: string;
  monitoramento_id: string;
  hash_conteudo: string;
  data_publicacao: string | null;
  processo_numero: string | null;
  conteudo: string | null;
  fonte: string | null;
  lida: boolean;
  created_at: string;
}

export function useMonitoramentosPje() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: monitoramentos = [], isLoading } = useQuery({
    queryKey: ['monitoramentos-pje', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('monitoramentos_pje')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MonitoramentoPje[];
    },
    enabled: !!user?.id,
  });

  const { data: publicacoes = [], isLoading: loadingPublicacoes } = useQuery({
    queryKey: ['publicacoes-pje', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('publicacoes_pje')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as PublicacaoPje[];
    },
    enabled: !!user?.id,
  });

  const criarMonitoramento = useMutation({
    mutationFn: async (dados: Omit<MonitoramentoPje, 'id' | 'criado_por' | 'created_at' | 'updated_at' | 'ativo'>) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from('monitoramentos_pje')
        .insert({
          ...dados,
          criado_por: user.id,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-pje'] });
      toast.success("Monitoramento PJE criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar monitoramento: ${error.message}`);
    },
  });

  const atualizarMonitoramento = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<MonitoramentoPje> & { id: string }) => {
      const { error } = await supabase
        .from('monitoramentos_pje')
        .update(dados)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-pje'] });
      toast.success("Monitoramento atualizado!");
    },
  });

  const excluirMonitoramento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('monitoramentos_pje')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-pje'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-pje'] });
      toast.success("Monitoramento excluído!");
    },
  });

  const marcarPublicacaoLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('publicacoes_pje')
        .update({ lida: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-pje'] });
    },
  });

  return {
    monitoramentos,
    publicacoes,
    isLoading,
    loadingPublicacoes,
    criarMonitoramento,
    atualizarMonitoramento,
    excluirMonitoramento,
    marcarPublicacaoLida,
  };
}
