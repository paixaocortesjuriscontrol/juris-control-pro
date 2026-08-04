import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

export interface AuditoriaLoteRow {
  id: string;
  created_at: string;
  iniciado_em: string;
  finalizado_em: string | null;
  tipo_operacao: string;
  ferramenta: string | null;
  rota: string | null;
  arquivo_nome: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  coordenacao_id: string | null;
  status: string;
  total_linhas: number;
  total_criados: number;
  total_atualizados: number;
  total_ignorados: number;
  total_erros: number;
  itens: ItemAuditoriaLote[] | null;
  detalhes: Record<string, any> | null;
  resumo: string | null;
  erro_mensagem: string | null;
}

export interface AuditoriaLoteFiltros {
  busca?: string;
  tipo?: string;
  usuarioId?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE = 50;

/** Lista as execuções em lote das ferramentas do Admin. TST. */
export function useAuditoriaLotesAdminTst(filtros: AuditoriaLoteFiltros) {
  const pageSize = filtros.pageSize ?? PAGE_SIZE;
  const page = filtros.page ?? 0;

  return useQuery({
    queryKey: ["auditoria-lotes-admin-tst", JSON.stringify(filtros)],
    queryFn: async () => {
      let q: any = supabase
        .from("auditoria_lotes_admin_tst" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (filtros.tipo) q = q.eq("tipo_operacao", filtros.tipo);
      if (filtros.usuarioId) q = q.eq("usuario_id", filtros.usuarioId);
      if (filtros.status) q = q.eq("status", filtros.status);
      if (filtros.dataInicio) q = q.gte("created_at", `${filtros.dataInicio}T00:00:00`);
      if (filtros.dataFim) q = q.lte("created_at", `${filtros.dataFim}T23:59:59`);

      const busca = (filtros.busca || "").trim();
      if (busca) {
        q = q.or(
          `arquivo_nome.ilike.%${busca}%,usuario_nome.ilike.%${busca}%,usuario_email.ilike.%${busca}%,resumo.ilike.%${busca}%`
        );
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data || []) as AuditoriaLoteRow[],
        total: count ?? (data || []).length,
        page,
        pageSize,
      };
    },
  });
}

/** Busca uma execução específica (com todos os itens). */
export function useAuditoriaLoteDetalhe(id?: string | null) {
  return useQuery({
    queryKey: ["auditoria-lote-admin-tst", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_lotes_admin_tst" as any)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AuditoriaLoteRow | null;
    },
  });
}