import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MonitoramentoDistribuicao {
  id: string;
  tipo: 'nome' | 'cpf_cnpj' | 'oab' | 'termo_chave';
  termo_busca: string;
  uf: string | null;
  tribunal: string | null;
  ativo: boolean;
  criado_por: string;
  ultima_execucao: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistribuicaoEncontrada {
  id: string;
  monitoramento_id: string;
  numero_processo: string;
  tribunal: string | null;
  vara: string | null;
  classe: string | null;
  assunto: string | null;
  polo_ativo: string | null;
  polo_passivo: string | null;
  data_distribuicao: string | null;
  dados_completos: any;
  status: 'pendente' | 'importado' | 'ignorado';
  processo_id: string | null;
  created_at: string;
}

export function useMonitoramentoDistribuicao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: monitoramentos = [], isLoading } = useQuery({
    queryKey: ['monitoramentos-distribuicao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitoramentos_distribuicao')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MonitoramentoDistribuicao[];
    },
  });

  const { data: distribuicoesEncontradas = [], isLoading: loadingDistribuicoes } = useQuery({
    queryKey: ['distribuicoes-encontradas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribuicoes_encontradas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as DistribuicaoEncontrada[];
    },
  });

  const criarMonitoramento = useMutation({
    mutationFn: async (dados: Omit<MonitoramentoDistribuicao, 'id' | 'criado_por' | 'created_at' | 'updated_at' | 'ativo' | 'ultima_execucao'>) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from('monitoramentos_distribuicao')
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
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-distribuicao'] });
      toast.success("Monitoramento criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar monitoramento: ${error.message}`);
    },
  });

  const atualizarMonitoramento = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<MonitoramentoDistribuicao> & { id: string }) => {
      const { error } = await supabase
        .from('monitoramentos_distribuicao')
        .update(dados)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-distribuicao'] });
      toast.success("Monitoramento atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const excluirMonitoramento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('monitoramentos_distribuicao')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-distribuicao'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicoes-encontradas'] });
      toast.success("Monitoramento excluído!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const importarDistribuicao = useMutation({
    mutationFn: async ({ distribuicaoId, coordenacaoId }: { distribuicaoId: string; coordenacaoId?: string }) => {
      // Buscar dados da distribuição
      const { data: distribuicao, error: fetchError } = await supabase
        .from('distribuicoes_encontradas')
        .select('*')
        .eq('id', distribuicaoId)
        .single();

      if (fetchError) throw fetchError;
      if (!distribuicao) throw new Error("Distribuição não encontrada");

      // Criar processo
      const { data: processo, error: processoError } = await supabase
        .from('processos')
        .insert({
          numero: distribuicao.numero_processo,
          tribunal: distribuicao.tribunal,
          vara: distribuicao.vara,
          classe: distribuicao.classe,
          assunto: distribuicao.assunto,
          polo_ativo: distribuicao.polo_ativo,
          polo_passivo: distribuicao.polo_passivo,
          data_distribuicao: distribuicao.data_distribuicao,
          area: 'civil',
          status: 'ativo',
          coordenacao_id: coordenacaoId || null,
        })
        .select()
        .single();

      if (processoError) throw processoError;

      // Atualizar status da distribuição
      const { error: updateError } = await supabase
        .from('distribuicoes_encontradas')
        .update({ 
          status: 'importado',
          processo_id: processo.id 
        })
        .eq('id', distribuicaoId);

      if (updateError) throw updateError;

      return processo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicoes-encontradas'] });
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast.success("Processo importado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao importar: ${error.message}`);
    },
  });

  const ignorarDistribuicao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('distribuicoes_encontradas')
        .update({ status: 'ignorado' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicoes-encontradas'] });
      toast.success("Distribuição marcada como ignorada");
    },
  });

  const executarMonitoramento = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('monitorar-distribuicoes');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-distribuicao'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicoes-encontradas'] });
      toast.success(`Monitoramento concluído: ${data?.novasDistribuicoes || 0} novas distribuições encontradas`);
    },
    onError: (error) => {
      toast.error(`Erro no monitoramento: ${error.message}`);
    },
  });

  const pendentes = distribuicoesEncontradas.filter(d => d.status === 'pendente');

  return {
    monitoramentos,
    distribuicoesEncontradas,
    pendentes,
    isLoading,
    loadingDistribuicoes,
    criarMonitoramento,
    atualizarMonitoramento,
    excluirMonitoramento,
    importarDistribuicao,
    ignorarDistribuicao,
    executarMonitoramento,
  };
}
