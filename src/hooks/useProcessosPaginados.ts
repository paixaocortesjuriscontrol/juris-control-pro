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
  periodoInicio?: Date;
  periodoFim?: Date;
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

      // If we need to filter by DJEN publications or movements, we need a different approach
      // First, get the IDs of processes that match the special filters
      let processIdsWithDjen: string[] | null = null;
      let processIdsWithMov: string[] | null = null;

      if (filters.comPublicacaoDjen) {
        const { data: djenData } = await supabase
          .from("publicacoes_djen_processos")
          .select("processo_id")
          .limit(1000);
        processIdsWithDjen = [...new Set(djenData?.map((d) => d.processo_id) || [])];
      }

      if (filters.comMovimento) {
        const { data: movData } = await supabase
          .from("movimentacoes")
          .select("processo_id")
          .limit(5000);
        processIdsWithMov = [...new Set(movData?.map((m) => m.processo_id) || [])];
      }

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
        query = query.eq("area", filters.area as "civil" | "trabalhista" | "empresarial");
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status as "ativo" | "pendente" | "urgente" | "encerrado" | "arquivado");
      }
      if (filters.coordenacao_id && filters.coordenacao_id !== "all") {
        query = query.eq("coordenacao_id", filters.coordenacao_id);
      }
      if (filters.responsavel_id) {
        query = query.eq("advogado_responsavel_id", filters.responsavel_id);
      }
      if (filters.instancia && filters.instancia !== "todos") {
        if (filters.instancia === "1") {
          query = query.eq("instancia", "1º Instância");
        } else if (filters.instancia === "2") {
          query = query.eq("instancia", "2º Instância");
        } else if (filters.instancia === "superior") {
          query = query.eq("instancia", "Tribunais Superiores");
        }
      }
      if (filters.periodoInicio) {
        query = query.gte("created_at", filters.periodoInicio.toISOString());
      }
      if (filters.periodoFim) {
        query = query.lte("created_at", filters.periodoFim.toISOString());
      }
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`numero.ilike.${searchTerm},polo_ativo.ilike.${searchTerm},polo_passivo.ilike.${searchTerm}`);
      }

      // Apply special filters for DJEN and movements
      // When both filters are active, we need to intersect the IDs
      let finalProcessIds: string[] | null = null;
      
      if (processIdsWithDjen !== null && processIdsWithMov !== null) {
        // Intersection of both sets
        const djenSet = new Set(processIdsWithDjen);
        finalProcessIds = processIdsWithMov.filter(id => djenSet.has(id));
      } else if (processIdsWithDjen !== null) {
        finalProcessIds = processIdsWithDjen;
      } else if (processIdsWithMov !== null) {
        finalProcessIds = processIdsWithMov;
      }

      if (finalProcessIds !== null) {
        if (finalProcessIds.length === 0) {
          return {
            processos: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            pageSize: PAGE_SIZE,
          };
        }
        query = query.in("id", finalProcessIds);
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
