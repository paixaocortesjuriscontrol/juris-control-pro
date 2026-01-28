import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type UsePastasOptions = {
  /**
   * Quando true, calcula _count.processos/_count.documentos por pasta.
   * IMPORTANTE: isso dispara queries adicionais e deve ser usado apenas
   * na tela de Pastas.
   */
  withCounts?: boolean;
  /** Controla execução da query (ex.: dialog aberto). */
  enabled?: boolean;
  /** Limite de concorrência ao calcular contagens para evitar ERR_INSUFFICIENT_RESOURCES. */
  countConcurrency?: number;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }

  const workerCount = Math.min(Math.max(1, limit), items.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export type Pasta = {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_id: string | null;
  coordenacao_id: string | null;
  criado_por: string;
  status: string;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
  } | null;
  coordenacao?: {
    id: string;
    nome: string;
  } | null;
  _count?: {
    processos: number;
    documentos: number;
  };
};

export function usePastas(options: UsePastasOptions = {}) {
  const {
    withCounts = false,
    enabled = true,
    countConcurrency = 4,
  } = options;

  return useQuery({
    queryKey: ["pastas", { withCounts }],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pastas")
        .select(`
          *,
          cliente:clientes(id, nome),
          coordenacao:coordenacoes(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const pastas = (data || []) as Pasta[];
      if (!withCounts || pastas.length === 0) return pastas;

      // Get counts for each pasta
      // NOTE: limitar concorrência evita estourar conexões do browser (ERR_INSUFFICIENT_RESOURCES)
      const concurrency = Math.min(Math.max(1, countConcurrency), 10);
      const pastasWithCounts = await mapWithConcurrency(pastas, concurrency, async (pasta) => {
        const [processosResult, documentosResult] = await Promise.all([
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("pasta_id", pasta.id),
          supabase
            .from("documentos")
            .select("id", { count: "exact", head: true })
            .eq("pasta_id", pasta.id),
        ]);

        if (processosResult.error) throw processosResult.error;
        if (documentosResult.error) throw documentosResult.error;

        return {
          ...pasta,
          _count: {
            processos: processosResult.count ?? 0,
            documentos: documentosResult.count ?? 0,
          },
        } as Pasta;
      });

      return pastasWithCounts as Pasta[];
    },
  });
}

export function usePasta(id: string | undefined) {
  return useQuery({
    queryKey: ["pasta", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("pastas")
        .select(`
          *,
          cliente:clientes(id, nome),
          coordenacao:coordenacoes(id, nome)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Pasta;
    },
    enabled: !!id,
  });
}

export function useCreatePasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pasta: {
      nome: string;
      descricao?: string;
      cliente_id?: string;
      coordenacao_id?: string;
      criado_por: string;
    }) => {
      const { data, error } = await supabase
        .from("pastas")
        .insert(pasta)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      toast.success("Pasta criada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar pasta: " + error.message);
    },
  });
}

export function useUpdatePasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      nome?: string;
      descricao?: string;
      cliente_id?: string | null;
      coordenacao_id?: string | null;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from("pastas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      toast.success("Pasta atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar pasta: " + error.message);
    },
  });
}

export function useDeletePasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pastas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      toast.success("Pasta excluída com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir pasta: " + error.message);
    },
  });
}

export function useVincularProcessoPasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ processoId, pastaId }: { processoId: string; pastaId: string | null }) => {
      const { error } = await supabase
        .from("processos")
        .update({ pasta_id: pastaId })
        .eq("id", processoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success("Processo vinculado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao vincular processo: " + error.message);
    },
  });
}
