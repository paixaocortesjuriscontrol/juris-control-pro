import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Workflow,
  WorkflowEtapa,
  WorkflowExecucao,
  WorkflowExecucaoEtapa,
  WorkflowItemType,
  IniciarWorkflowInput,
  criarItemWorkflow,
  calcularDataOffset,
  resolverResponsavelEtapa,
  avancarExecucaoWorkflow,
  sincronizarWorkflowsPorItens,
} from "@/lib/workflowExecutor";
import { format } from "date-fns";

export type WorkflowWithCoordenacao = Workflow & {
  coordenacao?: { id: string; nome: string } | null;
};

export function useWorkflows(filters?: { coordenacaoId?: string; ativo?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workflows", filters, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from("workflows")
        .select("*, coordenacao:coordenacoes(id, nome)")
        .order("nome", { ascending: true });
      if (filters?.coordenacaoId) {
        query = query.eq("coordenacao_id", filters.coordenacaoId);
      }
      if (filters?.ativo !== undefined) {
        query = query.eq("ativo", filters.ativo);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as WorkflowWithCoordenacao[]) || [];
    },
    enabled: !!user?.id,
  });
}

export function useWorkflow(workflowId?: string) {
  return useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      if (!workflowId) return null;
      const { data, error } = await supabase
        .from("workflows")
        .select("*, coordenacao:coordenacoes(id, nome)")
        .eq("id", workflowId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as WorkflowWithCoordenacao) || null;
    },
    enabled: !!workflowId,
  });
}

export function useWorkflowEtapas(workflowId?: string) {
  return useQuery({
    queryKey: ["workflow-etapas", workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      const { data, error } = await supabase
        .from("workflow_etapas")
        .select("*")
        .eq("workflow_id", workflowId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return ((data as unknown as WorkflowEtapa[]) || []);
    },
    enabled: !!workflowId,
  });
}

export interface WorkflowExecucaoFiltros {
  workflowId?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function useWorkflowExecucoes(
  workflowIdOrFiltros?: string | WorkflowExecucaoFiltros
) {
  const filtros: WorkflowExecucaoFiltros =
    typeof workflowIdOrFiltros === "string"
      ? { workflowId: workflowIdOrFiltros }
      : workflowIdOrFiltros || {};
  return useQuery({
    queryKey: ["workflow-execucoes", JSON.stringify(filtros)],
    queryFn: async () => {
      let query = supabase
        .from("workflow_execucoes")
        .select("*, workflow:workflows(id, nome, coordenacao:coordenacoes(id, nome))")
        .order("created_at", { ascending: false });
      if (filtros.workflowId) {
        query = query.eq("workflow_id", filtros.workflowId);
      }
      if (filtros.status) query = query.eq("status", filtros.status);
      if (filtros.dataInicio) query = query.gte("data_inicio", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data_inicio", filtros.dataFim);
      const { data, error } = await query;
      if (error) throw error;
      return ((data as unknown as WorkflowExecucao[]) || []);
    },
  });
}

export function useWorkflowExecucao(execucaoId?: string) {
  return useQuery({
    queryKey: ["workflow-execucao", execucaoId],
    queryFn: async () => {
      if (!execucaoId) return null;
      const { data, error } = await supabase
        .from("workflow_execucoes")
        .select("*, workflow:workflows(id, nome, coordenacao:coordenacoes(id, nome))")
        .eq("id", execucaoId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as WorkflowExecucao) || null;
    },
    enabled: !!execucaoId,
  });
}

export function useWorkflowExecucaoEtapas(execucaoId?: string) {
  return useQuery({
    queryKey: ["workflow-execucao-etapas", execucaoId],
    queryFn: async () => {
      if (!execucaoId) return [];
      const { data, error } = await supabase
        .from("workflow_execucao_etapas")
        .select("*, etapa:workflow_etapas(*)")
        .eq("execucao_id", execucaoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return ((data as unknown as WorkflowExecucaoEtapa[]) || []);
    },
    enabled: !!execucaoId,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Workflow, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("workflows")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow criado com sucesso!");
    },
    onError: (err: Error) => toast.error("Erro ao criar workflow: " + err.message),
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Workflow> & { id: string }) => {
      const { data, error } = await supabase
        .from("workflows")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Workflow;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", variables.id] });
      toast.success("Workflow atualizado!");
    },
    onError: (err: Error) => toast.error("Erro ao atualizar workflow: " + err.message),
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow excluído!");
    },
    onError: (err: Error) => toast.error("Erro ao excluir workflow: " + err.message),
  });
}

function sanitizeEtapaPayload(input: Record<string, any>) {
  const {
    responsaveis,
    created_at,
    updated_at,
    ...rest
  } = input as any;
  // remove relações/objetos que não são colunas da tabela
  for (const k of Object.keys(rest)) {
    const v = rest[k];
    if (v !== null && typeof v === "object") delete rest[k];
  }
  const uuidFields = ["responsavel_id", "etapa_anterior_id"];
  for (const f of uuidFields) {
    if (f in rest && (rest[f] === "" || rest[f] === undefined)) rest[f] = null;
  }
  // números: string vazia -> null, string numérica -> int
  for (const f of ["dias_previsto", "dias_fatal", "ordem"]) {
    if (!(f in rest)) continue;
    const v = rest[f];
    if (v === "" || v === undefined || v === null) {
      rest[f] = f === "dias_fatal" ? null : f === "dias_previsto" ? 0 : rest[f] ?? null;
    } else {
      const n = parseInt(String(v), 10);
      rest[f] = Number.isNaN(n) ? null : n;
    }
  }
  // normaliza vocabulários validados pelo banco
  if (rest.tipo_item) rest.tipo_item = String(rest.tipo_item).toUpperCase();
  if (rest.tipo_prazo) {
    const tp = String(rest.tipo_prazo).toLowerCase().replace("dias_", "");
    rest.tipo_prazo = tp === "uteis" ? "dias_uteis" : "dias_corridos";
  }
  if (!rest.condicao) delete rest.condicao;
  if (!rest.regra_responsavel) delete rest.regra_responsavel;
  return rest;
}

async function salvarResponsaveisEtapa(etapaId: string, responsaveis?: string[]) {
  if (!responsaveis) return;
  await supabase.from("workflow_etapa_responsaveis").delete().eq("etapa_id", etapaId);
  const rows = Array.from(new Set(responsaveis.filter(Boolean))).map((usuario_id) => ({
    etapa_id: etapaId,
    usuario_id,
  }));
  if (rows.length) {
    const { error } = await supabase.from("workflow_etapa_responsaveis").insert(rows);
    if (error) throw error;
  }
}

export function useWorkflowEtapasResponsaveis(workflowId?: string) {
  return useQuery({
    queryKey: ["workflow-etapas-responsaveis", workflowId],
    queryFn: async () => {
      if (!workflowId) return {} as Record<string, string[]>;
      const { data: etapas } = await supabase
        .from("workflow_etapas")
        .select("id")
        .eq("workflow_id", workflowId);
      const ids = ((etapas as any[]) || []).map((e) => e.id);
      if (!ids.length) return {} as Record<string, string[]>;
      const { data, error } = await supabase
        .from("workflow_etapa_responsaveis")
        .select("etapa_id, usuario_id")
        .in("etapa_id", ids);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const r of (data as any[]) || []) {
        map[r.etapa_id] = [...(map[r.etapa_id] || []), r.usuario_id];
      }
      return map;
    },
    enabled: !!workflowId,
  });
}

