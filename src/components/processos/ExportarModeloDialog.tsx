import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { EscopoExportacao } from "@/lib/exportProcessosModelosData";
import { exportarExcelMonitoramento } from "@/lib/exportMonitoramentoExcel";
import { exportarExcelCadastroLote } from "@/lib/exportCadastroLoteExcel";
import type { ProcessosPaginadosFilters } from "@/hooks/useProcessosPaginados";

export type ModeloExportacao = "monitoramento" | "cadastro-lote";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelo: ModeloExportacao;
  filtros: ProcessosPaginadosFilters;
  selecionados: string[];
}

const titulos: Record<ModeloExportacao, string> = {
  monitoramento: "Exportar Excel — Monitoramento",
  "cadastro-lote": "Exportar Excel — Cadastro de Processo em Lote",
};

const descricoes: Record<ModeloExportacao, string> = {
  monitoramento:
    "Uma linha por andamento (Nº do Processo, Órgão, Cliente, Data, Descrição, Responsáveis, Lido, Habilitado).",
  "cadastro-lote":
    "Uma linha por processo no layout padrão de importação em lote (38 colunas).",
};

export function ExportarModeloDialog({
  open,
  onOpenChange,
  modelo,
  filtros,
  selecionados,
}: Props) {
  const [escopo, setEscopo] = useState<EscopoExportacao>("filtros");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [gerando, setGerando] = useState(false);

  const handleExportar = async () => {
    if (escopo === "selecionados" && selecionados.length === 0) {
      toast.error("Nenhum processo selecionado.");
      return;
    }
    setGerando(true);
    const toastId = toast.loading("Preparando exportação...");
    try {
      const base = { escopo, filtros, selecionados };
      const onProgress = (mensagem: string) => toast.loading(mensagem, { id: toastId });

      const total =
        modelo === "monitoramento"
          ? await exportarExcelMonitoramento({
              ...base,
              inicio: inicio || null,
              fim: fim || null,
              onProgress,
            })
          : await exportarExcelCadastroLote({ ...base, onProgress });

      if (total === 0) {
        toast.error("Nenhuma linha encontrada para os critérios escolhidos.", { id: toastId });
      } else {
        toast.success(`${total} linha(s) exportada(s)!`, { id: toastId });
        onOpenChange(false);
      }
    } catch (e: any) {
      console.error("Erro ao exportar modelo:", e);
      toast.error(`Erro ao exportar: ${e?.message || e}`, { id: toastId });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulos[modelo]}</DialogTitle>
          <DialogDescription>{descricoes[modelo]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Escopo</Label>
            <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as EscopoExportacao)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="filtros" id="escopo-filtros" />
                <Label htmlFor="escopo-filtros" className="font-normal">
                  Processos dos filtros atuais
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="selecionados" id="escopo-selecionados" />
                <Label htmlFor="escopo-selecionados" className="font-normal">
                  Somente selecionados ({selecionados.length})
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="tudo" id="escopo-tudo" />
                <Label htmlFor="escopo-tudo" className="font-normal">
                  Todos os processos (ignorar filtros)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {modelo === "monitoramento" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mov-inicio">Andamentos de</Label>
                <Input
                  id="mov-inicio"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mov-fim">até</Label>
                <Input
                  id="mov-fim"
                  type="date"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Deixe as datas em branco para exportar todos os andamentos.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gerando}>
            Cancelar
          </Button>
          <Button onClick={handleExportar} disabled={gerando}>
            {gerando ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {gerando ? "Gerando..." : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
