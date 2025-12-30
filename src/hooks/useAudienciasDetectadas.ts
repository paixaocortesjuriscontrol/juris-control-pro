import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AudienciaDetectada {
  id: string;
  publicacao_id: string | null;
  monitoramento_id: string;
  processo_numero: string | null;
  data_audiencia: string | null;
  tipo_audiencia: string | null;
  local_audiencia: string | null;
  contexto: string | null;
  conteudo_publicacao: string | null;
  status: string;
  tratado_por: string | null;
  tratado_em: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  monitoramento?: {
    termo_busca: string;
    descricao: string | null;
  };
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
        .order('created_at', { ascending: false });

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
          a.tipo_audiencia?.toLowerCase().includes(searchLower)
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
    pendentes,
    tratadas,
    ignoradas,
    proximas,
  };
}
