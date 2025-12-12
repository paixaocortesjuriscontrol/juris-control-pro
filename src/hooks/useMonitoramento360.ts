import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TermoMonitoramento {
  id: string;
  termo: string;
  descricao: string | null;
  categoria: string;
  prioridade: string;
  ativo: boolean;
  criado_por: string;
  created_at: string;
  updated_at: string;
}

export interface AlertaMonitoramento {
  id: string;
  termo_id: string;
  processo_id: string;
  movimentacao_id: string | null;
  termo_encontrado: string;
  contexto: string | null;
  prioridade: string;
  status: string;
  tratado_por: string | null;
  tratado_em: string | null;
  observacoes: string | null;
  created_at: string;
  termo?: TermoMonitoramento;
  processo?: {
    numero: string;
    polo_ativo: string | null;
    polo_passivo: string | null;
    vara: string | null;
  };
  movimentacao?: {
    descricao: string;
    data_movimentacao: string;
  };
}

export interface CarteiraProcessos {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  criterios: Record<string, any>;
  cor: string;
  criado_por: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIAS = [
  { value: 'bloqueio', label: 'Bloqueio' },
  { value: 'liminar', label: 'Liminar' },
  { value: 'sentenca', label: 'Sentença' },
  { value: 'decisao', label: 'Decisão' },
  { value: 'citacao', label: 'Citação' },
  { value: 'geral', label: 'Geral' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export function useMonitoramento360() {
  const queryClient = useQueryClient();

  // Buscar termos de monitoramento
  const { data: termos = [], isLoading: loadingTermos } = useQuery({
    queryKey: ['termos-monitoramento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('termos_monitoramento')
        .select('*')
        .order('categoria', { ascending: true })
        .order('termo', { ascending: true });

      if (error) throw error;
      return data as TermoMonitoramento[];
    },
  });

  // Buscar alertas
  const { data: alertas = [], isLoading: loadingAlertas } = useQuery({
    queryKey: ['alertas-monitoramento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alertas_monitoramento')
        .select(`
          *,
          termo:termos_monitoramento(*),
          processo:processos(numero, polo_ativo, polo_passivo, vara),
          movimentacao:movimentacoes(descricao, data_movimentacao)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AlertaMonitoramento[];
    },
  });

  // Buscar carteiras
  const { data: carteiras = [], isLoading: loadingCarteiras } = useQuery({
    queryKey: ['carteiras-processos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carteiras_processos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as CarteiraProcessos[];
    },
  });

  // Criar termo
  const criarTermo = useMutation({
    mutationFn: async (termo: Omit<TermoMonitoramento, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('termos_monitoramento')
        .insert(termo)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termos-monitoramento'] });
      toast.success('Termo criado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao criar termo: ${error.message}`);
    },
  });

  // Atualizar termo
  const atualizarTermo = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TermoMonitoramento> & { id: string }) => {
      const { error } = await supabase
        .from('termos_monitoramento')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termos-monitoramento'] });
      toast.success('Termo atualizado!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar termo: ${error.message}`);
    },
  });

  // Excluir termo
  const excluirTermo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('termos_monitoramento')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termos-monitoramento'] });
      toast.success('Termo excluído!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir termo: ${error.message}`);
    },
  });

  // Atualizar status do alerta
  const atualizarAlerta = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: string; status: string; observacoes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: any = { status };
      if (status === 'tratado' || status === 'ignorado') {
        updates.tratado_por = user?.id;
        updates.tratado_em = new Date().toISOString();
      }
      if (observacoes !== undefined) {
        updates.observacoes = observacoes;
      }

      const { error } = await supabase
        .from('alertas_monitoramento')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas-monitoramento'] });
      toast.success('Alerta atualizado!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar alerta: ${error.message}`);
    },
  });

  // Executar varredura nos andamentos existentes
  const executarVarredura = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('monitorar-termos');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alertas-monitoramento'] });
      const alertasEncontrados = data?.alertasGerados || 0;
      toast.success(`Varredura concluída: ${alertasEncontrados} alertas gerados`);
    },
    onError: (error) => {
      toast.error(`Erro na varredura: ${error.message}`);
    },
  });

  // Estatísticas
  const alertasPendentes = alertas.filter(a => a.status === 'pendente').length;
  const alertasUrgentes = alertas.filter(a => a.status === 'pendente' && a.prioridade === 'urgente').length;
  const termosAtivos = termos.filter(t => t.ativo).length;

  return {
    termos,
    alertas,
    carteiras,
    loadingTermos,
    loadingAlertas,
    loadingCarteiras,
    criarTermo,
    atualizarTermo,
    excluirTermo,
    atualizarAlerta,
    executarVarredura,
    alertasPendentes,
    alertasUrgentes,
    termosAtivos,
    CATEGORIAS,
    PRIORIDADES,
  };
}
