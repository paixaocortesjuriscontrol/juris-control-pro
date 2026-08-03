import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditoriaDistTstRow {
  id: string;
  created_at: string;
  dados_benner_id: string | null;
  processo: string | null;
  processo_digits: string | null;
  dossie: string | null;
  equipe: string | null;
  coordenacao_id: string | null;
  usuario_id: string | null;
  acao: string;
  origem: string | null;
  dados_antes: any;
  dados_depois: any;
  campos_alterados: { campo: string; de: any; para: any }[] | null;
}

export interface AuditoriaDistTstFiltros {
  busca?: string;
  usuarioId?: string;
  coordenacaoId?: string;
  acao?: string;
  origem?: string;
  campo?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE = 100;

/** Lista os registros de auditoria da Distribuição TST (somente admin, via RLS). */
export function useAuditoriaDistribuicaoTst(filtros: AuditoriaDistTstFiltros, enabled = true) {
  const pageSize = filtros.pageSize ?? PAGE_SIZE;
  const page = filtros.page ?? 0;

  return useQuery({
    queryKey: ["auditoria-dist-tst", JSON.stringify(filtros)],
    enabled,
    queryFn: async () => {
      let q: any = supabase
        .from("auditoria_distribuicao_tst")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      const busca = (filtros.busca || "").trim();
      if (busca) {
        const digits = busca.replace(/\D/g, "");
        if (digits.length >= 6) {
          q = q.or(`processo_digits.ilike.%${digits}%,dossie.ilike.%${busca}%`);
        } else {
          q = q.or(`processo.ilike.%${busca}%,dossie.ilike.%${busca}%`);
        }
      }
      if (filtros.usuarioId) q = q.eq("usuario_id", filtros.usuarioId);
      if (filtros.coordenacaoId) q = q.eq("coordenacao_id", filtros.coordenacaoId);
      if (filtros.acao) q = q.eq("acao", filtros.acao);
      if (filtros.origem) q = q.ilike("origem", `%${filtros.origem}%`);
      if (filtros.dataInicio) q = q.gte("created_at", `${filtros.dataInicio}T00:00:00`);
      if (filtros.dataFim) q = q.lte("created_at", `${filtros.dataFim}T23:59:59`);

      const { data, error, count } = await q;
      if (error) throw error;

      let rows = (data || []) as AuditoriaDistTstRow[];
      const campo = (filtros.campo || "").trim().toLowerCase();
      if (campo) {
        rows = rows.filter((r) =>
          (r.campos_alterados || []).some((d) => (d.campo || "").toLowerCase().includes(campo))
        );
      }
      return { rows, total: count ?? rows.length, pageSize, page };
    },
  });
}

/** Histórico completo de um registro específico da Distribuição TST. */
export function useHistoricoDistribuicaoTst(dadosBennerId?: string | null) {
  return useQuery({
    queryKey: ["auditoria-dist-tst-registro", dadosBennerId],
    enabled: !!dadosBennerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_distribuicao_tst")
        .select("*")
        .eq("dados_benner_id", dadosBennerId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as AuditoriaDistTstRow[];
    },
  });
}