import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

/** Módulos onde uma etiqueta pode aparecer (modelo Astrea). */
export const ETIQUETA_MODULOS = [
  { value: "processos", label: "Processos e Casos" },
  { value: "itens", label: "Tarefas, Prazos, Eventos, Audiências e Parcelamentos" },
  { value: "clientes", label: "Clientes" },
  { value: "publicacoes", label: "Publicações / Análise DJEN" },
] as const;

export type EtiquetaModulo = (typeof ETIQUETA_MODULOS)[number]["value"];

/** Entidades que podem receber etiquetas. */
export type EtiquetaEntidade =
  | "processo"
  | "tarefa"
  | "prazo"
  | "evento"
  | "audiencia"
  | "parcelamento"
  | "cliente"
  | "publicacao";

/** Mapeia a entidade para o módulo correspondente da etiqueta. */
export function moduloDaEntidade(entidade: EtiquetaEntidade): EtiquetaModulo {
  switch (entidade) {
    case "processo":
      return "processos";
    case "cliente":
      return "clientes";
    case "publicacao":
      return "publicacoes";
    default:
      return "itens";
  }
}

export interface Etiqueta {
  id: string;
  coordenacao_id: string;
  nome: string;
  cor: string;
  modulos: EtiquetaModulo[];
  ativo: boolean;
  ordem: number;
  /** Cliente vinculado — habilita a aplicação automática/retroativa por cliente. */
  cliente_id?: string | null;
}

export const ETIQUETA_COLOR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#6b7280",
];

/**
 * Catálogo de etiquetas. Sem coordenacaoId retorna todas as etiquetas visíveis
 * ao usuário (a RLS já limita às coordenações das quais ele é membro).
 */
export function useEtiquetas(coordenacaoId?: string | null, modulo?: EtiquetaModulo) {
  // Administrador pode usar qualquer etiqueta, de qualquer coordenação.
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const filtroCoordenacao = isAdmin ? null : coordenacaoId;
  return useQuery({
    queryKey: ["etiquetas", filtroCoordenacao ?? "todas"],
    queryFn: async () => {
      let q = supabase
        .from("etiquetas")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (filtroCoordenacao) q = q.eq("coordenacao_id", filtroCoordenacao);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as any[]) || []) as Etiqueta[];
    },
    staleTime: 60_000,
    select: (rows) =>
      modulo ? rows.filter((e) => (e.modulos || []).includes(modulo)) : rows,
  });
}

/** Carrega o mapa { entidade_id => etiquetaIds[] } para uma lista de ids. */
export function useEtiquetasDeItens(entidade: EtiquetaEntidade, ids: string[]) {
  const key = JSON.stringify([...ids].sort());
  return useQuery({
    queryKey: ["etiquetas-itens", entidade, key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const map = new Map<string, string[]>();
      const CHUNK = 500;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("etiquetas_itens")
          .select("entidade_id, etiqueta_id")
          .eq("entidade", entidade)
          .in("entidade_id", slice);
        if (error) throw error;
        for (const r of (data as any[]) || []) {
          const arr = map.get(r.entidade_id) || [];
          arr.push(r.etiqueta_id);
          map.set(r.entidade_id, arr);
        }
      }
      return map;
    },
  });
}

/** Ids das entidades marcadas com qualquer uma das etiquetas informadas. */
export async function fetchIdsPorEtiquetas(
  entidade: EtiquetaEntidade,
  etiquetaIds: string[],
): Promise<string[]> {
  if (etiquetaIds.length === 0) return [];
  const all: string[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("etiquetas_itens")
      .select("entidade_id")
      .eq("entidade", entidade)
      .in("etiqueta_id", etiquetaIds)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as any[]) || [];
    for (const r of rows) all.push(r.entidade_id);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return Array.from(new Set(all));
}

export interface EtiquetaInput {
  coordenacao_id: string;
  nome: string;
  cor: string;
  modulos: EtiquetaModulo[];
  cliente_id?: string | null;
}

export function useCriarEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EtiquetaInput) => {
      const nome = input.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      if (!input.coordenacao_id) throw new Error("Coordenação obrigatória");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("etiquetas")
        .insert({
          coordenacao_id: input.coordenacao_id,
          nome,
          cor: input.cor,
          modulos: input.modulos.length ? input.modulos : ETIQUETA_MODULOS.map((m) => m.value),
          cliente_id: input.cliente_id ?? null,
          created_by: userData.user?.id,
        } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as any as Etiqueta;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["etiquetas"] });
      toast.success("Etiqueta criada");
    },
    onError: (err: any) =>
      toast.error("Erro ao criar etiqueta: " + (err?.message || "")),
  });
}

