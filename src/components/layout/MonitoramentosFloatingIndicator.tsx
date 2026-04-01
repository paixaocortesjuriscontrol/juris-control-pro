/**
 * Indicador flutuante global que mostra engines DJEN ativos em qualquer página.
 * Aparece no canto inferior-direito quando há engines rodando.
 * 
 * Usa TRÊS fontes:
 * 1. Subscribers locais (engine rodando nesta aba)
 * 2. Polling do banco (configuracoes_monitoramento.ativo) para schedulers ativos
 * 3. Polling de execucoes_agendadas com status='executando' para engines backend
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronDown, ChevronUp, Settings, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  subscribeDjenProcessos,
  getDjenProcessosProgress,
  isDjenProcessosRunning,
  type DjenProcessosProgress,
} from "@/hooks/useDjenProcessosEngine";
import {
  subscribeDjenTermosPro,
  getDjenTermosProProgress,
  isDjenTermosProRunning,
  type DjenTermosProProgress,
} from "@/hooks/useDjenTermosProEngine";
import {
  subscribeDjenTermos,
  getDjenTermosProgress,
  isDjenTermosRunning,
} from "@/hooks/useDjenTermosEngine";

interface EngineInfo {
  id: string;
  label: string;
  status: string;
  percentage: number;
  mensagem: string;
  tempoDecorrido: number;
  novas: number;
}

interface DbActiveEngine {
  tipo: string;
  label: string;
  ativo: boolean;
  percentage: number;
  mensagem: string;
  novas: number;
  tempoDecorrido: number;
}

function formatTempo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m${rs > 0 ? `${rs}s` : ""}`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

const DB_TYPE_MAP: Record<string, { localKey: string; label: string }> = {
  djen_pro: { localKey: 'termos_pro', label: 'DJEN Termos Pro' },
  djen_processos: { localKey: 'processos', label: 'DJEN Processos' },
  djen_termos: { localKey: 'termos', label: 'DJEN Termos' },
};

export function MonitoramentosFloatingIndicator() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Local engine states (from in-tab subscribers)
  const [procProgress, setProcProgress] = useState<DjenProcessosProgress>(getDjenProcessosProgress);
  const [procRunning, setProcRunning] = useState(isDjenProcessosRunning);
  const [termosProProgress, setTermosProProgress] = useState<DjenTermosProProgress>(getDjenTermosProProgress);
  const [termosProRunning, setTermosProRunning] = useState(isDjenTermosProRunning);
  const [termosProgress, setTermosProgress] = useState(getDjenTermosProgress);
  const [termosRunning, setTermosRunning] = useState(isDjenTermosRunning);

  // DB-detected active schedulers/engines
  const [dbActiveEngines, setDbActiveEngines] = useState<DbActiveEngine[]>([]);

  // Subscribe to local engines
  useEffect(() => {
    const unsub1 = subscribeDjenProcessos((p) => {
      setProcProgress(p);
      setProcRunning(isDjenProcessosRunning());
    });
    const unsub2 = subscribeDjenTermosPro((p) => {
      setTermosProProgress(p);
      setTermosProRunning(isDjenTermosProRunning());
    });
    const unsub3 = subscribeDjenTermos((p: any) => {
      setTermosProgress(p);
      setTermosRunning(isDjenTermosRunning());
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // Poll DB for actively RUNNING executions (not just scheduler enabled)
  useEffect(() => {
    let cancelled = false;

    async function pollDb() {
      try {
        // Only show engines that are actually executing right now
        const { data } = await supabase
          .from('execucoes_agendadas')
          .select('id, tipo, status, detalhes, iniciado_em')
          .eq('status', 'executando')
          .in('tipo', ['djen_pro', 'djen_processos', 'djen'])
          .is('finalizado_em', null);

        if (cancelled || !data) return;

        // Deduplicate by tipo — keep the most recent one per type
        const byTipo = new Map<string, typeof data[0]>();
        for (const row of data) {
          const tipoKey = row.tipo === 'djen' ? 'djen_termos' : row.tipo === 'djen_pro' ? 'djen_pro' : 'djen_processos';
          const existing = byTipo.get(tipoKey);
          if (!existing || (row.iniciado_em && (!existing.iniciado_em || row.iniciado_em > existing.iniciado_em))) {
            byTipo.set(tipoKey, row);
          }
        }

        const active: DbActiveEngine[] = [];
        for (const [tipoKey, row] of byTipo) {
          const mapping = DB_TYPE_MAP[tipoKey];
          if (!mapping) continue;

          const det = row.detalhes as any;
          const percentage = det?.percentage || det?.progress?.percentage || 0;
          const mensagem = det?.mensagem || det?.etapaAtual || 'Executando...';
          const novas = det?.novas || det?.totalNovas || 0;
          const iniciadoEm = row.iniciado_em ? new Date(row.iniciado_em).getTime() : Date.now();
          const tempoDecorrido = Date.now() - iniciadoEm;

          active.push({
            tipo: tipoKey,
            label: mapping.label,
            ativo: true,
            percentage,
            mensagem,
            novas,
            tempoDecorrido,
          });
        }
        setDbActiveEngines(active);
      } catch {
        // ignore
      }
    }

    pollDb();
    const interval = setInterval(pollDb, 8_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Build active engines list — prefer local state, fallback to DB
  const engines: EngineInfo[] = [];
  const localActiveKeys = new Set<string>();

  if (procRunning || procProgress.status === 'executando') {
    localActiveKeys.add('processos');
    engines.push({
      id: 'processos',
      label: 'DJEN Processos',
      status: procProgress.status,
      percentage: procProgress.percentage || 0,
      mensagem: procProgress.mensagem || `Grupo ${procProgress.currentGroup}/${procProgress.totalGroups}`,
      tempoDecorrido: procProgress.tempoDecorrido || 0,
      novas: procProgress.novas || 0,
    });
  }

  if (termosProRunning || termosProProgress.status === 'executando') {
    localActiveKeys.add('termos_pro');
    engines.push({
      id: 'termos_pro',
      label: 'DJEN Termos Pro',
      status: termosProProgress.status,
      percentage: termosProProgress.percentage || 0,
      mensagem: termosProProgress.mensagem || `Termo ${termosProProgress.termoAtualNoDia}/${termosProProgress.totalTermos}`,
      tempoDecorrido: termosProProgress.tempoDecorrido || 0,
      novas: termosProProgress.novas || 0,
    });
  }

  if (termosRunning || (termosProgress as any)?.status === 'executando') {
    localActiveKeys.add('termos');
    const tp = termosProgress as any;
    engines.push({
      id: 'termos',
      label: 'DJEN Termos',
      status: tp?.status || 'executando',
      percentage: tp?.percentage || 0,
      mensagem: tp?.mensagem || 'Executando...',
      tempoDecorrido: tp?.tempoDecorrido || 0,
      novas: tp?.novas || 0,
    });
  }

  // Add DB-detected engines not already tracked locally
  for (const dbEng of dbActiveEngines) {
    const mapping = DB_TYPE_MAP[dbEng.tipo];
    if (mapping && !localActiveKeys.has(mapping.localKey)) {
      engines.push({
        id: `db_${dbEng.tipo}`,
        label: dbEng.label,
        status: 'executando',
        percentage: dbEng.percentage,
        mensagem: dbEng.mensagem,
        tempoDecorrido: dbEng.tempoDecorrido,
        novas: dbEng.novas,
      });
    }
  }

  // Reset dismissed when engines appear
  const prevCount = useRef(0);
  useEffect(() => {
    if (engines.length > 0 && prevCount.current === 0) setDismissed(false);
    prevCount.current = engines.length;
  }, [engines.length]);

  if (engines.length === 0 || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all animate-pulse"
        >
          <Activity className="h-4 w-4" />
          <span className="text-sm font-medium">
            {engines.length} {engines.length === 1 ? 'engine ativo' : 'engines ativos'}
          </span>
          <ChevronUp className="h-3 w-3" />
        </button>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-xl">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-semibold">Monitoramentos Ativos</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => navigate('/configuracoes')}
                title="Ir para Configurações"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setExpanded(false)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setDismissed(true)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
            {engines.map((engine) => (
              <div key={engine.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{engine.label}</span>
                  <div className="flex items-center gap-1.5">
                    {engine.novas > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {engine.novas} novas
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatTempo(engine.tempoDecorrido)}
                    </span>
                  </div>
                </div>
                <Progress value={engine.percentage} className="h-2" />
                <p className="text-[10px] text-muted-foreground truncate">
                  {engine.percentage}% — {engine.mensagem}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
