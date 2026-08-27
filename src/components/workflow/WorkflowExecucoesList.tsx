import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useWorkflowExecucoes,
  useWorkflowExecucaoEtapas,
  useAvancarWorkflowEtapa,
  useWorkflows,
  useSincronizarWorkflows,
  useWorkflowEtapasResponsaveis,
  useWorkflowItensResponsaveis,
} from "@/hooks/useWorkflows";
import { useUsuariosAuditoria } from "@/hooks/useUsuariosAuditoria";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WorkflowExecucao,
  WorkflowExecucaoEtapa,
  WORKFLOW_ITEM_LABELS,
} from "@/lib/workflowExecutor";
import { Eye, CheckCircle, ChevronRight, XCircle, Users, CalendarClock, Flag } from "lucide-react";
import { format, parseISO } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  pendente: "Pendente",
  materializada: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const REGRA_RESPONSAVEL_LABELS: Record<string, string> = {
  predefinido: "Responsável predefinido",
  etapa_anterior: "Responsável da etapa anterior",
  iniciador: "Quem iniciou o fluxo",
};

function formatarData(valor?: string | null) {
  if (!valor) return null;
  try {
    return format(parseISO(String(valor).slice(0, 10)), "dd/MM/yyyy");
  } catch {
    return String(valor);
  }
}

interface WorkflowExecucoesListProps {
  onView?: (execucao: WorkflowExecucao) => void;
}


