/**
 * Banner que mostra o progresso do monitoramento DJEN Termos
 * quando está em execução. Usado na tela de Análise DJEN.
 */

import { useDjenTermos } from "@/hooks/useDjenTermos";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Newspaper, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DjenExecutionBanner() {
  const { progress, isRunning } = useDjenTermos();

  // Quando o DJEN roda em modo híbrido/100% backend, o engine local pode não estar ativo.
  // Então buscamos um snapshot do backend via metadata + última execução.
  const { data: backendSnapshot } = useQuery({
    queryKey: ["djen-termos-banner-backend"],
    queryFn: async () => {
      const [configRes, execRes] = await Promise.all([
        supabase
          .from("configuracoes_monitoramento")
          .select("metadata, ultima_execucao")
          .eq("tipo", "djen")
          .is("coordenacao_id", null)
          .maybeSingle(),
        supabase
          .from("execucoes_agendadas")
          .select("id, status, iniciado_em, finalizado_em, detalhes")
          .eq("tipo", "djen")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (configRes.error) throw configRes.error;
      if (execRes.error) throw execRes.error;

      return {
        metadata: (configRes.data?.metadata as Record<string, any> | null) ?? null,
        ultima_execucao: (configRes.data as any)?.ultima_execucao as string | null,
        lastExecution: execRes.data as any,
      };
    },
    refetchInterval: (q) => {
      const md = (q.state.data as any)?.metadata as Record<string, any> | null;
      const exec = (q.state.data as any)?.lastExecution as any;

      const mdStatus = md?.status;
      const backendRunning =
        mdStatus === "em_andamento" ||
        mdStatus === "executando" ||
        (exec?.status === "executando" && !exec?.finalizado_em);

      return backendRunning ? 3000 : 8000;
    },
  });

  const md = backendSnapshot?.metadata ?? {};
  const lastExec = backendSnapshot?.lastExecution;

  const backendIsRunning =
    md.status === "em_andamento" ||
    md.status === "executando" ||
    (lastExec?.status === "executando" && !lastExec?.finalizado_em);

  const effectiveIsRunning = isRunning || progress.status === "executando" || backendIsRunning;

  // Não mostrar se não está executando (local ou backend)
  if (!effectiveIsRunning) {
    return null;
  }

  const percentage =
    (typeof progress.percentage === "number" && progress.percentage > 0)
      ? progress.percentage
      : (typeof md.percentage === "number")
        ? md.percentage
        : (typeof md.current === "number" && typeof md.total === "number" && md.total > 0)
          ? Math.min(99, Math.round((md.current / md.total) * 100))
          : 0;

  const termoAtual =
    progress.termoAtual ||
    (typeof md.termoAtual === "string" ? md.termoAtual : null) ||
    (typeof md.message === "string" ? md.message : null) ||
    "Processando...";

  const diaAtual =
    progress.diaAtualYmd ||
    (typeof md.diaAtualYmd === "string" ? md.diaAtualYmd : null) ||
    (typeof md.diaAtual === "string" ? md.diaAtual : null);

  const tempoDecorrido = (() => {
    const local = progress.tempoDecorrido || 0;
    if (local > 0) return local;
    if (lastExec?.iniciado_em) {
      const started = new Date(lastExec.iniciado_em).getTime();
      if (Number.isFinite(started)) return Math.max(0, Math.floor((Date.now() - started) / 1000));
    }
    return 0;
  })();

  return (
    <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Newspaper className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Monitoramento DJEN em execução</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30 gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {percentage}%
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {tempoDecorrido > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(tempoDecorrido)}
                </span>
              )}
              <Link to="/configuracoes">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Ver detalhes
                </Button>
              </Link>
            </div>
          </div>
          
          <Progress value={percentage} className="h-2" />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[60%]">
               {diaAtual && (
                 <span className="mr-2">
                   📅 Dia {progress.diaAtualIndice || md.diaAtualIndice || md.diaIndice || "?"}/
                   {progress.totalDias || md.totalDias || "?"}
                 </span>
               )}
              <span className="text-foreground/70">{termoAtual}</span>
            </span>
            
            <div className="flex items-center gap-3 flex-shrink-0">
               {(progress.novas || md.novas || md.encontradas || 0) > 0 && (
                <span className="text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                   {progress.novas || md.novas || md.encontradas} novas
                </span>
              )}
               {(progress.duplicadas || md.duplicadas || md.duplicatas || 0) > 0 && (
                 <span>↔ {progress.duplicadas || md.duplicadas || md.duplicatas} dup.</span>
              )}
               {(progress.descartadas || md.descartadas || md.discarded || 0) > 0 && (
                 <span>✗ {progress.descartadas || md.descartadas || md.discarded} desc.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
