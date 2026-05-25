import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";

export type ImportPhaseKey =
  | "idle"
  | "preparing"
  | "processos"
  | "responsaveis"
  | "tarefas"
  | "vinculos"
  | "done";

export interface ImportProgressState {
  phase: ImportPhaseKey;
  phaseLabel: string;
  phaseCurrent: number;
  phaseTotal: number;
  overall: number; // 0-100
  detail?: string;
  startedAt?: number;
  counters: {
    novosUsuarios: number;
    novosProcessos: number;
    sucesso: number;
    erro: number;
    atualizadas: number;
    total: number;
  };
}

const PHASES: { key: ImportPhaseKey; label: string }[] = [
  { key: "preparing", label: "Preparando" },
  { key: "processos", label: "Resolvendo processos" },
  { key: "responsaveis", label: "Resolvendo responsáveis" },
  { key: "tarefas", label: "Inserindo/atualizando tarefas" },
  { key: "vinculos", label: "Vinculando responsáveis" },
];

function formatEta(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

interface Props {
  state: ImportProgressState;
  onCancel?: () => void;
  cancelling?: boolean;
}

export function ImportProgress({ state, onCancel, cancelling }: Props) {
  const { phase, phaseLabel, phaseCurrent, phaseTotal, overall, detail, startedAt, counters } = state;

  const phaseIdx = PHASES.findIndex(p => p.key === phase);
  const stepNumber = phaseIdx >= 0 ? phaseIdx + 1 : 0;
  const phasePct = phaseTotal > 0 ? Math.min(100, (phaseCurrent / phaseTotal) * 100) : (phase === "done" ? 100 : 0);

  const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const eta = overall > 1 && overall < 100 && elapsed > 1
    ? (elapsed * (100 - overall)) / overall
    : 0;
  const rate = elapsed > 0 && counters.sucesso + counters.atualizadas > 0
    ? ((counters.sucesso + counters.atualizadas) / elapsed)
    : 0;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {phase === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            <span className="font-medium">
              {phase === "done" ? "Importação concluída" : `Etapa ${stepNumber}/${PHASES.length} — ${phaseLabel}`}
            </span>
          </div>
          {detail && (
            <p className="text-xs text-muted-foreground pl-6">{detail}</p>
          )}
        </div>
        {onCancel && phase !== "done" && (
          <Button variant="destructive" size="sm" onClick={onCancel} disabled={cancelling}>
            {cancelling ? "Cancelando..." : "Cancelar"}
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Etapa atual</span>
          <span>
            {phaseTotal > 0 ? `${phaseCurrent.toLocaleString()} / ${phaseTotal.toLocaleString()}` : ""}
          </span>
        </div>
        <Progress value={phasePct} className="h-1.5" />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="font-medium">Progresso geral</span>
          <span className="text-muted-foreground">
            {Math.round(overall)}% {eta > 0 && `· ETA ${formatEta(eta)}`} {rate > 0 && `· ${rate.toFixed(1)}/s`}
          </span>
        </div>
        <Progress value={overall} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs pt-1">
        <Stat label="Total" value={counters.total} />
        <Stat label="Sucesso" value={counters.sucesso} className="text-green-600" />
        <Stat label="Atualizadas" value={counters.atualizadas} className="text-blue-600" />
        <Stat label="Erros" value={counters.erro} className="text-red-600" />
        <Stat label="Novos cadastros" value={counters.novosUsuarios + counters.novosProcessos} className="text-purple-600" />
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-md border bg-background px-2 py-1.5">
      <div className={`font-semibold ${className || ""}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}