export function WorkflowExecucoesList({ onView }: WorkflowExecucoesListProps) {
  const [filtroWorkflow, setFiltroWorkflow] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [busca, setBusca] = useState<string>("");

  useSincronizarWorkflows();
  const { data: workflows = [] } = useWorkflows();
  const { data: execucoesRaw = [], isLoading } = useWorkflowExecucoes({
    workflowId: filtroWorkflow !== "todos" ? filtroWorkflow : undefined,
    status: filtroStatus !== "todos" ? filtroStatus : undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  });
  const termo = busca.trim().toLowerCase();
  const execucoes = termo
    ? execucoesRaw.filter((e) =>
        (e.workflow?.nome || "").toLowerCase().includes(termo)
      )
    : execucoesRaw;
  const [selected, setSelected] = useState<string | null>(null);
  const { data: etapas = [] } = useWorkflowExecucaoEtapas(selected || undefined);
  const avancar = useAvancarWorkflowEtapa();

  const execucaoSelecionada = execucoes.find((e) => e.id === selected);
  const { data: responsaveisPorEtapa = {} } = useWorkflowEtapasResponsaveis(
    execucaoSelecionada?.workflow_id
  );
  const itemIds = useMemo(
    () => etapas.map((e: WorkflowExecucaoEtapa) => e.item_id).filter(Boolean) as string[],
    [etapas]
  );
  const { data: responsaveisPorItem = {} } = useWorkflowItensResponsaveis(itemIds);
  const idsResponsaveis = useMemo(() => {
    const set = new Set<string>();
    etapas.forEach((e: WorkflowExecucaoEtapa) => {
      (responsaveisPorEtapa[e.etapa_id] || []).forEach((id) => set.add(id));
      if (e.item_id) (responsaveisPorItem[e.item_id] || []).forEach((id) => set.add(id));
      const pre = (e.etapa as any)?.responsavel_id;
      if (pre) set.add(pre);
    });
    if (execucaoSelecionada?.iniciado_por) set.add(execucaoSelecionada.iniciado_por);
    return Array.from(set);
  }, [etapas, responsaveisPorEtapa, responsaveisPorItem, execucaoSelecionada?.iniciado_por]);
  const usuarios = useUsuariosAuditoria(idsResponsaveis);




  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">Carregando execuções...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Execuções</h2>

      <div className="grid gap-2 md:grid-cols-5">
        <Input
          placeholder="Buscar fluxo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9"
        />
        <Select value={filtroWorkflow} onValueChange={setFiltroWorkflow}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Fluxo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os fluxos</SelectItem>
            {workflows.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="h-9"
        />
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="h-9"
        />
      </div>
      {execucoes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Nenhuma execução encontrada com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {execucoes.map((exec) => (
            <Card key={exec.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{exec.workflow?.nome}</CardTitle>
                    <Badge
                      variant={exec.status === "concluido" ? "default" : "secondary"}
                    >
                      {STATUS_LABELS[exec.status] || exec.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelected(selected === exec.id ? null : exec.id)}
                      title="Ver etapas"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onView && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(exec)}
                        title="Abrir"
                      >
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Iniciado em {format(parseISO(exec.data_inicio), "dd/MM/yyyy")}
                </p>
              </CardHeader>
              {selected === exec.id && (
                <CardContent className="pt-0">
                  <div className="border-t pt-3 mt-1 space-y-2">
                    <h4 className="text-sm font-medium">Etapas</h4>
                    {etapas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem etapas</p>
                    ) : (
                      <div className="space-y-2">
                        {etapas.map((etapa: WorkflowExecucaoEtapa) => {
                          const cfg = etapa.etapa as any;
                          const respDoItem = etapa.item_id
                            ? responsaveisPorItem[etapa.item_id] || []
                            : [];
                          const respIds = Array.from(
                            new Set(
                              respDoItem.length
                                ? respDoItem
                                : [
                                    ...(responsaveisPorEtapa[etapa.etapa_id] || []),
                                    ...(cfg?.responsavel_id ? [cfg.responsavel_id] : []),
                                  ]
                            )
                          );
                          const nomes = respIds.map((id) => usuarios.nome(id));
                          const prev = formatarData(etapa.data_prevista_calculada);
                          const fatal = formatarData(etapa.data_fatal_calculada);
                          const tipoItem =
                            WORKFLOW_ITEM_LABELS[
                              (etapa.item_tipo || cfg?.tipo_item) as keyof typeof WORKFLOW_ITEM_LABELS
                            ] || String(etapa.item_tipo || cfg?.tipo_item || "");
                          return (
                            <div
                              key={etapa.id}
                              className="rounded-md border p-2.5 text-sm space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                  <span className="font-medium">
                                    {cfg?.ordem ? `${cfg.ordem}. ` : ""}
                                    {cfg?.titulo}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {STATUS_LABELS[etapa.status] || etapa.status}
                                  </Badge>
                                  {tipoItem && (
                                    <Badge variant="secondary" className="text-xs">
                                      {tipoItem}
                                    </Badge>
                                  )}
                                  {etapa.status === "concluida" && (
                                    <Badge
                                      variant="outline"
                                      className={
                                        etapa.sucesso
                                          ? "text-xs border-primary/40 text-primary"
                                          : "text-xs border-destructive/40 text-destructive"
                                      }
                                    >
                                      {etapa.sucesso ? "Com sucesso" : "Sem sucesso"}
                                    </Badge>
                                  )}
                                </div>
                                {etapa.status === "materializada" && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => avancar.mutate({ execucaoId: exec.id, sucesso: true })}
                                      disabled={avancar.isPending}
                                      title="Concluir etapa com sucesso e avançar"
                                    >
                                      <ChevronRight className="h-4 w-4 text-primary" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            "Concluir esta etapa SEM SUCESSO?\n\nAs etapas que dependem do sucesso desta serão canceladas."
                                          )
                                        ) {
                                          avancar.mutate({ execucaoId: exec.id, sucesso: false });
                                        }
                                      }}
                                      disabled={avancar.isPending}
                                      title="Concluir etapa sem sucesso"
                                    >
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {nomes.length
                                    ? nomes.join(", ")
                                    : REGRA_RESPONSAVEL_LABELS[cfg?.regra_responsavel] ||
                                      "Sem responsável definido"}
                                </span>
                                {(prev || fatal) && (
                                  <span className="flex items-center gap-1">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    {prev ? `Prev: ${prev}` : ""}
                                    {fatal && fatal !== prev ? ` • Fatal: ${fatal}` : ""}
                                  </span>
                                )}
                                {cfg?.prioridade && (
                                  <span className="flex items-center gap-1">
                                    <Flag className="h-3.5 w-3.5" />
                                    {PRIORIDADE_LABELS[cfg.prioridade] || cfg.prioridade}
                                  </span>
                                )}
                                {typeof cfg?.dias_previsto === "number" && (
                                  <span>
                                    {cfg.dias_previsto}{" "}
                                    {cfg.tipo_prazo === "dias_uteis" ? "dias úteis" : "dias corridos"}
                                  </span>
                                )}
                                {cfg?.condicao === "sucesso_anterior" && (
                                  <span>Só se a etapa anterior tiver sucesso</span>
                                )}
                              </div>

                              {cfg?.descricao && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {cfg.descricao}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
