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
import { getDjenTermosExecutionProgress } from "@/utils/djenTermosExecutionProgress";

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
  // Um único polling leve (reduz re-render e evita lentidão na Análise)
  const { data: snapshot } = useQuery({
    queryKey: ["djen-termos-banner-snapshot"],
    queryFn: async () => {
      const [execRes, cfgRes] = await Promise.all([
        supabase
          .from("execucoes_agendadas")
          .select(
            // Campos mínimos para calcular % e tempo (evita pesar a tela /analise-djen)
            "id, tipo, status, iniciado_em, finalizado_em, detalhes"
          )
          .eq("tipo", "djen")
          .eq("status", "executando")
          .order("iniciado_em", { ascending: false })
            // Pode haver janela onde finalizado_em está preenchido por snapshot antigo.
            // Mantemos poucas linhas e filtramos localmente.
            .limit(5),
        supabase
          .from("configuracoes_monitoramento")
          .select("metadata")
          .eq("tipo", "djen")
          .is("coordenacao_id", null)
          .maybeSingle(),
      ]);

      if (execRes.error) throw execRes.error;
      if (cfgRes.error) throw cfgRes.error;

      const execucoes = (execRes.data || []) as ExecucaoAtiva[];
      const md = ((cfgRes.data as any)?.metadata as Record<string, any> | null) ?? null;

      return { execucoes, md };
    },
    refetchInterval: (q) => {
      const data = q.state.data as { execucoes: ExecucaoAtiva[]; md: Record<string, any> | null } | undefined;
      const hasExec = (data?.execucoes?.length ?? 0) > 0;
      const mdStatus = data?.md?.status;
      // Evitar polling agressivo quando metadata ficou presa em "em_andamento" sem sinais de continuação.
      const mdHasSignals =
        data?.md?.has_more === true ||
        data?.md?.djen_run != null ||
        data?.md?.next_offset != null ||
        (typeof data?.md?.current === 'number' && data.md.current > 0);
      const mdRunning = (mdStatus === "em_andamento" || mdStatus === "executando") && mdHasSignals;
      return hasExec || mdRunning ? 5000 : 15000;
    },
  });

  const execucaoAtiva = useMemo(() => {
    const rows = snapshot?.execucoes ?? [];
    if (!rows.length) return null;

    const DJEN_ACTIVE_WINDOW_MS = 15 * 60 * 1000;
    const isFresh = (e: ExecucaoAtiva) => {
      if (e.finalizado_em == null) return true;
      const ts = new Date(e.finalizado_em).getTime();
      return Number.isFinite(ts) && (Date.now() - ts) < DJEN_ACTIVE_WINDOW_MS;
    };

    // Se houver múltiplas, priorizar a com maior progresso POR TERMOS (detalhes.progress)
    const candidates = rows.filter(isFresh);
    const scored = (candidates.length ? candidates : rows)
      .map((e) => ({ e, p: getDjenTermosExecutionProgress({ detalhes: e.detalhes }) }))
      .filter((x) => x.p.current > 0 || (x.p.percentage ?? 0) > 0);

    if (!scored.length) return (candidates[0] ?? rows[0]) as ExecucaoAtiva;

    scored.sort((a, b) => {
      const ap = a.p.percentage ?? 0;
      const bp = b.p.percentage ?? 0;
      if (bp !== ap) return bp - ap;
      return b.p.current - a.p.current;
    });

    return scored[0].e as ExecucaoAtiva;
  }, [snapshot]);

  const md = snapshot?.md ?? {};

  const mdStatus = typeof md.status === 'string' ? (md.status as string) : undefined;
  const mdHasSignals =
    md?.has_more === true ||
    md?.djen_run != null ||
    md?.next_offset != null ||
    (typeof md?.current === 'number' && md.current > 0);
  const mdRunningMeaningful = (mdStatus === 'em_andamento' || mdStatus === 'executando') && mdHasSignals;

  // Considerar execução ativa OU metadata
  const backendIsRunning =
    !!execucaoAtiva || mdRunningMeaningful;

  // %: preferir execucoes_agendadas (evita divergência e regressão), fallback metadata
  const computedPercentage = (() => {
    if (execucaoAtiva) {
      const { percentage } = getDjenTermosExecutionProgress({ detalhes: execucaoAtiva.detalhes });

      if (typeof percentage === "number" && Number.isFinite(percentage)) {
        // Mantém abaixo de 100 enquanto está executando para evitar “flash” de 100%.
        return Math.max(0, Math.min(99, Math.round(percentage)));
      }

      // Fallback: há execucaoAtiva, mas detalhes.progress ainda não chegou (janela comum).
      // Nesse caso, usar metadata para não travar em 0%.
      if (mdRunningMeaningful) {
        const direct = typeof md.percentage === "number" ? md.percentage : null;
        if (typeof direct === "number" && Number.isFinite(direct)) {
          return Math.max(0, Math.min(99, Math.round(direct)));
        }

        const current = typeof md.current === "number" ? md.current : Number(md.current);
        const total = typeof md.total === "number" ? md.total : Number(md.total);
        if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
          return Math.max(0, Math.min(99, Math.round((current / total) * 100)));
        }
      }

      return 0;
    }

    // Se não há execução ativa e o metadata não tem sinais consistentes, não exibir “% fantasma”.
    if (!mdRunningMeaningful) return 0;

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

    // Se o backend “some” com o runId por um snapshot, não resetar.
    const key = runId ?? lastRunIdRef.current ?? "unknown";
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
