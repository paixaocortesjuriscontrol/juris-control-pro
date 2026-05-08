import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsaveisSelector } from "./ResponsaveisSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void | Promise<void>;
}

export function DelegarProcessosDialog({ open, onOpenChange, selectedIds, onSuccess }: Props) {
  const [advogadoIds, setAdvogadoIds] = useState<string[]>([]);
  const [prazo, setPrazo] = useState<Date | undefined>();
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setAdvogadoIds([]); setPrazo(undefined); setObservacao(""); };

  const handleSave = async () => {
    if (advogadoIds.length === 0) { toast.warning("Selecione ao menos um advogado"); return; }
    if (!prazo) { toast.warning("Defina o prazo de entrega"); return; }
    if (selectedIds.length === 0) { toast.warning("Nenhum processo selecionado"); return; }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      const prazoStr = format(prazo, "yyyy-MM-dd");
      const nowIso = new Date().toISOString();
      const BATCH = 200;

      // Update dados_benner em batches
      for (let i = 0; i < selectedIds.length; i += BATCH) {
        const batch = selectedIds.slice(i, i + BATCH);
        const { error } = await supabase
          .from("dados_benner" as any)
          .update({
            distribuido_em: nowIso,
            distribuido_por: uid,
            prazo_entrega: prazoStr,
            status_distribuicao: "pendente",
            observacao_distribuicao: observacao || null,
          } as any)
          .in("id", batch);
        if (error) throw error;
      }

      // Inserir vínculos N:N (sem apagar existentes)
      const rows: { dados_benner_id: string; usuario_id: string }[] = [];
      for (const id of selectedIds) {
        for (const uidAdv of advogadoIds) {
          rows.push({ dados_benner_id: id, usuario_id: uidAdv });
        }
      }
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        // ignora conflitos de chave única (par já existente)
        const { error } = await supabase
          .from("dados_benner_responsaveis" as any)
          .upsert(batch as any, { onConflict: "dados_benner_id,usuario_id", ignoreDuplicates: true } as any);
        if (error) throw error;
      }

      await onSuccess();
      toast.success(`${selectedIds.length} processo(s) delegado(s) a ${advogadoIds.length} advogado(s)`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao delegar: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Delegar processos
          </DialogTitle>
          <DialogDescription>
            {selectedIds.length} processo(s) selecionado(s). O prazo de entrega será o mesmo para todos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Advogados responsáveis *</Label>
            <ResponsaveisSelector
              selectedIds={advogadoIds}
              onChange={setAdvogadoIds}
              placeholder="Selecione os advogados..."
              coordenacaoId="3e47fc83-3539-4fa7-9fcf-33825120e1b7"
            />
            <p className="text-xs text-muted-foreground">Os vínculos são adicionados (não substituem os existentes).</p>
          </div>

          <div className="space-y-2">
            <Label>Prazo de entrega *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !prazo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {prazo ? format(prazo, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={prazo}
                  onSelect={setPrazo}
                  initialFocus
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Instruções para os advogados..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delegar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}