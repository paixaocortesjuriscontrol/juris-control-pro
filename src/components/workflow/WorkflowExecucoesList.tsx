import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useWorkflowExecucoes,
  useWorkflowExecucaoEtapas,
  useAvancarWorkflowEtapa,
} from "@/hooks/useWorkflows";
import { WorkflowExecucao, WorkflowExecucaoEtapa } from "@/lib/workflowExecutor";
import { Eye, CheckCircle, ChevronRight } from "lucide-react";
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

interface WorkflowExecucoesListProps {
  onView?: (execucao: WorkflowExecucao) => void;
}

export function WorkflowExecucoesList({ onView }: WorkflowExecucoesListProps) {
  const { data: execucoes = [], isLoading } = useWorkflowExecucoes();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: etapas = [] } = useWorkflowExecucaoEtapas(selected || undefined);
  const avancar = useAvancarWorkflowEtapa();


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
      {execucoes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Nenhuma execução iniciada. Inicie um workflow a partir da lista de fluxos.
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
                        {etapas.map((etapa: WorkflowExecucaoEtapa) => (
                          <div
                            key={etapa.id}
                            className="flex items-center justify-between rounded-md border p-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span>{etapa.etapa?.titulo}</span>
                              <Badge variant="outline" className="text-xs">
                                {STATUS_LABELS[etapa.status] || etapa.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {etapa.data_prevista_calculada && (
                                <span>Prev: {etapa.data_prevista_calculada}</span>
                              )}
                            </div>
                          </div>
                        ))}
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
