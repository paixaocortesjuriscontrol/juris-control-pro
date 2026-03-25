import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ProcessoTstImport } from "@/hooks/usePrazosTst";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProcessoTstImport) => Promise<any>;
  coordenacaoId: string | null;
  isSaving: boolean;
}

export function TstPrazoFormDialog({ open, onClose, onSave, coordenacaoId, isSaving }: Props) {
  const [form, setForm] = useState({
    numero: "",
    dossie_tst: "",
    polo_passivo: "",
    polo_ativo: "",
    equipe_tst: "",
    decisao_tst: "",
    formulario_tst: "",
    providencias_tst: "",
    deposito_judicial_tst: "",
    preparo_tst: "",
    multa_custas_tst: "",
    responsavel_tst: "",
  });
  const [dataFatal, setDataFatal] = useState<Date>();

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!dataFatal || !coordenacaoId) return;

    await onSave({
      numero: form.numero || "SEM-NUMERO",
      coordenacao_id: coordenacaoId,
      polo_ativo: form.polo_ativo || null,
      polo_passivo: form.polo_passivo || null,
      dossie_tst: form.dossie_tst || null,
      equipe_tst: form.equipe_tst || null,
      decisao_tst: form.decisao_tst || null,
      formulario_tst: form.formulario_tst || null,
      providencias_tst: form.providencias_tst || null,
      deposito_judicial_tst: form.deposito_judicial_tst || null,
      preparo_tst: form.preparo_tst || null,
      multa_custas_tst: form.multa_custas_tst || null,
      responsavel_tst: form.responsavel_tst || null,
      data_fatal: format(dataFatal, "yyyy-MM-dd"),
      area: "trabalhista",
      status: "ativo",
    });

    setForm({
      numero: "", dossie_tst: "", polo_passivo: "", polo_ativo: "", equipe_tst: "",
      decisao_tst: "", formulario_tst: "", providencias_tst: "", deposito_judicial_tst: "",
      preparo_tst: "", multa_custas_tst: "", responsavel_tst: "",
    });
    setDataFatal(undefined);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Processo TST</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nº Processo</Label>
            <Input value={form.numero} onChange={set("numero")} placeholder="0000000-00.0000.0.00.0000" />
          </div>
          <div className="space-y-1">
            <Label>Dossiê</Label>
            <Input value={form.dossie_tst} onChange={set("dossie_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Réu</Label>
            <Input value={form.polo_passivo} onChange={set("polo_passivo")} />
          </div>
          <div className="space-y-1">
            <Label>Autor</Label>
            <Input value={form.polo_ativo} onChange={set("polo_ativo")} />
          </div>
          <div className="space-y-1">
            <Label>Equipe</Label>
            <Input value={form.equipe_tst} onChange={set("equipe_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input value={form.responsavel_tst} onChange={set("responsavel_tst")} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Decisão</Label>
            <Textarea value={form.decisao_tst} onChange={set("decisao_tst")} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Formulário</Label>
            <Input value={form.formulario_tst} onChange={set("formulario_tst")} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Providências</Label>
            <Textarea value={form.providencias_tst} onChange={set("providencias_tst")} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Depósito Judicial</Label>
            <Input value={form.deposito_judicial_tst} onChange={set("deposito_judicial_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Preparo</Label>
            <Input value={form.preparo_tst} onChange={set("preparo_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Multa/Custas</Label>
            <Input value={form.multa_custas_tst} onChange={set("multa_custas_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Data Fatal *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !dataFatal && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFatal ? format(dataFatal, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFatal} onSelect={setDataFatal} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!dataFatal || isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
