import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const PAGE_SIZE = 50;

interface ProcessosPaginadosFilters {
  search?: string;
  area?: string;
  status?: string;
  coordenacao_id?: string;
}

export function useProcessosPaginados(filters: ProcessosPaginadosFilters = {}) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["processos-paginados", page, filters],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("processos")
        .select(`
          id,
          numero,
          assunto,
          area,
          status,
          polo_ativo,
          polo_passivo,
          tribunal,
          vara,
          comarca,
          valor_causa,
          data_distribuicao,
          coordenacao_id,
          pasta_id,
          created_at,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome),
          cliente:clientes!processos_cliente_id_fkey(id, nome, tipo)
        `, { count: 'exact' })
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.area && filters.area !== "all") {
        query = query.eq("area", filters.area);
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.coordenacao_id && filters.coordenacao_id !== "all") {
        query = query.eq("coordenacao_id", filters.coordenacao_id);
      }
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`numero.ilike.${searchTerm},polo_ativo.ilike.${searchTerm},polo_passivo.ilike.${searchTerm}`);
      }

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        processos: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
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
