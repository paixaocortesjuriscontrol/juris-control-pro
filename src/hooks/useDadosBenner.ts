import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DadoBenner {
  id: string;
  user_id: string | null;
  coordenacao_id: string | null;
  status: string;
  dossie: string | null;
  processo: string | null;
  tribunal: string | null;
  tipo_recurso: string | null;
  data_distribuicao: string | null;
  turma: string | null;
  relator: string | null;
  analise_quarteirizado: string | null;
  risco_midia: string | null;
  risco_descricao: string | null;
  provas_digitais: string | null;
  tem_data_julgamento: string | null;
  data_julgamento: string | null;
  horario_julgamento: string | null;
  tipo_julgamento: string | null;
  materia_honra: string | null;
  entrega_memoriais: string | null;
  sustentacao_oral: string | null;
  resultado_sem_transcendencia: boolean;
  resultado_nao_conhecido: boolean;
  resultado_conhecido_provido: boolean;
  resultado_conhecido_nao_provido: boolean;
  resultado_outra: string | null;
  observacoes: string | null;
  ganhamos: boolean;
  perdemos: boolean;
  processo_baixado: string | null;
  recorrente: string | null;
  posicao_turma_favoravel: boolean;
  posicao_turma_desfavoravel: boolean;
  posicao_relator_favoravel: boolean;
  posicao_relator_desfavoravel: boolean;
  recurso_bem_aparelhado: boolean;
  recurso_mal_aparelhado: boolean;
  chance_exito: string | null;
  tipo_recurso_auto: boolean;
  situacao_processo: string | null;
  confianca_transito: number | null;
  data_transito_julgado: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type DadoBennerInsert = Omit<DadoBenner, "id" | "created_at" | "updated_at">;

export interface DadosBennerFilters {
  status?: string;
  relator?: string;
  dossie?: string;
  processo?: string;
  turma?: string;
  tipo_recurso?: string;
  tem_pauta?: boolean;
  tem_distribuicao?: boolean;
  situacao_processo?: string;
}

const PAGE_SIZE = 50;

export function useDadosBenner(filters?: DadosBennerFilters) {
  const [dados, setDados] = useState<DadoBenner[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const buildQuery = useCallback(() => {
    let query = supabase.from("dados_benner" as any).select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (filters?.status && filters.status !== "todos") {
      query = query.eq("status", filters.status);
    }
    if (filters?.relator) {
      query = query.ilike("relator", `%${filters.relator}%`);
    }
    if (filters?.dossie) {
      query = query.ilike("dossie", `%${filters.dossie}%`);
    }
    if (filters?.processo) {
      query = query.ilike("processo", `%${filters.processo}%`);
    }
    if (filters?.turma) {
      query = query.ilike("turma", `%${filters.turma}%`);
    }
    if (filters?.tipo_recurso) {
      query = query.ilike("tipo_recurso", `%${filters.tipo_recurso}%`);
    }
    if (filters?.situacao_processo && filters.situacao_processo !== "todos") {
      query = query.ilike("situacao_processo", `${filters.situacao_processo}%`);
    }
    return query;
  }, [filters?.status, filters?.relator, filters?.dossie, filters?.processo, filters?.turma, filters?.tipo_recurso, filters?.situacao_processo]);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    try {
      // If tem_pauta or tem_distribuicao filters are active, first get matching process numbers
      let pautaContratos: string[] | null = null;
      let distContratos: string[] | null = null;

      if (filters?.tem_pauta) {
        const { data } = await supabase.from("pautas_tst").select("processo_numero");
        pautaContratos = [...new Set((data || []).map((d: any) => d.processo_numero).filter(Boolean))];
        if (pautaContratos.length === 0) {
          setDados([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      if (filters?.tem_distribuicao) {
        const { data } = await supabase.from("dados_benner" as any).select("processo").not("aba_origem", "is", null);
        distContratos = [...new Set(((data as any[]) || []).map((d: any) => d.processo).filter(Boolean))];
        if (distContratos.length === 0) {
          setDados([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      // Combine: if both filters active, intersect
      let allowedContratos: string[] | null = null;
      if (pautaContratos && distContratos) {
        const distSet = new Set(distContratos);
        allowedContratos = pautaContratos.filter(c => distSet.has(c));
        if (allowedContratos.length === 0) {
          setDados([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      } else if (pautaContratos) {
        allowedContratos = pautaContratos;
      } else if (distContratos) {
        allowedContratos = distContratos;
      }

      let query = buildQuery();
      if (allowedContratos) {
        query = query.in("processo", allowedContratos);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) {
        toast.error("Erro ao carregar dados: " + error.message);
      } else {
        setDados((data as any[]) || []);
        setTotalCount(count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [buildQuery, page, filters?.tem_pauta, filters?.tem_distribuicao]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filters?.status, filters?.relator, filters?.dossie, filters?.processo, filters?.turma, filters?.tipo_recurso, filters?.tem_pauta, filters?.tem_distribuicao]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const saveDado = async (dado: DadoBennerInsert, id?: string): Promise<boolean | string> => {
    let rowId = id;
    if (!rowId) {
      const processo = String((dado as any).processo || "").trim();
      const dossie = String((dado as any).dossie || "").trim();
      if (processo) {
        let query: any = supabase.from("dados_benner" as any).select("id").eq("processo", processo);
        query = dossie ? query.eq("dossie", dossie) : query.or("dossie.is.null,dossie.eq.");
        const { data: existing } = await query
          .order("benner_atualizado", { ascending: false, nullsFirst: false })
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1);
        rowId = (existing as any[])?.[0]?.id;
      }
    }

    if (rowId) {
      const { data: updated, error } = await supabase
        .from("dados_benner" as any)
        .update(dado as any)
        .eq("id", rowId)
        .select("id");
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
      if (!updated || (updated as any[]).length === 0) {
        toast.error(
          "Não foi possível salvar: este registro foi arquivado ou removido. Recarregue a tela e abra a versão ativa do processo.",
        );
        return false;
      }
      toast.success("Registro atualizado!");
      fetchDados();
      return rowId;
    } else {
      const { data: inserted, error } = await supabase.from("dados_benner" as any).insert(dado as any).select("id").single();
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
      toast.success("Registro salvo!");
      fetchDados();
      return (inserted as any)?.id || true;
    }
  };

  const deleteDado = async (id: string) => {
    const { error } = await supabase.from("dados_benner" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return false; }
    toast.success("Registro excluído!");
    fetchDados();
    return true;
  };

  const updateStatus = async (ids: string[], newStatus: string) => {
    const BATCH_SIZE = 200;
    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("dados_benner" as any).update({ status: newStatus } as any).in("id", batch);
        if (error) { toast.error("Erro ao atualizar status: " + error.message); return false; }
      }
      toast.success(`${ids.length} registro(s) atualizado(s) para "${newStatus}"!`);
      fetchDados();
      return true;
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + (err?.message || "Erro desconhecido"));
      return false;
    }
  };

  const buscarDossie = async (termo: string) => {
    const { data, error } = await supabase
      .from("processos")
      .select("id, numero, dossie_tst, turma_tst, relator_tst, coordenacao_id")
      .or(`dossie_tst.ilike.%${termo}%,numero.ilike.%${termo}%`)
      .limit(5);
    if (error) { toast.error("Erro na busca: " + error.message); return []; }
    return data || [];
  };

  const fetchAllIds = useCallback(async (): Promise<string[]> => {
    try {
      let pautaContratos: string[] | null = null;
      let distContratos: string[] | null = null;

      if (filters?.tem_pauta) {
        const { data } = await supabase.from("pautas_tst").select("processo_numero");
        pautaContratos = [...new Set((data || []).map((d: any) => d.processo_numero).filter(Boolean))];
        if (pautaContratos.length === 0) return [];
      }

      if (filters?.tem_distribuicao) {
        const { data } = await supabase.from("dados_benner" as any).select("processo").not("aba_origem", "is", null);
        distContratos = [...new Set(((data as any[]) || []).map((d: any) => d.processo).filter(Boolean))];
        if (distContratos.length === 0) return [];
      }

      let allowedContratos: string[] | null = null;
      if (pautaContratos && distContratos) {
        const distSet = new Set(distContratos);
        allowedContratos = pautaContratos.filter(c => distSet.has(c));
        if (allowedContratos.length === 0) return [];
      } else if (pautaContratos) {
        allowedContratos = pautaContratos;
      } else if (distContratos) {
        allowedContratos = distContratos;
      }

      let query = supabase.from("dados_benner" as any).select("id").order("created_at", { ascending: false });
      if (filters?.status && filters.status !== "todos") query = query.eq("status", filters.status);
      if (filters?.relator) query = query.ilike("relator", `%${filters.relator}%`);
      if (filters?.dossie) query = query.ilike("dossie", `%${filters.dossie}%`);
      if (filters?.processo) query = query.ilike("processo", `%${filters.processo}%`);
      if (filters?.turma) query = query.ilike("turma", `%${filters.turma}%`);
      if (filters?.tipo_recurso) query = query.ilike("tipo_recurso", `%${filters.tipo_recurso}%`);
      if (allowedContratos) query = query.in("processo", allowedContratos);

      // Paginate to get all IDs (Supabase limits to 1000 per query)
      let allIds: string[] = [];
      let offset = 0;
      const FETCH_SIZE = 1000;
      while (true) {
        const { data, error } = await query.range(offset, offset + FETCH_SIZE - 1);
        if (error) { toast.error("Erro ao buscar IDs: " + error.message); return []; }
        const ids = (data as any[] || []).map((d: any) => d.id);
        allIds = allIds.concat(ids);
        if (ids.length < FETCH_SIZE) break;
        offset += FETCH_SIZE;
      }
      return allIds;
    } catch {
      return [];
    }
  }, [filters?.status, filters?.relator, filters?.dossie, filters?.processo, filters?.turma, filters?.tipo_recurso, filters?.tem_pauta, filters?.tem_distribuicao, filters?.situacao_processo]);

  const fetchAllData = useCallback(async (): Promise<DadoBenner[]> => {
    try {
      let pautaContratos: string[] | null = null;
      let distContratos: string[] | null = null;

      if (filters?.tem_pauta) {
        const { data } = await supabase.from("pautas_tst").select("processo_numero");
        pautaContratos = [...new Set((data || []).map((d: any) => d.processo_numero).filter(Boolean))];
        if (pautaContratos.length === 0) return [];
      }

      if (filters?.tem_distribuicao) {
        const { data } = await supabase.from("dados_benner" as any).select("processo").not("aba_origem", "is", null);
        distContratos = [...new Set(((data as any[]) || []).map((d: any) => d.processo).filter(Boolean))];
        if (distContratos.length === 0) return [];
      }

      let allowedContratos: string[] | null = null;
      if (pautaContratos && distContratos) {
        const distSet = new Set(distContratos);
        allowedContratos = pautaContratos.filter(c => distSet.has(c));
        if (allowedContratos.length === 0) return [];
      } else if (pautaContratos) {
        allowedContratos = pautaContratos;
      } else if (distContratos) {
        allowedContratos = distContratos;
      }

      let allData: DadoBenner[] = [];
      let offset = 0;
      const FETCH_SIZE = 1000;
      while (true) {
        let query = buildQuery().range(offset, offset + FETCH_SIZE - 1);
        if (allowedContratos) query = query.in("processo", allowedContratos);
        const { data, error } = await query;
        if (error) { toast.error("Erro ao buscar dados: " + error.message); return []; }
        allData = allData.concat((data as any[]) || []);
        if (!data || data.length < FETCH_SIZE) break;
        offset += FETCH_SIZE;
      }
      return allData;
    } catch {
      return [];
    }
  }, [buildQuery, filters?.tem_pauta, filters?.tem_distribuicao]);

  return { dados, loading, fetchDados, saveDado, deleteDado, updateStatus, buscarDossie, page, setPage, totalPages, totalCount, fetchAllIds, fetchAllData };
}
