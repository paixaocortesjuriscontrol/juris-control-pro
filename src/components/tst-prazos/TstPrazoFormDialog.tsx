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
import { supabase } from "@/integrations/supabase/client";
import { PrazoTstInsert } from "@/hooks/usePrazosTst";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (prazo: PrazoTstInsert) => Promise<any>;
  coordenacaoId: string | null;
  isSaving: boolean;
}

export function TstPrazoFormDialog({ open, onClose, onSave, coordenacaoId, isSaving }: Props) {
  const [form, setForm] = useState({
    numero_processo: "",
    dossie: "",
    reu: "",
    autor: "",
    equipe: "",
    decisao: "",
    formulario: "",
    providencias: "",
    deposito_judicial: "",
    preparo: "",
    multa_custas: "",
    responsavel: "",
  });
  const [dataFatal, setDataFatal] = useState<Date>();

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!dataFatal) return;

    // Try to match processo
    let processoId: string | null = null;
    if (form.numero_processo.trim()) {
      const digits = form.numero_processo.replace(/\D/g, "");
      if (digits.length >= 10) {
        const { data } = await supabase
          .from("processos")
          .select("id")
          .ilike("numero", `%${digits}%`)
          .limit(1);
        if (data?.[0]) processoId = data[0].id;
      }
    }

    await onSave({
      ...form,
      coordenacao_id: coordenacaoId,
      processo_id: processoId,
      data_fatal: format(dataFatal, "yyyy-MM-dd"),
    });

    setForm({
      numero_processo: "", dossie: "", reu: "", autor: "", equipe: "",
      decisao: "", formulario: "", providencias: "", deposito_judicial: "",
      preparo: "", multa_custas: "", responsavel: "",
    });
    setDataFatal(undefined);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Prazo TST</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nº Processo</Label>
            <Input value={form.numero_processo} onChange={set("numero_processo")} placeholder="0000000-00.0000.0.00.0000" />
          </div>
          <div className="space-y-1">
            <Label>Dossiê</Label>
            <Input value={form.dossie} onChange={set("dossie")} />
          </div>
          <div className="space-y-1">
            <Label>Réu</Label>
            <Input value={form.reu} onChange={set("reu")} />
          </div>
          <div className="space-y-1">
            <Label>Autor</Label>
            <Input value={form.autor} onChange={set("autor")} />
          </div>
          <div className="space-y-1">
            <Label>Equipe</Label>
            <Input value={form.equipe} onChange={set("equipe")} />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={set("responsavel")} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Decisão</Label>
            <Textarea value={form.decisao} onChange={set("decisao")} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Formulário</Label>
            <Input value={form.formulario} onChange={set("formulario")} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Providências</Label>
            <Textarea value={form.providencias} onChange={set("providencias")} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Depósito Judicial</Label>
            <Input value={form.deposito_judicial} onChange={set("deposito_judicial")} />
          </div>
          <div className="space-y-1">
            <Label>Preparo</Label>
            <Input value={form.preparo} onChange={set("preparo")} />
          </div>
          <div className="space-y-1">
            <Label>Multa/Custas</Label>
            <Input value={form.multa_custas} onChange={set("multa_custas")} />
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
