import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  analisarCandidatosAjusteChance,
  aplicarAjusteChance,
  type CandidatoAjuste,
  type ProgressoAjuste,
} from "@/lib/ajustarChanceReclamanteTst";
import { gerarRelatorioAjusteChance } from "@/lib/relatorioAjusteChanceTst";

export function AjustarChanceDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressoAjuste | null>(null);
  const [candidatos, setCandidatos] = useState<CandidatoAjuste[] | null>(null);
  const [resumo, setResumo] = useState<{ analisados: number; prontos: number; materias: number } | null>(null);
  const cancelRef = useRef(false);

  function reset() {
    setProgress(null);
    setCandidatos(null);
    setResumo(null);
    cancelRef.current = false;
  }

  async function analisar() {
    setRunning(true);
    cancelRef.current = false;
    setCandidatos(null);
    setResumo(null);
    try {
      const { candidatos, analisados, prontos } = await analisarCandidatosAjusteChance({
        onProgress: setProgress,
        isCancelled: () => cancelRef.current,
      });
      if (cancelRef.current) {
        toast.info("Análise cancelada.");
        return;
      }
      const materias = candidatos.reduce((acc, c) => acc + c.linhas.length, 0);
      setCandidatos(candidatos);
      setResumo({ analisados, prontos, materias });
      if (candidatos.length === 0) {
        toast.info("Nenhum processo elegível para ajuste.");
      }
    } catch (e: any) {
      toast.error("Erro ao analisar: " + (e?.message || String(e)));
    } finally {
      setProgress(null);
      setRunning(false);
    }
  }

  async function aplicar() {
    if (!candidatos || candidatos.length === 0) return;
    setRunning(true);
    cancelRef.current = false;
    try {
      const { atualizados, erros } = await aplicarAjusteChance(candidatos, {
        onProgress: setProgress,
        isCancelled: () => cancelRef.current,
      });

      if (atualizados.length > 0) {
        const { blob, filename } = gerarRelatorioAjusteChance(atualizados);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      await queryClient.invalidateQueries({ queryKey: ["distribuicoes-tst"] });
      await queryClient.invalidateQueries({ queryKey: ["dados-benner"] });

      const processosOk = new Set(atualizados.map((l) => l.id)).size;
      if (erros.length > 0) {
        toast.warning(`${processosOk} processo(s) ajustado(s), ${erros.length} com erro.`);
      } else if (cancelRef.current) {
        toast.info(`Cancelado. ${processosOk} processo(s) já ajustado(s).`);
      } else {
        toast.success(`${processosOk} processo(s) e ${atualizados.length} matéria(s) ajustados.`);
      }
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error("Erro ao aplicar ajuste: " + (e?.message || String(e)));
    } finally {
      setProgress(null);
      setRunning(false);
    }
  }

  const pct = progress && progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <>
      <Button
        variant="outline"
        className="border-rose-400 text-rose-700 hover:bg-rose-50"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        title="Nos processos prontos para enviar distribuídos de 2026 em diante, troca Chance Turma/Relator FAVORÁVEL por DESFAVORÁVEL quando o recurso do reclamante tem chance de êxito SIM."
      >
        <Wand2 className="w-4 h-4 mr-2" />
        Ajustar Chance Turma/Relator (2026+)
      </Button>

      <Dialog open={open} onOpenChange={(o) => !running && (o ? setOpen(true) : (reset(), setOpen(false)))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajustar Chance Turma / Relator (2026+)</DialogTitle>
            <DialogDescription>
              Somente processos <strong>prontos para enviar</strong> (sem pendências) com
              distribuição a partir de 01/01/2026, com Recurso do Reclamante preenchido e
              "Tem chance de êxito" = SIM. Nas matérias da análise do reclamante, Chance Turma
              e Chance Relator marcadas como FAVORÁVEL passam a DESFAVORÁVEL. Ao final é
              baixado o relatório Excel dos alterados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {progress && (
              <div className="space-y-1">
                <Progress value={progress.fase === "analisando" ? undefined : pct} />
                <p className="text-xs text-muted-foreground text-center">
                  {progress.fase === "analisando"
                    ? `Analisando registros... (${progress.current})`
                    : `Gravando ${progress.current} / ${progress.total}${progress.atual ? ` — ${progress.atual}` : ""}`}
                </p>
              </div>
            )}

            {resumo && candidatos && (
              <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                <p>Prontos para enviar analisados: <strong>{resumo.prontos}</strong></p>
                <p>Processos a alterar: <strong>{candidatos.length}</strong></p>
                <p>Matérias a alterar: <strong>{resumo.materias}</strong></p>
              </div>
            )}
          </div>

          <DialogFooter>
            {running ? (
              <Button variant="outline" onClick={() => (cancelRef.current = true)}>
                Cancelar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>
                  Fechar
                </Button>
                {!candidatos ? (
                  <Button onClick={analisar}>
                    <Wand2 className="w-4 h-4 mr-2" /> Analisar
                  </Button>
                ) : (
                  <Button onClick={aplicar} disabled={candidatos.length === 0}>
                    {running && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    Aplicar e gerar relatório
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}