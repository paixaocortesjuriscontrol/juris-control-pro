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

export function useWorkflowExecucoes(workflowId?: string) {
  return useQuery({
    queryKey: ["workflow-execucoes", workflowId],
    queryFn: async () => {
      let query = supabase
        .from("workflow_execucoes")
        .select("*, workflow:workflows(id, nome, coordenacao:coordenacoes(id, nome))")
        .order("iniciado_em", { ascending: false });
      if (workflowId) {
        query = query.eq("workflow_id", workflowId);
      }
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

export function useCreateWorkflowEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<WorkflowEtapa, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("workflow_etapas")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WorkflowEtapa;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-etapas", variables.workflow_id] });
      toast.success("Etapa adicionada!");
    },
    onError: (err: Error) => toast.error("Erro ao adicionar etapa: " + err.message),
  });
}

export function useUpdateWorkflowEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkflowEtapa> & { id: string }) => {
      const { data, error } = await supabase
        .from("workflow_etapas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WorkflowEtapa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-etapas"] });
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

      const agora = new Date().toISOString();
      const dataInicio = new Date().toISOString().split("T")[0];
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

      const dataReferencia = new Date();
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

      const { data: execucao, error: execError } = await supabase
        .from("workflow_execucoes")
        .select("*")
        .eq("id", execucaoId)
        .maybeSingle();
      if (execError || !execucao) throw execError || new Error("Execução não encontrada");

      const { data: etapasExec, error: etapasError } = await supabase
        .from("workflow_execucao_etapas")
        .select("*, etapa:workflow_etapas(*)")
        .eq("execucao_id", execucaoId)
        .order("ordem", { ascending: true });
      if (etapasError || !etapasExec) throw etapasError || new Error("Etapas não encontradas");

      const execucaoCast = execucao as any;
      const etapas = (etapasExec as any[]).map((e) => ({
        ...e,
        etapa: e.etapa as WorkflowEtapa,
      })) as WorkflowExecucaoEtapa[];

      const etapaConcluida = etapas.find((e) => e.status === "materializada");
      if (!etapaConcluida) throw new Error("Nenhuma etapa ativa para concluir");

      const ordemAtual = etapaConcluida.etapa?.ordem || 0;
      // atualiza a etapa atual como concluída, com sucesso ou insucesso
      await supabase
        .from("workflow_execucao_etapas")
        .update({ status: "concluida", sucesso })
        .eq("id", etapaConcluida.id);
      // reflete o resultado na cópia local para a avaliação das condições abaixo
      etapaConcluida.status = "concluida" as any;
      etapaConcluida.sucesso = sucesso as any;

      // encontra próxima etapa cujas condições sejam satisfeitas
      let proxima = etapas.find((e) => (e.etapa?.ordem || 0) > ordemAtual && e.status === "pendente");
      while (proxima) {
        const condicao = proxima.etapa?.condicao || "sempre";
        if (condicao === "sucesso_anterior") {
          // valida se a etapa anterior imediata (ou a definida por etapa_anterior_id) foi concluída com sucesso
          const refId = proxima.etapa?.etapa_anterior_id;
          let anteriorConcluidaComSucesso: boolean;
          if (refId) {
            const ref = etapas.find((e) => e.etapa_id === refId);
            anteriorConcluidaComSucesso = ref?.status === "concluida" && ref?.sucesso;
          } else {
            const anterior = etapas.find((e) => (e.etapa?.ordem || 0) < (proxima.etapa?.ordem || 0) && e.status === "concluida");
            anteriorConcluidaComSucesso = anterior?.sucesso || false;
          }
          if (!anteriorConcluidaComSucesso) {
            // pula esta etapa: marca como cancelada e continua procurando
            await supabase
              .from("workflow_execucao_etapas")
              .update({ status: "cancelada", sucesso: false })
              .eq("id", proxima.id);
            const proximaOrdem = proxima.etapa?.ordem || 0;
            proxima = etapas.find(
              (e) => (e.etapa?.ordem || 0) > proximaOrdem && e.status === "pendente"
            );
            continue;
          }
        }
        break;
      }

      if (!proxima) {
        await supabase
          .from("workflow_execucoes")
          .update({ status: "concluido" })
          .eq("id", execucaoId);
        return { concluido: true };
      }

      const dataReferencia = new Date();
      const responsavelAnterior = etapaConcluida.item_id
        ? await buscarResponsavelItem(etapaConcluida.item_tipo, etapaConcluida.item_id)
        : null;
      const responsavel = resolverResponsavelEtapa(proxima.etapa as WorkflowEtapa, {
        responsavelAnterior,
        iniciadorId: execucaoCast.iniciado_por,
        responsavelInicial: undefined,
      });

      const item = await criarItemWorkflow(
        execucaoCast as WorkflowExecucao,
        proxima.etapa as WorkflowEtapa,
        dataReferencia,
        responsavel,
        execucaoCast.processo_id,
        execucaoCast.processo_numero
      );

      const dataPrevista = proxima.etapa?.dias_previsto
        ? calcularDataOffset(dataReferencia, proxima.etapa.dias_previsto, proxima.etapa.tipo_prazo as "dias_corridos" | "dias_uteis").toISOString().split("T")[0]
        : dataReferencia.toISOString().split("T")[0];
      const dataFatal = proxima.etapa?.dias_fatal
        ? calcularDataOffset(dataReferencia, proxima.etapa.dias_fatal, proxima.etapa.tipo_prazo as "dias_corridos" | "dias_uteis").toISOString().split("T")[0]
        : dataPrevista;

      await supabase
        .from("workflow_execucao_etapas")
        .update({
          status: "materializada",
          item_id: item?.id || null,
          item_tipo: item?.tipo || (proxima.etapa as WorkflowEtapa).tipo_item,
          data_prevista_calculada: dataPrevista,
          data_fatal_calculada: dataFatal,
        })
        .eq("id", proxima.id);

      return { concluido: false };
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

async function buscarResponsavelItem(
  tipo: WorkflowItemType | null,
  itemId: string | null
): Promise<string | null> {
  if (!tipo || !itemId) return null;
  try {
    switch (tipo) {
      case "PRAZO":
      case "TAREFA": {
        const { data } = await supabase
          .from("tarefas")
          .select("responsavel_id")
          .eq("id", itemId)
          .maybeSingle();
        return (data as any)?.responsavel_id || null;
      }
      case "AUDIENCIA": {
        const { data } = await supabase
          .from("audiencias_detectadas")
          .select("criado_por")
          .eq("id", itemId)
          .maybeSingle();
        return (data as any)?.criado_por || null;
      }
      case "EVENTO":
      case "PARCELAMENTO": {
        const { data } = await supabase
          .from("participantes_evento")
          .select("usuario_id")
          .eq("evento_id", itemId)
          .limit(1)
          .maybeSingle();
        return (data as any)?.usuario_id || null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
