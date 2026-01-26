import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfigAlertaCoordenacao {
  id: string;
  coordenacao_id: string;
  email_habilitado: boolean;
  whatsapp_habilitado: boolean;
  tipos_alerta: string[];
  apenas_urgentes: boolean;
  horario_inicio: string | null;
  horario_fim: string | null;
  dias_semana: number[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface HistoricoAlertaEnviado {
  id: string;
  coordenacao_id: string;
  tipo_alerta: string;
  canal: 'email' | 'whatsapp';
  destinatario: string;
  conteudo: string;
  referencia_id: string | null;
  enviado_em: string;
  status: 'enviado' | 'falha' | 'pendente';
  erro: string | null;
}

export const TIPOS_ALERTA = [
  { value: 'djen', label: 'Publicações DJEN', icon: '📰' },
  { value: 'distribuicoes', label: 'Novas Distribuições', icon: '⚖️' },
  { value: 'alertas360', label: 'Alertas 360°', icon: '🎯' },
  { value: 'redistribuicoes', label: 'Redistribuições', icon: '🔄' },
  { value: 'audiencias', label: 'Audiências Detectadas', icon: '📅' },
  { value: 'tarefas', label: 'Tarefas e Prazos', icon: '✅' },
  { value: 'andamentos', label: 'Novos Andamentos', icon: '📋' },
];

export const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export function useConfigAlertasCoordenacao(coordenacaoId?: string) {
  const queryClient = useQueryClient();

  // Buscar todas as configs ou uma específica
  const { data: configs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['config-alertas-coordenacao', coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from('config_alertas_coordenacao')
        .select('*');
      
      if (coordenacaoId) {
        query = query.eq('coordenacao_id', coordenacaoId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ConfigAlertaCoordenacao[];
    },
  });

  // Buscar histórico de alertas enviados
  const { data: historico = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ['historico-alertas-enviados', coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from('historico_alertas_enviados')
        .select('*')
        .order('enviado_em', { ascending: false })
        .limit(100);
      
      if (coordenacaoId) {
        query = query.eq('coordenacao_id', coordenacaoId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as HistoricoAlertaEnviado[];
    },
  });

  // Criar ou atualizar config
  const salvarConfig = useMutation({
    mutationFn: async (config: Partial<ConfigAlertaCoordenacao> & { coordenacao_id: string }) => {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('config_alertas_coordenacao')
        .select('id')
        .eq('coordenacao_id', config.coordenacao_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('config_alertas_coordenacao')
          .update({
            email_habilitado: config.email_habilitado,
            whatsapp_habilitado: config.whatsapp_habilitado,
            tipos_alerta: config.tipos_alerta,
            apenas_urgentes: config.apenas_urgentes,
            horario_inicio: config.horario_inicio,
            horario_fim: config.horario_fim,
            dias_semana: config.dias_semana,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_alertas_coordenacao')
          .insert(config);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-alertas-coordenacao'] });
      toast.success('Configuração salva com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configuração: ' + error.message);
    },
  });

  // Deletar config
  const deletarConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('config_alertas_coordenacao')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-alertas-coordenacao'] });
      toast.success('Configuração removida');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  // Obter config de uma coordenação específica (memoizado para evitar resets de estado em componentes consumidores)
  const getConfigByCoordenacao = useCallback(
    (id: string) => configs.find((c) => c.coordenacao_id === id),
    [configs]
  );

  // Estatísticas de envio por coordenação
  const estatisticasEnvio = (id?: string) => {
    const filtered = id ? historico.filter(h => h.coordenacao_id === id) : historico;
    return {
      total: filtered.length,
      emails: filtered.filter(h => h.canal === 'email').length,
      whatsapp: filtered.filter(h => h.canal === 'whatsapp').length,
      falhas: filtered.filter(h => h.status === 'falha').length,
      ultimoEnvio: filtered[0]?.enviado_em || null,
    };
  };

  return {
    configs,
    historico,
    loadingConfigs,
    loadingHistorico,
    salvarConfig,
    deletarConfig,
    getConfigByCoordenacao,
    estatisticasEnvio,
    TIPOS_ALERTA,
    DIAS_SEMANA,
  };
}
