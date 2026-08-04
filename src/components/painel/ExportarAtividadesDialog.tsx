import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2 } from "lucide-react";

export const EXPORT_TIPOS = [
  { value: "tarefa", label: "Tarefas" },
  { value: "evento", label: "Eventos" },
  { value: "prazo", label: "Prazos" },
  { value: "audiencia", label: "Audiências" },
  { value: "parcelamento", label: "Parcelamentos" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** tipos vazio = todos */
  onExportar: (inicio: string, fim: string, tipos: string[]) => Promise<void> | void;
}

export function ExportarAtividadesDialog({ open, onOpenChange, onExportar }: Props) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const todos = tipos.length === 0;

  const toggleTipo = (v: string) => {
    setTipos((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));
  };

  const handleExportar = async () => {
    setLoading(true);
    try {
      await onExportar(inicio, fim, tipos);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar atividades</DialogTitle>
          <DialogDescription>
            Selecione o período e os tipos que deseja exportar para Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Período
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <Label className="text-[11px] text-muted-foreground">Data inicial</Label>
                <Input
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="h-9 w-full text-sm px-2"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-[11px] text-muted-foreground">Data final</Label>
                <Input
                  type="date"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className="h-9 w-full text-sm px-2"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Deixe em branco para exportar todas as datas.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tipos
            </p>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-1.5">
              <Checkbox checked={todos} onCheckedChange={() => setTipos([])} />
              Todos
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {EXPORT_TIPOS.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={tipos.includes(t.value)}
                    onCheckedChange={() => toggleTipo(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExportar} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
