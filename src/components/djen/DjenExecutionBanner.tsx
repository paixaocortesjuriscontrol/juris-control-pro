/**
 * Banner que mostra o progresso do monitoramento DJEN Termos
 * quando está em execução. Usado na tela de Análise DJEN.
 * 
 * IMPORTANTE: Usa APENAS dados do backend (metadata) como fonte única de verdade
 * para evitar flutuações de percentual causadas por múltiplas fontes de dados.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Newspaper, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getExecutionProgress } from "@/utils/executionProgress";

type ExecucaoAtiva = {
  id: string;
  tipo: string;
  status: string;
  iniciado_em: string;
  finalizado_em: string | null;
  registros_processados: number;
  lotes_processados: number;
  total_lotes: number | null;
  detalhes: Record<string, any> | null;
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DjenExecutionBanner() {
  // Execução ativa (fonte única para %). Evita divergência entre Análise e Card.
  const { data: execucoesAtivas = [] } = useQuery({
    queryKey: ["djen-termos-banner-execucao-ativa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execucoes_agendadas")
        .select(
          "id, tipo, status, iniciado_em, finalizado_em, registros_processados, lotes_processados, total_lotes, detalhes"
        )
        .eq("tipo", "djen")
        .eq("status", "executando")
        .is("finalizado_em", null)
        .order("iniciado_em", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as ExecucaoAtiva[];
    },
    refetchInterval: (q) => {
      const rows = (q.state.data as ExecucaoAtiva[] | undefined) ?? [];
      return rows.length > 0 ? 2000 : 10000;
    },
  });

  const execucaoAtiva = useMemo(() => {
    if (!execucoesAtivas.length) return null;
    // Se houver múltiplas, priorizar a que tem progresso real.
    const withProgress = execucoesAtivas.filter((e) => {
      const { current } = getExecutionProgress({
        detalhes: e.detalhes,
        registros_processados: e.registros_processados,
        total_lotes: e.total_lotes,
        lotes_processados: e.lotes_processados,
      });
      return current > 0;
    });
    return (withProgress[0] ?? execucoesAtivas[0]) as ExecucaoAtiva;
  }, [execucoesAtivas]);

  // Busca APENAS os metadados da configuração - fonte única de verdade
  const { data: backendSnapshot } = useQuery({
    queryKey: ["djen-termos-banner-backend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_monitoramento")
        .select("metadata, ultima_execucao")
        .eq("tipo", "djen")
        .is("coordenacao_id", null)
        .maybeSingle();

      if (error) throw error;
      return {
        metadata: (data?.metadata as Record<string, any> | null) ?? null,
        ultima_execucao: (data as any)?.ultima_execucao as string | null,
      };
    },
    refetchInterval: (q) => {
      const md = (q.state.data as any)?.metadata as Record<string, any> | null;
      const mdStatus = md?.status;
      const backendRunning = mdStatus === "em_andamento" || mdStatus === "executando";
      return backendRunning ? 2000 : 10000;
    },
  });

  const md = backendSnapshot?.metadata ?? {};

  // Considerar execução ativa OU metadata
  const backendIsRunning =
    !!execucaoAtiva || md.status === "em_andamento" || md.status === "executando";

  // %: preferir execucoes_agendadas (evita divergência e regressão), fallback metadata
  const computedPercentage = (() => {
    if (execucaoAtiva) {
      const { percentage } = getExecutionProgress({
        detalhes: execucaoAtiva.detalhes,
        registros_processados: execucaoAtiva.registros_processados,
        total_lotes: execucaoAtiva.total_lotes,
        lotes_processados: execucaoAtiva.lotes_processados,
      });

      if (typeof percentage === "number" && Number.isFinite(percentage)) {
        // Mantém abaixo de 100 enquanto está executando para evitar “flash” de 100%.
        return Math.max(0, Math.min(99, Math.round(percentage)));
      }
      return 0;
    }

    const direct = typeof md.percentage === "number" ? md.percentage : null;
    if (typeof direct === "number" && Number.isFinite(direct)) {
      return Math.max(0, Math.min(99, Math.round(direct)));
    }

    const current = typeof md.current === "number" ? md.current : Number(md.current);
    const total = typeof md.total === "number" ? md.total : Number(md.total);
    if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
      // Mantém abaixo de 100 enquanto está executando para evitar “flash” de 100%.
      return Math.max(0, Math.min(99, Math.round((current / total) * 100)));
    }
    return 0;
  })();

  // Para evitar sensação de “indo e voltando” por snapshots intermitentes,
  // tornamos o percentual monotônico durante UMA MESMA execução.
  const runId: string | null =
    (typeof execucaoAtiva?.detalhes?.runId === "string" ? execucaoAtiva?.detalhes?.runId : null) ||
    (typeof execucaoAtiva?.id === "string" ? execucaoAtiva?.id : null) ||
    (typeof md?.djen_run?.run_id === "string" ? md.djen_run.run_id : null) ||
    (typeof md?.execucaoId === "string" ? md.execucaoId : null) ||
    (typeof md?.run_key === "string" ? md.run_key : null);

  const [stablePercentage, setStablePercentage] = useState<number>(() => computedPercentage);
  const lastRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!backendIsRunning) {
      lastRunIdRef.current = null;
      setStablePercentage(0);
      return;
    }

    const key = runId ?? "unknown";
    if (lastRunIdRef.current !== key) {
      lastRunIdRef.current = key;
      setStablePercentage(computedPercentage);
      return;
    }

    setStablePercentage((prev) => Math.max(prev, computedPercentage));
  }, [backendIsRunning, runId, computedPercentage]);

  // Não mostrar se não está executando
  if (!backendIsRunning) {
    return null;
  }

  const termoAtual =
    (typeof md.termoAtual === "string" ? md.termoAtual : null) ||
    (typeof md.mensagem === "string" ? md.mensagem : null) ||
    "Processando...";

  const diaAtual =
    (typeof md.diaAtualYmd === "string" ? md.diaAtualYmd : null) ||
    (typeof md.diaAtual === "string" ? md.diaAtual : null);

  // Calcular tempo decorrido a partir do metadata
  const tempoDecorrido = (() => {
    if (execucaoAtiva?.iniciado_em) {
      const startedAt = new Date(execucaoAtiva.iniciado_em).getTime();
      if (Number.isFinite(startedAt)) {
        return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      }
    }
    if (typeof md.duracao_s === "number" && md.duracao_s > 0) return md.duracao_s;
    const startedAt = md.djen_run?.started_at ? new Date(md.djen_run.started_at).getTime() : null;
    if (startedAt && Number.isFinite(startedAt)) {
      return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    }
    return 0;
  })();

  // Contadores do djen_run (mais precisos) ou do md raiz
  const djenRun = md.djen_run?.totals ?? {};
  const novas = djenRun.novas ?? md.novas ?? md.encontradas ?? 0;
  const duplicadas = djenRun.duplicatas ?? md.duplicadas ?? md.duplicatas ?? 0;
  const descartadas = djenRun.descartadas ?? md.descartadas ?? 0;

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
                {stablePercentage}%
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
          
          <Progress value={stablePercentage} className="h-2" />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[60%]">
               {diaAtual && (
                 <span className="mr-2">
                   📅 Dia {md.diaIndice || md.diaAtualIndice || "?"}/{md.totalDias || "?"}
                 </span>
               )}
              <span className="text-foreground/70">{termoAtual}</span>
            </span>
            
            <div className="flex items-center gap-3 flex-shrink-0">
               {novas > 0 && (
                <span className="text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                   {novas} novas
                </span>
              )}
               {duplicadas > 0 && (
                 <span>↔ {duplicadas} dup.</span>
              )}
               {descartadas > 0 && (
                 <span>✗ {descartadas} desc.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
