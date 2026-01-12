import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const PAGE_SIZE = 50;

interface ProcessosPaginadosFilters {
  search?: string;
  area?: string;
  status?: string;
  coordenacao_id?: string;
  responsavel_id?: string;
  instancia?: string;
  comMovimento?: boolean;
  comPublicacaoDjen?: boolean;
  comAudiencia?: boolean;
  comIntimacao?: boolean;
  periodoInicio?: Date;
  periodoFim?: Date;
  clienteIds?: string[];
  tipoProcesso?: string;
  enabled?: boolean;
}

export function useProcessosPaginados(filters: ProcessosPaginadosFilters = {}) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["processos-paginados", page, filters],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: filters.enabled !== false, // Default to true
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_processos_paginados", {
        _page: page,
        _page_size: PAGE_SIZE,
        _search: filters.search || null,
        _area: filters.area && filters.area !== "all" ? filters.area : null,
        _status: filters.status && filters.status !== "all" ? filters.status : null,
        _coordenacao_id: filters.coordenacao_id && filters.coordenacao_id !== "all" ? filters.coordenacao_id : null,
        _responsavel_id: filters.responsavel_id || null,
        _instancia: filters.instancia && filters.instancia !== "todos" ? filters.instancia : null,
        _com_movimento: filters.comMovimento ?? false,
        _com_publicacao_djen: filters.comPublicacaoDjen ?? false,
        _com_audiencia: filters.comAudiencia ?? false,
        _com_intimacao: filters.comIntimacao ?? false,
        _periodo_inicio: filters.periodoInicio ? filters.periodoInicio.toISOString() : null,
        _periodo_fim: filters.periodoFim ? filters.periodoFim.toISOString() : null,
        _cliente_ids: filters.clienteIds && filters.clienteIds.length > 0 ? filters.clienteIds : null,
        _tipo_processo: filters.tipoProcesso && filters.tipoProcesso !== "all" ? filters.tipoProcesso : null,
      });

      if (error) throw error;

      const rows = data || [];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      // Buscar nomes das pastas apenas para os itens da página atual
      const pastaIds = Array.from(
        new Set(
          rows
            .map((r: any) => r.pasta_id as string | null | undefined)
            .filter((id: any): id is string => !!id)
        )
      );

      const pastasById = new Map<string, { id: string; nome: string }>();
      if (pastaIds.length > 0) {
        const { data: pastasData, error: pastasError } = await supabase
          .from("pastas")
          .select("id, nome")
          .in("id", pastaIds);

        if (!pastasError) {
          (pastasData || []).forEach((p) => pastasById.set(p.id, { id: p.id, nome: p.nome }));
        }
      }

      // Map RPC result to the expected shape
      const processos = rows.map((row: any) => ({
        id: row.id,
        numero: row.numero,
        assunto: row.assunto,
        area: row.area,
        status: row.status,
        polo_ativo: row.polo_ativo,
        polo_passivo: row.polo_passivo,
        tribunal: row.tribunal,
        vara: row.vara,
        comarca: row.comarca,
        valor_causa: row.valor_causa,
        data_distribuicao: row.data_distribuicao,
        coordenacao_id: row.coordenacao_id,
        pasta_id: row.pasta_id,
        pasta: row.pasta_id ? pastasById.get(row.pasta_id) ?? null : null,
        created_at: row.created_at,
        advogado_responsavel: row.advogado_responsavel?.id ? row.advogado_responsavel : null,
        cliente: row.cliente?.id ? row.cliente : null,
        tipo_processo: row.tipo_processo,
      }));

      return {
        processos,
        totalCount,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
        currentPage: page,
        pageSize: PAGE_SIZE,
      };
    },
  });

  const goToPage = (newPage: number) => {
    setPage(newPage);
  };

  const nextPage = () => {
    if (query.data && page < query.data.totalPages) {
      setPage(page + 1);
    }
  };

  const previousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const resetPage = () => {
    setPage(1);
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["processos-paginados"] });
    query.refetch();
  };

  return {
    ...query,
    page,
    goToPage,
    nextPage,
    previousPage,
    resetPage,
    forceRefetch: refetch,
  };
}
