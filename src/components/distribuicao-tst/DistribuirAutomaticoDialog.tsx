import { useEffect, useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsaveisSelector } from "./ResponsaveisSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  fetchAllDistribuicaoTstIds,
  type DistribuicaoTstFilters,
} from "@/hooks/useDistribuicoesTst";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DistribuicaoTstFilters;
  totalCount: number;
  /** IDs marcados na tela (checkboxes). Permite distribuir só a seleção. */
  selectedIds?: string[];
  /** Somente administradores podem restringir à seleção. */
  isAdmin?: boolean;
  onSuccess: () => void | Promise<void>;
}

export function DistribuirAutomaticoDialog({ open, onOpenChange, filters, totalCount, selectedIds = [], isAdmin = false, onSuccess }: Props) {
  const [advogadoIds, setAdvogadoIds] = useState<string[]>([]);
  const [substituir, setSubstituir] = useState(true);
  const [embaralhar, setEmbaralhar] = useState(true);
  const [somenteSelecionados, setSomenteSelecionados] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const podeRestringir = isAdmin && selectedIds.length > 0;
  const usarSelecao = podeRestringir && somenteSelecionados;

  useEffect(() => {
    if (!open) {
      setAdvogadoIds([]);
      setSubstituir(true);
      setEmbaralhar(true);
      setSomenteSelecionados(true);
      setProgress({ done: 0, total: 0 });
    }
  }, [open]);

  const handleRun = async () => {
    if (advogadoIds.length === 0) {
      toast.warning("Selecione ao menos um advogado");
      return;
    }
    setRunning(true);
    try {
      let ids: string[];
      if (usarSelecao) {
        ids = [...selectedIds];
      } else {
        toast.info("Carregando processos do filtro...");
        ids = await fetchAllDistribuicaoTstIds(filters);
      }
      if (ids.length === 0) {
        toast.warning(usarSelecao ? "Nenhum processo selecionado" : "Nenhum processo encontrado com os filtros atuais");
        setRunning(false);
        return;
      }
      if (embaralhar) {
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
      }

      // Round-robin: cada processo recebe UM advogado
      const buckets: Record<string, string[]> = {};
      for (const uid of advogadoIds) buckets[uid] = [];
      ids.forEach((id, i) => {
        const uid = advogadoIds[i % advogadoIds.length];
        buckets[uid].push(id);
      });

      setProgress({ done: 0, total: ids.length });

      // Substitui vínculos existentes (delete em batches por id)
      if (substituir) {
        for (let i = 0; i < ids.length; i += 200) {
          const batch = ids.slice(i, i + 200);
          const { error } = await supabase
            .from("dados_benner_responsaveis" as any)
            .delete()
            .in("dados_benner_id", batch);
          if (error) throw error;
        }
      }

      // Insere novos vínculos
      const rows: { dados_benner_id: string; usuario_id: string }[] = [];
      for (const [uid, list] of Object.entries(buckets)) {
        for (const id of list) rows.push({ dados_benner_id: id, usuario_id: uid });
      }
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase
          .from("dados_benner_responsaveis" as any)
          .upsert(batch as any, {
            onConflict: "dados_benner_id,usuario_id",
            ignoreDuplicates: true,
          } as any);
        if (error) throw error;
        inserted += batch.length;
        setProgress({ done: Math.min(inserted, ids.length), total: ids.length });
      }

      const resumo = Object.entries(buckets)
        .map(([, list]) => list.length)
        .join(" / ");
      toast.success(
        `${ids.length} processo(s) distribuído(s) entre ${advogadoIds.length} advogado(s) (${resumo})`
      );
      await onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro na distribuição automática: " + (e?.message || "desconhecido"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!running) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="w-5 h-5" /> Distribuição automática
          </DialogTitle>
          <DialogDescription>
            Os processos que batem com os filtros atuais serão divididos igualmente
            (round-robin) entre os advogados selecionados.
            {totalCount > 0 && (
              <span className="block mt-1 font-medium text-foreground">
                {totalCount} processo(s) no filtro atual.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Advogados *</Label>
            <ResponsaveisSelector
              selectedIds={advogadoIds}
              onChange={setAdvogadoIds}
              placeholder="Selecione os advogados..."
              coordenacaoId="3e47fc83-3539-4fa7-9fcf-33825120e1b7"
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="substituir"
              checked={substituir}
              onCheckedChange={(v) => setSubstituir(!!v)}
            />
            <div className="space-y-1">
              <Label htmlFor="substituir" className="cursor-pointer">Substituir responsáveis existentes</Label>
              <p className="text-xs text-muted-foreground">
                Quando marcado, remove vínculos atuais antes de redistribuir. Desmarque
                para apenas adicionar novos vínculos.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="embaralhar"
              checked={embaralhar}
              onCheckedChange={(v) => setEmbaralhar(!!v)}
            />
            <div className="space-y-1">
              <Label htmlFor="embaralhar" className="cursor-pointer">Embaralhar antes de dividir</Label>
              <p className="text-xs text-muted-foreground">
                Evita que cada advogado receba apenas processos consecutivos da listagem.
              </p>
            </div>
          </div>

          {running && progress.total > 0 && (
            <p className="text-sm text-muted-foreground">
              Atribuindo... {progress.done}/{progress.total}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancelar
          </Button>
          <Button onClick={handleRun} disabled={running || advogadoIds.length === 0}>
            {running && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Distribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}