export function useAtualizarEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      nome?: string;
      cor?: string;
      modulos?: EtiquetaModulo[];
      ativo?: boolean;
      cliente_id?: string | null;
    }) => {
      const payload: any = { ...patch };
      if (payload.nome !== undefined) {
        payload.nome = String(payload.nome).trim();
        if (!payload.nome) throw new Error("Nome obrigatório");
      }
      const { data, error } = await supabase
        .from("etiquetas")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as any as Etiqueta;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["etiquetas"] });
      toast.success("Etiqueta atualizada");
    },
    onError: (err: any) =>
      toast.error("Erro ao atualizar etiqueta: " + (err?.message || "")),
  });
}

export function useExcluirEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("etiquetas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["etiquetas"] });
      await qc.invalidateQueries({ queryKey: ["etiquetas-itens"] });
      toast.success("Etiqueta excluída");
    },
    onError: (err: any) =>
      toast.error("Erro ao excluir etiqueta: " + (err?.message || "")),
  });
}

/** Aplica/remove uma etiqueta de um item. */
export function useToggleEtiquetaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      etiquetaId,
      entidade,
      entidadeId,
      checked,
    }: {
      etiquetaId: string;
      entidade: EtiquetaEntidade;
      entidadeId: string;
      checked: boolean;
    }) => {
      if (checked) {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("etiquetas_itens").insert({
          etiqueta_id: etiquetaId,
          entidade,
          entidade_id: entidadeId,
          created_by: userData.user?.id,
        } as any);
        if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("etiquetas_itens")
          .delete()
          .eq("etiqueta_id", etiquetaId)
          .eq("entidade", entidade)
          .eq("entidade_id", entidadeId);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["etiquetas-itens"] });
    },
    onError: (err: any) =>
      toast.error("Erro ao atualizar etiqueta: " + (err?.message || "")),
  });
}

export function useRemoverTodasEtiquetasDoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entidade,
      entidadeId,
    }: { entidade: EtiquetaEntidade; entidadeId: string }) => {
      const { error } = await supabase
        .from("etiquetas_itens")
        .delete()
        .eq("entidade", entidade)
        .eq("entidade_id", entidadeId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["etiquetas-itens"] });
      toast.success("Etiquetas removidas");
    },
    onError: (err: any) =>
      toast.error("Erro ao remover etiquetas: " + (err?.message || "")),
  });
}

/** Etiquetas de um único item (usado nos formulários). */
export function useEtiquetasDoItem(entidade: EtiquetaEntidade, entidadeId?: string | null) {
  return useQueryEtiquetasDoItem(entidade, entidadeId);
}

/**
 * Aplica retroativamente uma etiqueta de cliente a todos os processos da
 * coordenação cujo cliente corresponde. `dryRun` apenas conta.
 */
export function useAplicarEtiquetaClienteBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etiquetaId, dryRun }: { etiquetaId: string; dryRun: boolean }) => {
      const { data, error } = await supabase.rpc("aplicar_etiqueta_cliente_base" as any, {
        _etiqueta_id: etiquetaId,
        _dry_run: dryRun,
      } as any);
      if (error) throw error;
      return (data as any) as { total: number; aplicados: number; dry_run: boolean };
    },
    onSuccess: async (res) => {
      if (!res?.dry_run) {
        await qc.invalidateQueries({ queryKey: ["etiquetas-itens"] });
        toast.success(`${res?.aplicados ?? 0} processo(s) etiquetado(s)`);
      }
    },
    onError: (err: any) =>
      toast.error("Erro ao aplicar etiqueta na base: " + (err?.message || "")),
  });
}

function useQueryEtiquetasDoItem(entidade: EtiquetaEntidade, entidadeId?: string | null) {
  return useQuery({
    queryKey: ["etiquetas-itens", entidade, entidadeId ?? ""],
    enabled: !!entidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etiquetas_itens")
        .select("etiqueta_id")
        .eq("entidade", entidade)
        .eq("entidade_id", entidadeId!);
      if (error) throw error;
      return ((data as any[]) || []).map((r) => r.etiqueta_id as string);
    },
  });
}