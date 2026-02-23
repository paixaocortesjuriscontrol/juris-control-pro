import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  orgao: string | null;
  tipo_comunicacao: string | null;
  meio: string | null;
  partes_json: any[] | null;
  advogados_json: any[] | null;
  monitoramento?: {
    id: string;
    tipo: string;
    termo_busca: string;
    oab: string | null;
    uf: string | null;
    coordenacao_id: string | null;
    coordenacao?: {
      id: string;
      nome: string;
    } | null;
  };
}

export interface FiltrosDescartadas {
  coordenacaoId?: string;
  monitoramentoId?: string;
  dataInicio?: string;
  dataFim?: string;
  termoBusca?: string;
}

export function useDescartadasDjen(filtros: FiltrosDescartadas = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: descartadas = [], isLoading } = useQuery({
    queryKey: ['descartadas-djen', user?.id, filtros],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('publicacoes_djen_descartadas')
        .select(`
          id,
          monitoramento_id,
          hash_conteudo,
          data_publicacao,
          processo_numero,
          conteudo,
          fonte,
          motivo_descarte,
          created_at,
          orgao,
          tipo_comunicacao,
          meio,
          partes_json,
          advogados_json,
          monitoramento:monitoramentos_djen(
            id,
            tipo,
            termo_busca,
            oab,
            uf,
            coordenacao_id,
            coordenacao:coordenacoes(id, nome)
          )
        `)
        .order('created_at', { ascending: false });

      if (filtros.dataInicio) {
        query = query.gte('created_at', filtros.dataInicio);
      }
      
      if (filtros.dataFim) {
        query = query.lte('created_at', `${filtros.dataFim}T23:59:59`);
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;

      let filtered = data as PublicacaoDescartada[];
      
      if (filtros.coordenacaoId) {
        filtered = filtered.filter(p => 
          p.monitoramento?.coordenacao_id === filtros.coordenacaoId
        );
      }

      if (filtros.monitoramentoId) {
        filtered = filtered.filter(p => 
          p.monitoramento_id === filtros.monitoramentoId
        );
      }

      if (filtros.termoBusca) {
        const termo = filtros.termoBusca.toLowerCase();
        const termoDigits = termo.replace(/\D/g, '');
        filtered = filtered.filter(p => {
          if (p.monitoramento?.termo_busca?.toLowerCase().includes(termo)) return true;
          if (p.conteudo?.toLowerCase().includes(termo)) return true;
          if (p.processo_numero?.toLowerCase().includes(termo)) return true;
          // Busca por número de processo normalizado (sem pontos/traços)
          if (termoDigits.length >= 5 && p.processo_numero) {
            const procDigits = p.processo_numero.replace(/\D/g, '');
            if (procDigits.includes(termoDigits) || termoDigits.includes(procDigits)) return true;
          }
          return false;
        });
      }

      return filtered;
    },
    enabled: !!user?.id,
  });

  const importarDescartada = useMutation({
    mutationFn: async (descartadaId: string) => {
      const descartada = descartadas.find(d => d.id === descartadaId);
      if (!descartada) throw new Error("Publicação não encontrada");

      // Insert into publicacoes_djen
      const { error: insertError } = await supabase
        .from('publicacoes_djen')
        .insert({
          monitoramento_id: descartada.monitoramento_id,
          hash_conteudo: descartada.hash_conteudo,
          data_publicacao: descartada.data_publicacao,
          processo_numero: descartada.processo_numero,
          conteudo: descartada.conteudo,
          fonte: descartada.fonte,
          lida: false,
          importada_de_descartada: true,
          orgao: descartada.orgao,
          tipo_comunicacao: descartada.tipo_comunicacao,
          meio: descartada.meio,
          partes_json: descartada.partes_json,
          advogados_json: descartada.advogados_json,
        });

      if (insertError) throw insertError;

      // Delete from descartadas
      const { error: deleteError } = await supabase
        .from('publicacoes_djen_descartadas')
        .delete()
        .eq('id', descartadaId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['descartadas-djen'] });
      queryClient.invalidateQueries({ queryKey: ['analise-djen'] });
      toast.success("Publicação importada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao importar: ${error.message}`);
    },
  });

  const descartarDefinitivamente = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('publicacoes_djen_descartadas')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['descartadas-djen'] });
      toast.success("Publicação(ões) descartada(s) definitivamente");
    },
  });

  return {
    descartadas,
    isLoading,
    importarDescartada,
    descartarDefinitivamente,
  };
}
