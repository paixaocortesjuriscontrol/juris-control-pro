import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2 } from "lucide-react";

export const EXPORT_TIPOS = [
  { value: "tarefa", label: "Tarefas" },
  { value: "ata", label: "Atas" },
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

const hojeBrt = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

type Modo = "hoje" | "periodo" | "todas";

export function ExportarAtividadesDialog({ open, onOpenChange, onExportar }: Props) {
  const [modo, setModo] = useState<Modo>("hoje");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const todos = tipos.length === 0;
  const periodoInvalido = modo === "periodo" && (!inicio || !fim || inicio > fim);

  const toggleTipo = (v: string) => {
    setTipos((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));
  };

  const handleExportar = async () => {
    const h = hojeBrt();
    const [ini, fi] = modo === "hoje" ? [h, h] : modo === "periodo" ? [inicio, fim] : ["", ""];
    setLoading(true);
    try {
      await onExportar(ini, fi, tipos);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const ModoBtn = ({ v, label }: { v: Modo; label: string }) => (
    <Button type="button" size="sm" variant={modo === v ? "default" : "outline"} onClick={() => setModo(v)} className="flex-1">
      {label}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Relatório de atividades (Excel)</SheetTitle>
          <SheetDescription>
            Escolha a data e os tipos. O relatório segue os filtros do painel e traz um resumo por tipo e situação.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 flex-1 overflow-y-auto py-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data</p>
            <div className="flex gap-2">
              <ModoBtn v="hoje" label="Hoje" />
              <ModoBtn v="periodo" label="Período" />
              <ModoBtn v="todas" label="Todas" />
            </div>
            {modo === "periodo" && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="min-w-0">
                  <Label className="text-[11px] text-muted-foreground">De</Label>
                  <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 w-full text-sm px-2" />
                </div>
                <div className="min-w-0">
                  <Label className="text-[11px] text-muted-foreground">Até</Label>
                  <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 w-full text-sm px-2" />
                </div>
                {inicio && fim && inicio > fim && (
                  <p className="col-span-2 text-xs text-destructive">A data inicial é depois da final.</p>
                )}
              </div>
            )}
            {modo === "todas" && (
              <p className="text-[11px] text-muted-foreground mt-2">Exporta todas as datas (pode demorar).</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tipos</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-1.5">
              <Checkbox checked={todos} onCheckedChange={() => setTipos([])} />
              Todos os tipos
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {EXPORT_TIPOS.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tipos.includes(t.value)} onCheckedChange={() => toggleTipo(t.value)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExportar} disabled={loading || periodoInvalido} className="gap-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Gerar Excel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
