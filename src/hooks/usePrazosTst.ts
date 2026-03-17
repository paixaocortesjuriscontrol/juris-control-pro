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

export function usePrazosTst(coordenacaoId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["processos-tst", coordenacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(TST_SELECT)
        .eq("coordenacao_id", coordenacaoId!)
        .order("data_fatal_tst", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as ProcessoTst[];
    },
    enabled: !!coordenacaoId,
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
    mutationFn: async (items: ProcessoTstImport[]) => {
      const toUpdate = items.filter((i) => i._existing_id);
      const toInsert = items.filter((i) => !i._existing_id);

      // Update existing processos with TST fields
      for (const item of toUpdate) {
        const { _existing_id, numero, area, status, ...tst } = item;
        const { error } = await supabase
          .from("processos")
          .update(tst as any)
          .eq("id", _existing_id!);
        if (error) throw error;
      }

      // Insert new processos
      if (toInsert.length > 0) {
        const rows = toInsert.map(({ _existing_id, ...rest }) => ({
          ...rest,
          area: rest.area || "trabalhista",
          status: (rest.status || "ativo") as any,
        }));
        const { error } = await supabase.from("processos").insert(rows as any[]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processos-tst"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success("Importação concluída com sucesso");
    },
    onError: (e: any) => toast.error("Erro na importação: " + e.message),
  });

  const clearAndImportMutation = useMutation({
    mutationFn: async ({ coordenacaoId: cid, items }: { coordenacaoId: string; items: ProcessoTstImport[] }) => {
      // Clear TST fields from existing processos in this coordenação
      const { error: clearErr } = await supabase
        .from("processos")
        .update({
          data_fatal_tst: null,
          decisao_tst: null,
          formulario_tst: null,
          providencias_tst: null,
          deposito_judicial_tst: null,
          preparo_tst: null,
          multa_custas_tst: null,
          responsavel_tst: null,
        } as any)
        .eq("coordenacao_id", cid)
        .not("data_fatal_tst", "is", null);
      if (clearErr) throw clearErr;

      // Now import
      if (items.length > 0) {
        const toUpdate = items.filter((i) => i._existing_id);
        const toInsert = items.filter((i) => !i._existing_id);

        for (const item of toUpdate) {
          const { _existing_id, numero, area, status, ...tst } = item;
          const { error } = await supabase
            .from("processos")
            .update(tst as any)
            .eq("id", _existing_id!);
          if (error) throw error;
        }

        if (toInsert.length > 0) {
          const rows = toInsert.map(({ _existing_id, ...rest }) => ({
            ...rest,
            area: rest.area || "trabalhista",
            status: (rest.status || "ativo") as any,
          }));
          const { error } = await supabase.from("processos").insert(rows as any[]);
          if (error) throw error;
        }
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
