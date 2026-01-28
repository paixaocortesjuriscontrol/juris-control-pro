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
    coordenacao_id: string | null;
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

export function useMonitoramento360(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;

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
    enabled,
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
          processo:processos(numero, polo_ativo, polo_passivo, vara, coordenacao_id),
          movimentacao:movimentacoes(descricao, data_movimentacao)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AlertaMonitoramento[];
    },
    enabled,
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
    enabled,
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
      // Rodar varredura completa (modo robusto com auto-continuação em lotes)
      const { data, error } = await supabase.functions.invoke('monitorar-termos', {
        body: { completeRun: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alertas-monitoramento'] });

      if (data?.cancelled) {
        toast.info('Varredura cancelada.');
        return;
      }

      // Quando não está completo, a função seguirá rodando em background; o usuário pode acompanhar no painel de Configurações.
      if (data?.isComplete) {
        const alertasEncontrados = data?.alertasGerados || 0;
        toast.success(`Varredura concluída: ${alertasEncontrados} alertas gerados`);
      } else {
        toast.message('Varredura iniciada — ela continuará em lotes automaticamente.');
      }
    },
    onError: (error) => {
      toast.error(`Erro na varredura: ${error.message}`);
    },
  });

  // Criar carteira
  const criarCarteira = useMutation({
    mutationFn: async (carteira: { nome: string; descricao?: string; tipo: string; criterios: Record<string, any>; cor: string; criado_por: string }) => {
      const { data, error } = await supabase
        .from('carteiras_processos')
        .insert(carteira)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carteiras-processos'] });
      toast.success('Carteira criada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao criar carteira: ${error.message}`);
    },
  });

  // Atualizar carteira
  const atualizarCarteira = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CarteiraProcessos> & { id: string }) => {
      const { error } = await supabase
        .from('carteiras_processos')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carteiras-processos'] });
      toast.success('Carteira atualizada!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar carteira: ${error.message}`);
    },
  });

  // Excluir carteira
  const excluirCarteira = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('carteiras_processos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carteiras-processos'] });
      toast.success('Carteira excluída!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir carteira: ${error.message}`);
    },
  });

  // Estatísticas
  const alertasPendentes = alertas.filter(a => a.status === 'pendente').length;
  const alertasUrgentes = alertas.filter(a => a.status === 'pendente' && a.prioridade === 'urgente').length;
  const termosAtivos = termos.filter(t => t.ativo).length;
  const carteirasAtivas = carteiras.filter(c => c.ativo).length;

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
    criarCarteira,
    atualizarCarteira,
    excluirCarteira,
    atualizarAlerta,
    executarVarredura,
    alertasPendentes,
    alertasUrgentes,
    termosAtivos,
    carteirasAtivas,
    CATEGORIAS,
    PRIORIDADES,
  };
}
