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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Search, X, UserPlus } from "lucide-react";
import { useCreateEvento, useUpdateEvento, EventoAgenda } from "@/hooks/useEventosAgenda";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { PeoplePicker } from "@/components/shared/PeoplePicker";

interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: EventoAgenda | null;
  defaultProcessoId?: string;
}

type AlertaUnidade = "minutos" | "horas" | "dias" | "semanas";

const UNIDADES_ALERTA: { value: AlertaUnidade; label: string; multiplicador: number }[] = [
  { value: "minutos", label: "Minuto(s) antes", multiplicador: 1 },
  { value: "horas", label: "Hora(s) antes", multiplicador: 60 },
  { value: "dias", label: "Dia(s) antes", multiplicador: 60 * 24 },
  { value: "semanas", label: "Semana(s) antes", multiplicador: 60 * 24 * 7 },
];

const MODALIDADES = [
  { value: "presencial", label: "Presencial" },
  { value: "virtual", label: "Virtual" },
  { value: "hibrido", label: "Híbrido" },
];

function minutosParaUnidade(min: number): { valor: number; unidade: AlertaUnidade } {
  if (!min) return { valor: 0, unidade: "horas" };
  if (min % (60 * 24 * 7) === 0) return { valor: min / (60 * 24 * 7), unidade: "semanas" };
  if (min % (60 * 24) === 0) return { valor: min / (60 * 24), unidade: "dias" };
  if (min % 60 === 0) return { valor: min / 60, unidade: "horas" };
  return { valor: min, unidade: "minutos" };
}

