import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MonitoramentoDjen {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo';
  termo_busca: string;
  oab?: string;
  uf?: string;
  coordenacao_id?: string;
  ativo: boolean;
  criado_por: string;
  created_at: string;
  updated_at: string;
  // Novos campos avançados
  descricao?: string;
  exclusoes?: string[];
  condicao_concomitante?: string;
  tribunais?: string[];
}

export interface PublicacaoDjen {
  id: string;
  monitoramento_id: string;
  hash_conteudo: string;
  data_publicacao: string | null;
  processo_numero: string | null;
  conteudo: string | null;
  fonte: string | null;
  lida: boolean;
  created_at: string;
  importada_de_descartada?: boolean;
}

export interface PublicacaoDescartada {
  id: string;
  monitoramento_id: string;
  hash_conteudo: string;
  data_publicacao: string | null;
  processo_numero: string | null;
  conteudo: string | null;
  fonte: string | null;
  motivo_descarte: string;
  created_at: string;
}

export function useMonitoramentosDjen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: monitoramentos = [], isLoading } = useQuery({
    queryKey: ['monitoramentos-djen', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MonitoramentoDjen[];
    },
    enabled: !!user?.id,
  });

  const { data: publicacoes = [], isLoading: loadingPublicacoes } = useQuery({
    queryKey: ['publicacoes-djen', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('publicacoes_djen')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as PublicacaoDjen[];
    },
    enabled: !!user?.id,
  });

  const { data: descartadas = [], isLoading: loadingDescartadas } = useQuery({
    queryKey: ['publicacoes-djen-descartadas', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('publicacoes_djen_descartadas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as PublicacaoDescartada[];
    },
    enabled: !!user?.id,
  });

  const criarMonitoramento = useMutation({
    mutationFn: async (dados: Omit<MonitoramentoDjen, 'id' | 'criado_por' | 'created_at' | 'updated_at' | 'ativo'>) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from('monitoramentos_djen')
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
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-djen'] });
      toast.success("Monitoramento criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar monitoramento: ${error.message}`);
    },
  });

  const atualizarMonitoramento = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<MonitoramentoDjen> & { id: string }) => {
      const { error } = await supabase
        .from('monitoramentos_djen')
        .update(dados)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-djen'] });
      toast.success("Monitoramento atualizado!");
    },
  });

  const excluirMonitoramento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('monitoramentos_djen')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-djen'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-descartadas'] });
      toast.success("Monitoramento excluído!");
    },
    onError: (error) => {
      console.error("Erro ao excluir monitoramento:", error);
      toast.error(`Erro ao excluir monitoramento: ${error.message}`);
    },
  });

  const marcarPublicacaoLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('publicacoes_djen')
        .update({ lida: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
    },
  });

  const importarDescartada = useMutation({
    mutationFn: async (descartadaId: string) => {
      // Buscar a publicação descartada
      const { data: descartada, error: fetchError } = await supabase
        .from('publicacoes_djen_descartadas')
        .select('*')
        .eq('id', descartadaId)
        .single();

      if (fetchError) throw fetchError;

      // Inserir na tabela principal
      const { error: insertError } = await supabase
        .from('publicacoes_djen')
        .insert({
          monitoramento_id: descartada.monitoramento_id,
          hash_conteudo: descartada.hash_conteudo,
          data_publicacao: descartada.data_publicacao,
          processo_numero: descartada.processo_numero,
          conteudo: descartada.conteudo,
          fonte: descartada.fonte,
          importada_de_descartada: true,
        });

      if (insertError) throw insertError;

      // Remover das descartadas
      const { error: deleteError } = await supabase
        .from('publicacoes_djen_descartadas')
        .delete()
        .eq('id', descartadaId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-descartadas'] });
      toast.success("Publicação importada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao importar: ${error.message}`);
    },
  });

  const descartarDefinitivamente = useMutation({
    mutationFn: async (descartadaId: string) => {
      const { error } = await supabase
        .from('publicacoes_djen_descartadas')
        .delete()
        .eq('id', descartadaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-descartadas'] });
      toast.success("Publicação descartada definitivamente!");
    },
  });

  return {
    monitoramentos,
    publicacoes,
    descartadas,
    isLoading,
    loadingPublicacoes,
    loadingDescartadas,
    criarMonitoramento,
    atualizarMonitoramento,
    excluirMonitoramento,
    marcarPublicacaoLida,
    importarDescartada,
    descartarDefinitivamente,
  };
}