/**
 * Responsáveis REAIS dos itens (tarefas) já materializados por etapas de execução.
 * Retorna { [tarefaId]: string[] } combinando responsavel_id + tarefa_responsaveis.
 */
export function useWorkflowItensResponsaveis(itemIds: string[]) {
  const ids = Array.from(new Set((itemIds || []).filter(Boolean))).sort();
  return useQuery({
    queryKey: ["workflow-itens-responsaveis", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const map: Record<string, string[]> = {};
      const [{ data: tarefas }, { data: vinculos }] = await Promise.all([
        supabase.from("tarefas").select("id, responsavel_id").in("id", ids),
        supabase.from("tarefa_responsaveis").select("tarefa_id, usuario_id").in("tarefa_id", ids),
      ]);
      for (const t of ((tarefas as any[]) || [])) {
        if (t?.responsavel_id) map[t.id] = [t.responsavel_id];
      }
      for (const v of ((vinculos as any[]) || [])) {
        if (!v?.tarefa_id || !v?.usuario_id) continue;
        const atual = map[v.tarefa_id] || [];
        if (!atual.includes(v.usuario_id)) map[v.tarefa_id] = [...atual, v.usuario_id];
      }
      return map;
    },
  });
}

export function useCreateWorkflowEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<WorkflowEtapa, "id" | "created_at" | "updated_at"> & { responsaveis?: string[] }
    ) => {
      const { data, error } = await supabase
        .from("workflow_etapas")
        .insert(sanitizeEtapaPayload(input) as any)
        .select()
        .single();
      if (error) throw error;
      await salvarResponsaveisEtapa((data as any).id, (input as any).responsaveis);
      return data as unknown as WorkflowEtapa;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-etapas", variables.workflow_id] });
      queryClient.invalidateQueries({ queryKey: ["workflow-etapas-responsaveis"] });
      toast.success("Etapa adicionada!");
    },
    onError: (err: Error) => toast.error("Erro ao adicionar etapa: " + err.message),
  });
}

export function useUpdateWorkflowEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<WorkflowEtapa> & { id: string; responsaveis?: string[] }) => {
      const { data, error } = await supabase
        .from("workflow_etapas")
        .update(sanitizeEtapaPayload(updates) as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await salvarResponsaveisEtapa(id, (updates as any).responsaveis);
      return data as unknown as WorkflowEtapa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-etapas"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-etapas-responsaveis"] });
      toast.success("Etapa atualizada!");
    },
    onError: (err: Error) => toast.error("Erro ao atualizar etapa: " + err.message),
  });
}

