import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import type { ProjurisUploadState } from "@/hooks/useProjurisUploadProgress";

const duration = (seconds: number) => seconds < 60 ? `${Math.ceil(seconds)} s` : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;

export function ProjurisAnexosProgress({ state, paused = false, running = true }: { state: ProjurisUploadState; paused?: boolean; running?: boolean }) {
  const elapsed = Math.max(1, (Date.now() - state.startedAt) / 1000);
  const rate = state.completed / elapsed;
  const eta = !paused && rate > 0 && state.completed < state.total ? (state.total - state.completed) / rate : 0;
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4" role="status" aria-label="Progresso dos anexos">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">{running && !paused && <Loader2 className="h-4 w-4 animate-spin text-primary" />}{paused ? "Pausado — aguardando continuar" : state.phase}</span>
        <span className="font-semibold tabular-nums">{state.percent.toFixed(1)}%</span>
      </div>
      <Progress value={state.percent} aria-label="Anexos processados" />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{state.completed.toLocaleString("pt-BR")} / {state.total.toLocaleString("pt-BR")} arquivos processados</span>
        <span>{duration(elapsed)}{eta > 0 ? ` · Restante estimado: ${duration(eta)}` : ""} · {(state.bytes / 1048576).toFixed(1)} MB enviados</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[["Enviados", state.uploaded], ["Vinculados sem reenviar", state.linked], ["Pulados", state.skipped], ["Erros", state.errors]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{Number(value).toLocaleString("pt-BR")}</dd></div>)}
      </dl>
      {state.active.map((file, index) => <div key={index} className="space-y-1 text-xs"><div className="flex min-w-0 justify-between gap-3"><span className="min-w-0 break-all">{file.name}</span><span className="shrink-0 text-muted-foreground">{file.stage}</span></div><Progress value={file.percent} className="h-1" aria-label={`Envio de ${file.name}`} /></div>)}
    </div>
  );
}