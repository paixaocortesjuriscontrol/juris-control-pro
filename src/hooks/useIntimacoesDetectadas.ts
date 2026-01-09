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

      // Check if status is a special filter (vencidas, proximas)
      const isSpecialFilter = filtros.status === "vencidas" || filtros.status === "proximas";
      const statusToQuery = isSpecialFilter ? "pendente" : filtros.status;

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

      if (statusToQuery && statusToQuery !== "todos") {
        query = query.eq("status", statusToQuery);
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

      // Normalizar datas para meia-noite no horário de Brasília
      const agora = new Date();
      const hojeBrt = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      hojeBrt.setHours(0, 0, 0, 0);
      const seteDias = new Date(hojeBrt.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Apply special filters for vencidas and proximas
      if (filtros.status === "vencidas") {
        result = result.filter((i: any) => {
          if (!i.data_limite) return false;
          const [ano, mes, dia] = i.data_limite.split('T')[0].split('-').map(Number);
          const dataLimite = new Date(ano, mes - 1, dia);
          dataLimite.setHours(0, 0, 0, 0);
          return dataLimite < hojeBrt;
        });
      } else if (filtros.status === "proximas") {
        result = result.filter((i: any) => {
          if (!i.data_limite) return false;
          const [ano, mes, dia] = i.data_limite.split('T')[0].split('-').map(Number);
          const dataLimite = new Date(ano, mes - 1, dia);
          dataLimite.setHours(0, 0, 0, 0);
          return dataLimite >= hojeBrt && dataLimite <= seteDias;
        });
      }

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

  // Stats via COUNT no banco (sem limite)
  const { data: statsData } = useQuery({
    queryKey: ['intimacoes-stats', filtros.coordenacaoId],
    queryFn: async () => {
      const coordAtiva = Boolean(
        filtros.coordenacaoId && filtros.coordenacaoId !== "todas"
      );

      let processosIds: string[] | null = null;
      if (coordAtiva) {
        const { data: processosCoord } = await supabase
          .from("processos")
          .select("id")
          .eq("coordenacao_id", filtros.coordenacaoId as string);
        processosIds = (processosCoord || []).map(p => p.id);
        if (processosIds.length === 0) {
          return { pendentes: 0, tratadas: 0, ignoradas: 0, emAndamento: 0, proximas: 0, vencidas: 0 };
        }
      }

      // Build base query helper
      const buildQuery = (status?: string) => {
        let q = supabase.from('intimacoes_detectadas').select('*', { count: 'exact', head: true });
        if (status) q = q.eq('status', status);
        if (processosIds) q = q.in('processo_id', processosIds);
        return q;
      };

      const hoje = new Date().toISOString().split('T')[0];
      const seteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [pendentesRes, tratadasRes, ignoradasRes, emAndamentoRes, vencidasRes, proximasRes] = await Promise.all([
        buildQuery('pendente'),
        buildQuery('tratado'),
        buildQuery('ignorado'),
        buildQuery('em_andamento'),
        // Vencidas: pendente E data_limite < hoje
        buildQuery('pendente').lt('data_limite', hoje),
        // Próximas: pendente E data_limite entre hoje e 7 dias
        buildQuery('pendente').gte('data_limite', hoje).lte('data_limite', seteDias),
      ]);

      return {
        pendentes: pendentesRes.count || 0,
        tratadas: tratadasRes.count || 0,
        ignoradas: ignoradasRes.count || 0,
        emAndamento: emAndamentoRes.count || 0,
        vencidas: vencidasRes.count || 0,
        proximas: proximasRes.count || 0,
      };
    },
    staleTime: 30000,
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

  // Estatísticas via COUNT no banco
  const pendentes = statsData?.pendentes ?? 0;
  const tratadas = statsData?.tratadas ?? 0;
  const ignoradas = statsData?.ignoradas ?? 0;
  const emAndamento = statsData?.emAndamento ?? 0;
  const proximas = statsData?.proximas ?? 0;
  const vencidas = statsData?.vencidas ?? 0;

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