export function useDeleteWorkflowEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, workflowId }: { id: string; workflowId: string }) => {
      const { error } = await supabase.from("workflow_etapas").delete().eq("id", id);
      if (error) throw error;
      return { id, workflowId };
    },
    onSuccess: ({ workflowId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-etapas", workflowId] });
      toast.success("Etapa removida!");
    },
    onError: (err: Error) => toast.error("Erro ao remover etapa: " + err.message),
  });
}

export function useIniciarWorkflow() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: IniciarWorkflowInput) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { workflow_id, processo_id, processo_numero, coordenacao_id, responsavel_inicial } = input;
      const workflowId = workflow_id;

      const { data: workflow, error: wfError } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", workflowId)
        .maybeSingle();
      if (wfError || !workflow) throw wfError || new Error("Workflow não encontrado");

      const { data: etapas, error: etapasError } = await supabase
        .from("workflow_etapas")
        .select("*")
        .eq("workflow_id", workflowId)
        .order("ordem", { ascending: true });
      if (etapasError) throw etapasError;
      if (!etapas || etapas.length === 0) throw new Error("Workflow sem etapas");

      const hojeStr = new Date().toISOString().split("T")[0];
      const dataInicio = input.data_inicio || hojeStr;
      const { data: execucao, error: execError } = await supabase
        .from("workflow_execucoes")
        .insert({
          workflow_id: workflowId,
          processo_id: processo_id || null,
          iniciado_por: user.id,
          coordenacao_id: coordenacao_id || (workflow as any).coordenacao_id,
          status: "em_andamento",
          data_inicio: dataInicio,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();
      if (execError) throw execError;

      const execucaoId = (execucao as any).id;
      const execucaoCast = execucao as any;
      const primeiraEtapa = etapas[0];

      // Referência = data de início informada (ou hoje), ao meio-dia para
      // evitar deslocamento de fuso ao formatar.
      const dataReferencia = new Date(`${dataInicio}T12:00:00`);

      const responsavel = resolverResponsavelEtapa(primeiraEtapa as WorkflowEtapa, {
        iniciadorId: user.id,
        responsavelInicial: responsavel_inicial,
      });

      const item = await criarItemWorkflow(
        execucaoCast as WorkflowExecucao,
        primeiraEtapa as WorkflowEtapa,
        dataReferencia,
        responsavel,
        processo_id,
        processo_numero
      );

      const dataPrevista = primeiraEtapa.dias_previsto
        ? calcularDataOffset(dataReferencia, primeiraEtapa.dias_previsto, primeiraEtapa.tipo_prazo as "dias_corridos" | "dias_uteis").toISOString().split("T")[0]
        : dataInicio;
      const dataFatal = primeiraEtapa.dias_fatal
        ? calcularDataOffset(dataReferencia, primeiraEtapa.dias_fatal, primeiraEtapa.tipo_prazo as "dias_corridos" | "dias_uteis").toISOString().split("T")[0]
        : dataPrevista;

      const etapasExecucao = etapas.map((etapa, idx) => ({
        execucao_id: execucaoId,
        etapa_id: etapa.id,
        ordem: (etapa as WorkflowEtapa).ordem || idx + 1,
        status: idx === 0 ? "materializada" : "pendente",
        item_id: idx === 0 ? (item?.id || null) : null,
        item_tipo: idx === 0 ? (item?.tipo || null) : (etapa as WorkflowEtapa).tipo_item,
        data_prevista_calculada: idx === 0 ? dataPrevista : null,
        data_fatal_calculada: idx === 0 ? dataFatal : null,
      }));

      const { error: etapasExecError } = await supabase
        .from("workflow_execucao_etapas")
        .insert(etapasExecucao);
      if (etapasExecError) throw etapasExecError;

      return execucaoId as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-execucoes"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-execucao", id] });
      toast.success("Workflow iniciado com sucesso!");
    },
    onError: (err: Error) => toast.error("Erro ao iniciar workflow: " + err.message),
  });
}

export function useAvancarWorkflowEtapa() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      execucaoId,
      sucesso = true,
    }: {
      execucaoId: string;
      sucesso?: boolean;
    }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      return await avancarExecucaoWorkflow(execucaoId, sucesso);
    },
    onSuccess: (_, variables) => {
      const execucaoId = variables.execucaoId;
      queryClient.invalidateQueries({ queryKey: ["workflow-execucao", execucaoId] });
      queryClient.invalidateQueries({ queryKey: ["workflow-execucao-etapas", execucaoId] });
      queryClient.invalidateQueries({ queryKey: ["workflow-execucoes"] });
      toast.success("Workflow avançado para próxima etapa!");
    },
    onError: (err: Error) => toast.error("Erro ao avançar workflow: " + err.message),
  });
}

/**
 * Sincroniza execuções com a situação real dos itens (tarefas/agenda):
 * ao concluir a tarefa no Painel de Controle, a próxima etapa é criada.
 */
export function useSincronizarWorkflows(enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["workflow-sync"],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const avancadas = await sincronizarWorkflowsPorItens();
      if (avancadas > 0) {
        await queryClient.invalidateQueries({ queryKey: ["workflow-execucoes"] });
        await queryClient.invalidateQueries({ queryKey: ["workflow-execucao-etapas"] });
      }
      return avancadas;
    },
  });
}