export function EventoDialog({ open, onOpenChange, evento, defaultProcessoId }: EventoDialogProps) {
  const createEvento = useCreateEvento();
  const updateEvento = useUpdateEvento();
  const isEditing = !!evento;

  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [local, setLocal] = useState("");
  const [modalidade, setModalidade] = useState<string>("");
  const [alertaValor, setAlertaValor] = useState<number>(0);
  const [alertaUnidade, setAlertaUnidade] = useState<AlertaUnidade>("horas");
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const [mostrarEnvolvidos, setMostrarEnvolvidos] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const [processoId, setProcessoId] = useState("");
  const [processoSearch, setProcessoSearch] = useState("");

  const { data: processos } = useQuery({
    queryKey: ["processos-evento-dialog", processoSearch],
    queryFn: async () => {
      let query = supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo")
        .order("numero")
        .limit(20);
      if (processoSearch) {
        query = query.or(
          `numero.ilike.%${processoSearch}%,polo_ativo.ilike.%${processoSearch}%,polo_passivo.ilike.%${processoSearch}%`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !processoId,
  });

  const { data: processoSelecionado } = useQuery({
    queryKey: ["processo-selecionado-evento", processoId],
    queryFn: async () => {
      if (!processoId) return null;
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo")
        .eq("id", processoId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!processoId,
  });

  // Carregar alertas existentes
  const { data: alertasEvento } = useQuery({
    queryKey: ["alertas-evento", evento?.id],
    queryFn: async () => {
      if (!evento?.id) return [];
      const { data, error } = await supabase
        .from("alertas_evento")
        .select("minutos_antes")
        .eq("evento_id", evento.id);
      if (error) throw error;
      return data?.map((a) => a.minutos_antes) || [];
    },
    enabled: !!evento?.id && open,
  });

  useEffect(() => {
    if (!open) return;
    if (evento) {
      const di = toZonedTime(new Date(evento.data_inicio), "America/Sao_Paulo");
      const df = evento.data_fim ? toZonedTime(new Date(evento.data_fim), "America/Sao_Paulo") : null;
      setTitulo(evento.titulo);
      setDataInicio(format(di, "yyyy-MM-dd"));
      setHoraInicio(format(di, "HH:mm"));
      setDataFim(df ? format(df, "yyyy-MM-dd") : format(di, "yyyy-MM-dd"));
      setHoraFim(df ? format(df, "HH:mm") : "");
      setDiaInteiro(evento.dia_inteiro || false);
      setLocal(evento.local || "");
      setModalidade((evento as any).modalidade || "");
      setObservacoes(evento.descricao || "");
      setProcessoId(evento.processo_id || "");

      const min = alertasEvento && alertasEvento.length > 0 ? alertasEvento[0] : 0;
      const { valor, unidade } = minutosParaUnidade(min);
      setAlertaValor(valor);
      setAlertaUnidade(unidade);

      // Carregar responsáveis e envolvidos
      (async () => {
        const { data: resps } = await supabase
          .from("evento_responsaveis")
          .select("usuario_id")
          .eq("evento_id", evento.id);
        setResponsaveisIds((resps || []).map((r: any) => r.usuario_id));

        const { data: envs } = await supabase
          .from("evento_envolvidos")
          .select("usuario_id")
          .eq("evento_id", evento.id);
        const envIds = (envs || []).map((e: any) => e.usuario_id);
        setEnvolvidosIds(envIds);
        if (envIds.length > 0) setMostrarEnvolvidos(true);
      })();
    } else {
      const hoje = format(new Date(), "yyyy-MM-dd");
      setTitulo("");
      setDataInicio(hoje);
      setHoraInicio("09:00");
      setDataFim(hoje);
      setHoraFim("10:00");
      setDiaInteiro(false);
      setLocal("");
      setModalidade("");
      setObservacoes("");
      setProcessoId(defaultProcessoId || "");
      setAlertaValor(0);
      setAlertaUnidade("horas");
      setResponsaveisIds([]);
      setEnvolvidosIds([]);
      setMostrarEnvolvidos(false);
    }
  }, [evento, open, alertasEvento, defaultProcessoId]);

  const persistirRelacionamentos = async (eventoId: string) => {
    await supabase.from("evento_responsaveis").delete().eq("evento_id", eventoId);
    if (responsaveisIds.length > 0) {
      await supabase.from("evento_responsaveis").insert(
        responsaveisIds.map((uid) => ({ evento_id: eventoId, usuario_id: uid }))
      );
    }
    await supabase.from("evento_envolvidos").delete().eq("evento_id", eventoId);
    if (envolvidosIds.length > 0) {
      await supabase.from("evento_envolvidos").insert(
        envolvidosIds.map((uid) => ({ evento_id: eventoId, usuario_id: uid }))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    const inicioISO = diaInteiro
      ? `${dataInicio}T00:00:00-03:00`
      : `${dataInicio}T${horaInicio || "09:00"}:00-03:00`;
    const fimISO = diaInteiro
      ? `${dataFim || dataInicio}T23:59:59-03:00`
      : `${dataFim || dataInicio}T${horaFim || horaInicio || "10:00"}:00-03:00`;

    const unidadeInfo = UNIDADES_ALERTA.find((u) => u.value === alertaUnidade)!;
    const minutosAlerta = (alertaValor || 0) * unidadeInfo.multiplicador;
    const alertas = minutosAlerta > 0 ? [minutosAlerta] : [];

    const payload = {
      titulo: titulo.trim(),
      descricao: observacoes || undefined,
      tipo: "evento",
      data_inicio: inicioISO,
      data_fim: fimISO,
      dia_inteiro: diaInteiro,
      local: local || undefined,
      modalidade: modalidade || undefined,
      processo_id: processoId || undefined,
      participantes_ids: responsaveisIds,
      alerta_minutos: alertas,
      enviar_whatsapp: alertas.length > 0,
    } as any;

    try {
      if (isEditing && evento) {
        await updateEvento.mutateAsync({ id: evento.id, ...payload });
        await persistirRelacionamentos(evento.id);
      } else {
        const novo = await createEvento.mutateAsync(payload);
        if (novo?.id) await persistirRelacionamentos(novo.id);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar evento:", error);
    }
  };

  const isPending = createEvento.isPending || updateEvento.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-2xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0"
        aria-describedby="evento-dialog-description"
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{isEditing ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          <p id="evento-dialog-description" className="sr-only">
            Formulário para criar ou editar um evento na agenda
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <form onSubmit={handleSubmit} className="space-y-5 pb-6">
            {/* Título */}
            <div>
              <Label htmlFor="titulo" className="text-sm">
                Título do evento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Digite o título do evento"
                required
                className="mt-1.5"
              />
            </div>

            {/* De */}
            <div>
              <Label className="text-sm">
                De <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  required
                  className="flex-1"
                />
                {!diaInteiro && (
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-28"
                  />
                )}
              </div>
            </div>

            {/* Até */}
            <div>
              <Label className="text-sm">
                Até <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2 mt-1.5">
                {!diaInteiro && (
                  <Input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="w-28"
                  />
                )}
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Dia inteiro */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="dia-inteiro"
                checked={diaInteiro}
                onCheckedChange={(c) => setDiaInteiro(c === true)}
              />
              <Label htmlFor="dia-inteiro" className="cursor-pointer text-sm">
                Dia inteiro
              </Label>
            </div>

            {/* Endereço + Modalidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="local" className="text-sm">
                  Endereço ou local
                </Label>
                <Input
                  id="local"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">Modalidade</Label>
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Alertas internos + Responsável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Alertas internos de antecedência</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={alertaValor}
                    onChange={(e) => setAlertaValor(parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                  <Select
                    value={alertaUnidade}
                    onValueChange={(v) => setAlertaUnidade(v as AlertaUnidade)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_ALERTA.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm">
                  Responsável <span className="text-destructive">*</span>
                </Label>
                <div className="mt-1.5">
                  <PeoplePicker
                    selectedIds={responsaveisIds}
                    onChange={setResponsaveisIds}
                    placeholder="Selecionar responsável"
                    emptyLabel="Nenhum responsável selecionado"
                  />
                </div>
                {!mostrarEnvolvidos && (
                  <button
                    type="button"
                    onClick={() => setMostrarEnvolvidos(true)}
                    className="mt-2 text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" />
                    Envolver mais pessoas
                  </button>
                )}
              </div>
            </div>

            {/* Envolvidos */}
            {mostrarEnvolvidos && (
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Envolvidos (acompanham)</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarEnvolvidos(false);
                      setEnvolvidosIds([]);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remover
                  </button>
                </div>
                <div className="mt-1.5">
                  <PeoplePicker
                    selectedIds={envolvidosIds}
                    onChange={setEnvolvidosIds}
                    placeholder="Adicionar envolvido"
                    emptyLabel="Nenhum envolvido selecionado"
                    icon="users"
                  />
                </div>
              </div>
            )}

            {/* Processo (opcional) */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vincular processo (opcional)
              </Label>
              {processoSelecionado ? (
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="text-sm">
                    <span className="font-medium">{processoSelecionado.numero}</span>
                    <span className="text-muted-foreground ml-2">
                      {processoSelecionado.polo_ativo} x {processoSelecionado.polo_passivo}
                    </span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setProcessoId("")}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número ou partes..."
                      value={processoSearch}
                      onChange={(e) => setProcessoSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {processoSearch && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {processos?.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm"
                          onClick={() => {
                            setProcessoId(p.id);
                            setProcessoSearch("");
                          }}
                        >
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{p.numero}</span>
                          <span className="text-muted-foreground truncate">
                            {p.polo_ativo} x {p.polo_passivo}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Observações */}
            <div>
              <Label htmlFor="observacoes" className="text-sm">
                Observações
              </Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Digite observações sobre o evento"
                rows={3}
                className="mt-1.5"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar" : "Criar evento"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
