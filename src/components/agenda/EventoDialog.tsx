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
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateEvento, useUpdateEvento, EventoAgenda } from "@/hooks/useEventosAgenda";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: EventoAgenda | null;
}

const TIPOS_EVENTO = [
  { value: "evento", label: "Evento" },
  { value: "tarefa", label: "Tarefa" },
  { value: "prazo", label: "Prazo" },
  { value: "audiencia", label: "Audiência" },
];

const RECORRENCIA_TIPOS = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
];

const ALERTAS_OPCOES = [
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
];

export function EventoDialog({ open, onOpenChange, evento }: EventoDialogProps) {
  const createEvento = useCreateEvento();
  const updateEvento = useUpdateEvento();
  const isEditing = !!evento;

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "evento",
    data_inicio: "",
    hora_inicio: "",
    data_fim: "",
    hora_fim: "",
    dia_inteiro: false,
    local: "",
    recorrente: false,
    recorrencia_tipo: "",
    recorrencia_intervalo: 1,
    recorrencia_fim: "",
    processo_id: "",
    participantes_ids: [] as string[],
    alerta_minutos: [30] as number[],
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (evento) {
      const dataInicio = new Date(evento.data_inicio);
      const dataFim = evento.data_fim ? new Date(evento.data_fim) : null;
      
      setFormData({
        titulo: evento.titulo,
        descricao: evento.descricao || "",
        tipo: evento.tipo,
        data_inicio: format(dataInicio, "yyyy-MM-dd"),
        hora_inicio: format(dataInicio, "HH:mm"),
        data_fim: dataFim ? format(dataFim, "yyyy-MM-dd") : "",
        hora_fim: dataFim ? format(dataFim, "HH:mm") : "",
        dia_inteiro: evento.dia_inteiro || false,
        local: evento.local || "",
        recorrente: evento.recorrente || false,
        recorrencia_tipo: evento.recorrencia_tipo || "",
        recorrencia_intervalo: evento.recorrencia_intervalo || 1,
        recorrencia_fim: evento.recorrencia_fim || "",
        processo_id: evento.processo_id || "",
        participantes_ids: evento.participantes?.map(p => p.usuario_id) || [],
        alerta_minutos: [30],
      });
    } else {
      setFormData({
        titulo: "",
        descricao: "",
        tipo: "evento",
        data_inicio: format(new Date(), "yyyy-MM-dd"),
        hora_inicio: format(new Date(), "HH:mm"),
        data_fim: "",
        hora_fim: "",
        dia_inteiro: false,
        local: "",
        recorrente: false,
        recorrencia_tipo: "",
        recorrencia_intervalo: 1,
        recorrencia_fim: "",
        processo_id: "",
        participantes_ids: [],
        alerta_minutos: [30],
      });
    }
  }, [evento, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dataInicio = formData.dia_inteiro
      ? `${formData.data_inicio}T00:00:00`
      : `${formData.data_inicio}T${formData.hora_inicio}:00`;

    const dataFim = formData.data_fim
      ? formData.dia_inteiro
        ? `${formData.data_fim}T23:59:59`
        : `${formData.data_fim}T${formData.hora_fim || formData.hora_inicio}:00`
      : undefined;

    const eventoData = {
      titulo: formData.titulo,
      descricao: formData.descricao || undefined,
      tipo: formData.tipo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dia_inteiro: formData.dia_inteiro,
      local: formData.local || undefined,
      recorrente: formData.recorrente,
      recorrencia_tipo: formData.recorrente ? formData.recorrencia_tipo : undefined,
      recorrencia_intervalo: formData.recorrente ? formData.recorrencia_intervalo : undefined,
      recorrencia_fim: formData.recorrente && formData.recorrencia_fim ? formData.recorrencia_fim : undefined,
      processo_id: formData.processo_id || undefined,
      participantes_ids: formData.participantes_ids,
      alerta_minutos: formData.alerta_minutos,
    };

    if (isEditing && evento) {
      await updateEvento.mutateAsync({ id: evento.id, ...eventoData });
    } else {
      await createEvento.mutateAsync(eventoData);
    }
    
    onOpenChange(false);
  };

  const toggleParticipante = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      participantes_ids: prev.participantes_ids.includes(userId)
        ? prev.participantes_ids.filter(id => id !== userId)
        : [...prev.participantes_ids, userId],
    }));
  };

  const toggleAlerta = (minutos: number) => {
    setFormData(prev => ({
      ...prev,
      alerta_minutos: prev.alerta_minutos.includes(minutos)
        ? prev.alerta_minutos.filter(m => m !== minutos)
        : [...prev.alerta_minutos, minutos],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Evento" : "Novo Evento"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_EVENTO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="dia_inteiro"
                  checked={formData.dia_inteiro}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, dia_inteiro: checked as boolean })
                  }
                />
                <Label htmlFor="dia_inteiro" className="cursor-pointer">Dia inteiro</Label>
              </div>

              <div>
                <Label htmlFor="data_inicio">Data Início *</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  required
                />
              </div>

              {!formData.dia_inteiro && (
                <div>
                  <Label htmlFor="hora_inicio">Hora Início</Label>
                  <Input
                    id="hora_inicio"
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="data_fim">Data Fim</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                />
              </div>

              {!formData.dia_inteiro && (
                <div>
                  <Label htmlFor="hora_fim">Hora Fim</Label>
                  <Input
                    id="hora_fim"
                    type="time"
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                  />
                </div>
              )}

              <div className="col-span-2">
                <Label htmlFor="local">Local</Label>
                <Input
                  id="local"
                  value={formData.local}
                  onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                  placeholder="Local do evento"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Recorrência */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="recorrente"
                  checked={formData.recorrente}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, recorrente: checked as boolean })
                  }
                />
                <Label htmlFor="recorrente" className="cursor-pointer font-medium">
                  Evento Recorrente
                </Label>
              </div>

              {formData.recorrente && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Frequência</Label>
                    <Select
                      value={formData.recorrencia_tipo}
                      onValueChange={(value) => setFormData({ ...formData, recorrencia_tipo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECORRENCIA_TIPOS.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Intervalo</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.recorrencia_intervalo}
                      onChange={(e) =>
                        setFormData({ ...formData, recorrencia_intervalo: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>

                  <div>
                    <Label>Até</Label>
                    <Input
                      type="date"
                      value={formData.recorrencia_fim}
                      onChange={(e) => setFormData({ ...formData, recorrencia_fim: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Participantes */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="font-medium">Participantes</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {usuarios?.map((usuario) => (
                  <div key={usuario.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`user-${usuario.id}`}
                      checked={formData.participantes_ids.includes(usuario.id)}
                      onCheckedChange={() => toggleParticipante(usuario.id)}
                    />
                    <Label htmlFor={`user-${usuario.id}`} className="cursor-pointer text-sm">
                      {usuario.nome}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertas */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="font-medium">Alertas/Lembretes</Label>
              <div className="flex flex-wrap gap-3">
                {ALERTAS_OPCOES.map((opcao) => (
                  <div key={opcao.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`alerta-${opcao.value}`}
                      checked={formData.alerta_minutos.includes(opcao.value)}
                      onCheckedChange={() => toggleAlerta(opcao.value)}
                    />
                    <Label htmlFor={`alerta-${opcao.value}`} className="cursor-pointer text-sm">
                      {opcao.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createEvento.isPending || updateEvento.isPending}
              >
                {isEditing ? "Salvar" : "Criar Evento"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
