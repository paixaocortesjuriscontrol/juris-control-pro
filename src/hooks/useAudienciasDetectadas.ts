import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AudienciaDetectada {
  id: string;
  publicacao_id: string | null;
  monitoramento_id: string | null;
  processo_numero: string | null;
  data_audiencia: string | null;
  hora: string | null;
  tipo_audiencia: string | null;
  local_audiencia: string | null;
  vara_camara: string | null;
  comarca: string | null;
  polo_ativo: string | null;
  cliente: string | null;
  terceirizado: string | null;
  resumo_objeto: string | null;
  funcao: string | null;
  preposto: string | null;
  testemunhas: string | null;
  advogado: string | null;
  contexto: string | null;
  conteudo_publicacao: string | null;
  status: string;
  tratado_por: string | null;
  tratado_em: string | null;
  observacoes: string | null;
  origem: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  monitoramento?: {
    termo_busca: string;
    descricao: string | null;
  };
}

export interface NovaAudiencia {
  processo_numero: string;
  data_audiencia: string;
  hora?: string;
  tipo_audiencia?: string;
  vara_camara?: string;
  comarca?: string;
  polo_ativo?: string;
  cliente?: string;
  terceirizado?: string;
  resumo_objeto?: string;
  funcao?: string;
  preposto?: string;
  testemunhas?: string;
  advogado?: string;
  observacoes?: string;
}

interface AudienciasFiltros {
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  search?: string;
}

export function useAudienciasDetectadas(filtros: AudienciasFiltros = {}) {
  const queryClient = useQueryClient();

  // Buscar audiências
  const { data: audiencias = [], isLoading } = useQuery({
    queryKey: ['audiencias-detectadas', filtros],
    queryFn: async () => {
      let query = supabase
        .from('audiencias_detectadas')
        .select(`
          *,
          monitoramento:monitoramentos_djen(termo_busca, descricao)
        `)
        .order('data_audiencia', { ascending: true, nullsFirst: false });

      if (filtros.status && filtros.status !== 'todos') {
        query = query.eq('status', filtros.status);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_audiencia', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_audiencia', filtros.dataFim);
      }

      const { data, error } = await query.limit(200);

      if (error) throw error;
      
      // Filtrar por busca no client-side
      let result = data as AudienciaDetectada[];
      if (filtros.search) {
        const searchLower = filtros.search.toLowerCase();
        result = result.filter(a => 
          a.processo_numero?.toLowerCase().includes(searchLower) ||
          a.contexto?.toLowerCase().includes(searchLower) ||
          a.tipo_audiencia?.toLowerCase().includes(searchLower) ||
          a.cliente?.toLowerCase().includes(searchLower) ||
          a.advogado?.toLowerCase().includes(searchLower) ||
          a.comarca?.toLowerCase().includes(searchLower)
        );
      }
      
      return result;
    },
  });

  // Atualizar status
  const atualizarAudiencia = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: string; status: string; observacoes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: Record<string, unknown> = { status };
      if (status === 'tratado' || status === 'ignorado') {
        updates.tratado_por = user?.id;
        updates.tratado_em = new Date().toISOString();
      }
      if (observacoes !== undefined) {
        updates.observacoes = observacoes;
      }

      const { error } = await supabase
        .from('audiencias_detectadas')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
      toast.success('Audiência atualizada!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // Criar audiência manual
  const criarAudiencia = useMutation({
    mutationFn: async (novaAudiencia: NovaAudiencia) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('audiencias_detectadas')
        .insert({
          ...novaAudiencia,
          origem: 'manual',
          criado_por: user.id,
          status: 'pendente',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
      toast.success('Audiência cadastrada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  // Estatísticas
  const pendentes = audiencias.filter(a => a.status === 'pendente').length;
  const tratadas = audiencias.filter(a => a.status === 'tratado').length;
  const ignoradas = audiencias.filter(a => a.status === 'ignorado').length;
  
  // Audiências próximas (nos próximos 7 dias)
  const hoje = new Date();
  const em7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
  const proximas = audiencias.filter(a => {
    if (!a.data_audiencia || a.status !== 'pendente') return false;
    const dataAud = new Date(a.data_audiencia);
    return dataAud >= hoje && dataAud <= em7Dias;
  }).length;

  return {
    audiencias,
    isLoading,
    atualizarAudiencia,
    criarAudiencia,
    pendentes,
    tratadas,
    ignoradas,
    proximas,
  };
}
