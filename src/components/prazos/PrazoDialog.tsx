import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCreatePrazo, useUpdatePrazo, type Prazo } from "@/hooks/usePrazos";
import { useProcessos } from "@/hooks/useProcessos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type PrazoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prazo?: Prazo | null;
  defaultProcessoId?: string;
};

export function PrazoDialog({
  open,
  onOpenChange,
  prazo,
  defaultProcessoId,
}: PrazoDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();
  const [prioridade, setPrioridade] = useState<string>("media");
  const [processoId, setProcessoId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const createPrazo = useCreatePrazo();
  const updatePrazo = useUpdatePrazo();
  const { data: processos } = useProcessos();

  const { data: advogados } = useQuery({
    queryKey: ["advogados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (prazo) {
      setTitulo(prazo.titulo);
      setDescricao(prazo.descricao || "");
      setDataVencimento(prazo.data_vencimento ? parseISO(prazo.data_vencimento) : undefined);
      setPrioridade(prazo.prioridade);
      setProcessoId(prazo.processo_id);
      setResponsavelId(prazo.responsavel_id || "");
      setObservacoes(prazo.observacoes || "");
    } else {
      setTitulo("");
      setDescricao("");
      setDataVencimento(undefined);
      setPrioridade("media");
      setProcessoId(defaultProcessoId || "");
      setResponsavelId("");
      setObservacoes("");
    }
  }, [prazo, open, defaultProcessoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo || !dataVencimento || !processoId) {
      return;
    }

    const prazoData = {
      titulo,
      descricao: descricao || undefined,
      data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
      prioridade: prioridade as "baixa" | "media" | "alta" | "urgente",
      processo_id: processoId,
      responsavel_id: responsavelId || undefined,
      observacoes: observacoes || undefined,
    };

    if (prazo) {
      await updatePrazo.mutateAsync({ id: prazo.id, ...prazoData });
    } else {
      await createPrazo.mutateAsync(prazoData);
    }

    onOpenChange(false);
  };

  const isLoading = createPrazo.isPending || updatePrazo.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {prazo ? "Editar Prazo" : "Novo Prazo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Contestação, Recurso, Audiência..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="processo">Processo *</Label>
            <Select value={processoId} onValueChange={setProcessoId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o processo" />
              </SelectTrigger>
              <SelectContent>
                {processos?.map((processo) => (
                  <SelectItem key={processo.id} value={processo.id}>
                    {processo.numero} - {processo.assunto || "Sem assunto"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataVencimento && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimento
                      ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataVencimento}
                    onSelect={setDataVencimento}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade *</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {advogados?.map((advogado) => (
                  <SelectItem key={advogado.id} value={advogado.id}>
                    {advogado.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva os detalhes do prazo..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {prazo ? "Salvar" : "Criar Prazo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
