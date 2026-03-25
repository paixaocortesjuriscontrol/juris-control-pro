import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProcessoTst {
  id: string;
  numero: string;
  coordenacao_id: string | null;
  polo_ativo: string | null;
  polo_passivo: string | null;
  dossie_tst: string | null;
  equipe_tst: string | null;
  decisao_tst: string | null;
  formulario_tst: string | null;
  providencias_tst: string | null;
  deposito_judicial_tst: string | null;
  preparo_tst: string | null;
  multa_custas_tst: string | null;
  responsavel_tst: string | null;
  data_fatal: string | null;
  status_tst: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessoTstImport {
  numero: string;
  coordenacao_id: string | null;
  polo_ativo: string | null;
  polo_passivo: string | null;
  dossie_tst: string | null;
  equipe_tst: string | null;
  decisao_tst: string | null;
  formulario_tst: string | null;
  providencias_tst: string | null;
  deposito_judicial_tst: string | null;
  preparo_tst: string | null;
  multa_custas_tst: string | null;
  responsavel_tst: string | null;
  data_fatal: string | null;
  area?: string;
  status?: string;
  criado_por_tst?: string | null;
  responsavel_tst_id?: string | null;
  /** If matched to existing processo, store the id here for upsert */
  _existing_id?: string | null;
}

const TST_SELECT = `
  id, numero, coordenacao_id, polo_ativo, polo_passivo,
  dossie_tst, equipe_tst, decisao_tst, formulario_tst,
  providencias_tst, deposito_judicial_tst, preparo_tst,
  multa_custas_tst, responsavel_tst, data_fatal,
  status_tst, status, created_at, updated_at
`;

/** Extract TST-only fields for update (exclude numero, area, status, _existing_id) */
function extractTstFields(item: ProcessoTstImport) {
  const { _existing_id, numero, area, status, ...tst } = item;
  return tst;
}

/** Perform the actual import (update existing + insert new) */
async function performImport(items: ProcessoTstImport[], onProgress?: (done: number, total: number) => void) {
  const toUpdate = items.filter((i) => i._existing_id);
  const toInsert = items.filter((i) => !i._existing_id);
  const total = items.length;
  let done = 0;

  // Update existing processos with TST fields
  for (const item of toUpdate) {
    const tst = extractTstFields(item);
    const { error } = await supabase
      .from("processos")
      .update(tst as any)
      .eq("id", item._existing_id!);
    if (error) throw error;
    done++;
    onProgress?.(done, total);
  }

  // Insert new processos one-by-one to handle duplicates gracefully
  if (toInsert.length > 0) {
    for (const item of toInsert) {
      const { _existing_id, ...rest } = item;
      const row = {
        ...rest,
        area: rest.area || "trabalhista",
        status: (rest.status || "ativo") as any,
      };

      // Try insert; if duplicate key on numero, update instead
      const { error } = await supabase.from("processos").insert(row as any);
      if (error) {
        if (error.code === "23505" && error.message?.includes("numero")) {
          const tst = extractTstFields(item);
          const { error: updateErr } = await supabase
            .from("processos")
            .update(tst as any)
            .eq("numero", item.numero);
          if (updateErr) throw updateErr;
        } else {
          throw error;
        }
      }
      done++;
      onProgress?.(done, total);
    }
  }
}

export function usePrazosTst(coordenacaoId: string | null, allCoordIds?: string[]) {
  const queryClient = useQueryClient();
  const isAll = coordenacaoId === "todas";

  const query = useQuery({
    queryKey: ["processos-tst", coordenacaoId, allCoordIds],
    queryFn: async () => {
      let q = supabase
        .from("processos")
        .select(TST_SELECT)
        .order("data_fatal", { ascending: true, nullsFirst: false });

      if (isAll && allCoordIds && allCoordIds.length > 0) {
        q = q.in("coordenacao_id", allCoordIds);
      } else if (!isAll) {
        q = q.eq("coordenacao_id", coordenacaoId!);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProcessoTst[];
    },
    enabled: isAll ? (!!allCoordIds && allCoordIds.length > 0) : !!coordenacaoId,
  });

  const createMutation = useMutation({
    mutationFn: async (processo: ProcessoTstImport) => {
      const { _existing_id, ...rest } = processo;
      const { data, error } = await supabase
        .from("processos")
        .insert({ ...rest, area: rest.area || "trabalhista", status: (rest.status || "ativo") as any } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processos-tst"] });
      toast.success("Processo cadastrado com sucesso");
    },
    onError: (e: any) => toast.error("Erro ao cadastrar: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("processos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processos-tst"] });
      toast.success("Processo removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async ({ items, onProgress }: { items: ProcessoTstImport[]; onProgress?: (done: number, total: number) => void }) => {
      await performImport(items, onProgress);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processos-tst"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success("Importação concluída com sucesso");
    },
    onError: (e: any) => toast.error("Erro na importação: " + e.message),
  });

  const clearAndImportMutation = useMutation({
    mutationFn: async ({ coordenacaoId: cid, items, onProgress }: { coordenacaoId: string; items: ProcessoTstImport[]; onProgress?: (done: number, total: number) => void }) => {
      // Clear TST fields from existing processos in this coordenação
      const { error: clearErr } = await supabase
        .from("processos")
        .update({
          data_fatal: null,
          decisao_tst: null,
          formulario_tst: null,
          providencias_tst: null,
          deposito_judicial_tst: null,
          preparo_tst: null,
          multa_custas_tst: null,
          responsavel_tst: null,
          responsavel_tst_id: null,
          criado_por_tst: null,
        } as any)
        .eq("coordenacao_id", cid)
        .not("data_fatal", "is", null);
      if (clearErr) throw clearErr;

      if (items.length > 0) {
        await performImport(items, onProgress);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processos-tst"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success("Dados substituídos com sucesso");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    prazos: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    bulkImport: bulkImportMutation.mutateAsync,
    clearAndImport: clearAndImportMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isImporting: bulkImportMutation.isPending || clearAndImportMutation.isPending,
  };
}
