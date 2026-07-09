import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Loader2, PlayCircle, StopCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useCancelarExecucaoServidor,
  useConfiguracoesServidor,
  useEnfileirarManual,
  useExecucaoServidorAoVivo,
} from "@/hooks/useDjenServidor";
import { HorariosDoDiaPicker } from "@/components/djen/HorariosDoDiaPicker";
import { DiasSemanaPicker, DIAS_SEMANA_DEFAULT } from "@/components/djen/DiasSemanaPicker";

const TIPO = "djen_stf_servidor";

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
  pendente: { label: "Aguardando", cls: "text-amber-700 bg-amber-500/10", icon: <Clock className="h-4 w-4" /> },
  executando: { label: "Executando", cls: "text-blue-700 bg-blue-500/10", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  concluido: { label: "Concluído", cls: "text-muted-foreground bg-muted/50", icon: <CheckCircle2 className="h-4 w-4" /> },
  cancelado: { label: "Cancelado", cls: "text-amber-700 bg-amber-500/10", icon: <StopCircle className="h-4 w-4" /> },
  erro: { label: "Erro", cls: "text-destructive bg-destructive/10", icon: <XCircle className="h-4 w-4" /> },
  idle: { label: "Aguardando", cls: "text-muted-foreground bg-muted/50", icon: <Clock className="h-4 w-4" /> },
};

export function DjenServidorStfCard() {
  const { data: configs = [], toggle, updateConfig } = useConfiguracoesServidor();
  const cfg = configs.find((c) => c.tipo === TIPO);
  const live = useExecucaoServidorAoVivo(TIPO);
  const enfileirar = useEnfileirarManual();
  const cancelar = useCancelarExecucaoServidor();

  const { data: contagemAtivos } = useQuery({
    queryKey: ["stf-servidor", "monitoramentos-ativos"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("monitoramentos_djen")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("arquivado", false)
        .eq("busca_stf_ativa", true);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30_000,
  });

  const diasSemana = ((cfg?.metadata as any)?.dias_semana as number[] | undefined) || DIAS_SEMANA_DEFAULT;

  const handleToggleAgenda = useCallback(async (checked: boolean) => {
    if (!cfg) return;
    await toggle.mutateAsync({ id: cfg.id, ativo: checked });
  }, [cfg, toggle]);

  const handleHorariosChange = useCallback(async (proximos: string[]) => {
    if (!cfg) return;
    await updateConfig.mutateAsync({ id: cfg.id, patch: { horarios_execucao: proximos } });
  }, [cfg, updateConfig]);

  const handleDiasSemanaChange = useCallback(async (dias: number[]) => {
    if (!cfg) return;
    const meta = { ...(cfg.metadata as any || {}), dias_semana: dias };
    await updateConfig.mutateAsync({ id: cfg.id, patch: { metadata: meta } });
  }, [cfg, updateConfig]);

  const handleExecutar = useCallback(() => {
    enfileirar.mutate({ tipo: TIPO, payload: {} });
  }, [enfileirar]);

  const exec = live.data;
  const execStatus = exec?.status || "idle";
  const isRunning = execStatus === "pendente" || execStatus === "executando";
  const statusCfg = STATUS_LABEL[execStatus] || STATUS_LABEL.idle;
  const progress = exec?.progresso as any;
  const total = progress?.totalItens ?? 0;
  const done = progress?.concluidos ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const novas = Number(progress?.novas ?? exec?.resultado?.novas ?? 0);
  const descartadas = Number(progress?.descartadas ?? exec?.resultado?.descartadas ?? 0);
  const duplicatas = Number(progress?.duplicatas ?? exec?.resultado?.duplicatas ?? 0);

  const handleParar = useCallback(() => {
    if (exec?.id && isRunning) cancelar.mutate(exec.id);
    else toast.info("Não há execução ativa para parar");
  }, [cancelar, exec?.id, isRunning]);

  if (!cfg) {
    return <p className="text-sm text-muted-foreground">Configuração STF Servidor ainda não criada.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            <CardTitle>STF Servidor</CardTitle>
            <Badge variant="outline" className="text-xs">
              {contagemAtivos ?? 0} monitoramento{contagemAtivos === 1 ? "" : "s"} com STF ativo
            </Badge>
          </div>
          <div className={cn("px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2", statusCfg.cls)}>
            {statusCfg.icon}
            {statusCfg.label}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          O STF <strong>não</strong> publica no DJEN / PJe Comunica. Este motor consulta o portal
          <strong> DJE-STF (digital.stf.jus.br)</strong> nas 13 VPS, usando as mesmas regras (data do dia BRT,
          validação estrita, exclusões, condição concomitante) do DJEN Termos Servidor. Só rodam os monitoramentos
          com a opção <em>"Também buscar no STF"</em> ligada.
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Agendamento automático
            </div>
            <Badge variant={cfg.ativo ? "default" : "secondary"}>{cfg.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <label htmlFor="stf-servidor-scheduler-toggle" className="text-sm font-medium">Ativar agendamento</label>
            <Switch id="stf-servidor-scheduler-toggle" checked={cfg.ativo} onCheckedChange={handleToggleAgenda} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Horários BRT (até 3 por dia)</label>
            <HorariosDoDiaPicker
              value={(cfg.horarios_execucao || []) as string[]}
              onChange={handleHorariosChange}
              disabled={!cfg.ativo}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Dias da semana</label>
            <DiasSemanaPicker
              value={diasSemana}
              onChange={handleDiasSemanaChange}
              disabled={!cfg.ativo}
            />
          </div>
        </div>

        {(isRunning || progress) && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{done}/{total} monitoramentos</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded bg-emerald-500/10 text-emerald-700 px-2 py-1 text-center">Novas: <strong>{novas}</strong></div>
              <div className="rounded bg-amber-500/10 text-amber-700 px-2 py-1 text-center">Descartadas: <strong>{descartadas}</strong></div>
              <div className="rounded bg-muted px-2 py-1 text-center">Duplicatas: <strong>{duplicatas}</strong></div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExecutar} disabled={isRunning || enfileirar.isPending} size="sm">
            <PlayCircle className="h-4 w-4 mr-1" />
            Executar agora
          </Button>
          {isRunning && (
            <Button onClick={handleParar} variant="outline" size="sm">
              <StopCircle className="h-4 w-4 mr-1" />
              Parar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}