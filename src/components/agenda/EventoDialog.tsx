import { useState, useEffect, useMemo } from "react";
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
import { useEnviarWhatsApp } from "@/hooks/useEnviarWhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, UserPlus, MessageCircle, Loader2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: EventoAgenda | null;
  defaultProcessoId?: string;
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

export function EventoDialog({ open, onOpenChange, evento, defaultProcessoId }: EventoDialogProps) {
  const createEvento = useCreateEvento();
  const updateEvento = useUpdateEvento();
  const enviarWhatsApp = useEnviarWhatsApp();
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
    enviar_whatsapp: true,
    // Para eventos "dia inteiro" (sem hora), este horário define quando os lembretes disparam
    hora_alerta: "09:00",
  });

  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>("todas");
  const [coordenacaoProcessoFiltro, setCoordenacaoProcessoFiltro] = useState<string>("todas");
  const [participanteSearch, setParticipanteSearch] = useState("");
  const [processoSearch, setProcessoSearch] = useState("");

  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-agenda", coordenacaoFiltro],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      
      if (coordenacaoFiltro && coordenacaoFiltro !== "todas") {
        const { data: membros } = await supabase
          .from("membros_coordenacao")
          .select("usuario_id")
          .eq("coordenacao_id", coordenacaoFiltro);
        
        const userIds = membros?.map(m => m.usuario_id) || [];
        if (userIds.length > 0) {
          query = query.in("id", userIds);
        } else {
          return [];
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Query para buscar processos com filtro por coordenação
  const { data: processos } = useQuery({
    queryKey: ["processos-agenda", coordenacaoProcessoFiltro, processoSearch],
    queryFn: async () => {
      let query = supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo, coordenacao_id")
        .order("numero")
        .limit(50);
      
      if (coordenacaoProcessoFiltro && coordenacaoProcessoFiltro !== "todas") {
        query = query.eq("coordenacao_id", coordenacaoProcessoFiltro);
      }
      
      if (processoSearch) {
        query = query.or(`numero.ilike.%${processoSearch}%,polo_ativo.ilike.%${processoSearch}%,polo_passivo.ilike.%${processoSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Buscar processo selecionado para exibir
  const { data: processoSelecionado } = useQuery({
    queryKey: ["processo-selecionado", formData.processo_id],
    queryFn: async () => {
      if (!formData.processo_id) return null;
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo")
        .eq("id", formData.processo_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!formData.processo_id,
  });

  const filteredUsuarios = useMemo(() => {
    if (!usuarios) return [];
    if (!participanteSearch) return usuarios;
    return usuarios.filter(u => 
      u.nome.toLowerCase().includes(participanteSearch.toLowerCase())
    );
  }, [usuarios, participanteSearch]);

  // Carregar alertas do evento ao editar
  const { data: alertasEvento } = useQuery({
    queryKey: ["alertas-evento", evento?.id],
    queryFn: async () => {
      if (!evento?.id) return [];
      const { data, error } = await supabase
        .from("alertas_evento")
        .select("minutos_antes")
        .eq("evento_id", evento.id);
      if (error) throw error;
      return data?.map(a => a.minutos_antes) || [];
    },
    enabled: !!evento?.id && open,
  });

  useEffect(() => {
    if (evento) {
      // Converter para horário de Brasília usando date-fns-tz
      const dataInicio = toZonedTime(new Date(evento.data_inicio), 'America/Sao_Paulo');
      const dataFim = evento.data_fim ? toZonedTime(new Date(evento.data_fim), 'America/Sao_Paulo') : null;
      
      // Só atualizar alertas quando a query terminou de carregar
      // alertasEvento será undefined enquanto carrega, [] se não há alertas, ou array com valores
      const alertas = alertasEvento !== undefined ? (alertasEvento.length > 0 ? alertasEvento : []) : formData.alerta_minutos;
      
      setFormData(prev => ({
        ...prev,
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
        alerta_minutos: alertas,
        enviar_whatsapp: evento.enviar_whatsapp ?? true,
        hora_alerta: format(dataInicio, "HH:mm") || "09:00",
      }));
    } else if (open) {
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
        processo_id: defaultProcessoId || "",
        participantes_ids: [],
        alerta_minutos: [30],
        enviar_whatsapp: true,
        hora_alerta: "09:00",
      });
    }
  }, [evento, open, alertasEvento, defaultProcessoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Salvar com offset de Brasília (-03:00) para garantir que o horário seja preservado
    const dataInicio = formData.dia_inteiro
      ? formData.enviar_whatsapp
        ? `${formData.data_inicio}T${formData.hora_alerta || "09:00"}:00-03:00`
        : `${formData.data_inicio}T00:00:00-03:00`
      : `${formData.data_inicio}T${formData.hora_inicio}:00-03:00`;

    const dataFim = formData.data_fim
      ? formData.dia_inteiro
        ? `${formData.data_fim}T23:59:59-03:00`
        : `${formData.data_fim}T${formData.hora_fim || formData.hora_inicio}:00-03:00`
      : undefined;

    const eventoData = {
      titulo: formData.titulo,
      descricao: formData.descricao || undefined,
      enviar_whatsapp: formData.enviar_whatsapp,
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

    try {
      if (isEditing && evento) {
        await updateEvento.mutateAsync({ id: evento.id, ...eventoData });
      } else {
        await createEvento.mutateAsync(eventoData);
      }

      // Enviar WhatsApp para participantes se solicitado
      if (formData.enviar_whatsapp && formData.participantes_ids.length > 0) {
        // Buscar telefones dos participantes
        const { data: participantesComTelefone } = await supabase
          .from("profiles")
          .select("id, nome, telefone")
          .in("id", formData.participantes_ids);

        const telefonesValidos = participantesComTelefone
          ?.filter(p => p.telefone)
          .map(p => p.telefone!) || [];

        if (telefonesValidos.length > 0) {
          try {
            await enviarWhatsApp.mutateAsync({
              eventoTitulo: formData.titulo,
              eventoDescricao: formData.descricao || undefined,
              eventoData: dataInicio,
              eventoHora: formData.dia_inteiro ? undefined : formData.hora_inicio,
              eventoLocal: formData.local || undefined,
              participantesTelefones: telefonesValidos,
              tipo: isEditing ? "lembrete" : "evento",
            });
          } catch (whatsAppError) {
            console.error("Erro ao enviar WhatsApp:", whatsAppError);
            // Não bloqueia o fluxo principal, apenas notifica
          }
        } else {
          toast.info("Nenhum participante com telefone cadastrado");
        }
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar evento:", error);
    }
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
      <DialogContent 
        className="w-[95vw] max-w-2xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0"
        aria-describedby="evento-dialog-description"
      >
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2 shrink-0">
          <DialogTitle>
            {isEditing ? "Editar Evento" : "Novo Evento"}
          </DialogTitle>
          <p id="evento-dialog-description" className="sr-only">
            Formulário para criar ou editar um evento na agenda
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
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

              <div className="col-span-1 sm:col-span-2">
                <Label htmlFor="local">Local</Label>
                <Input
                  id="local"
                  value={formData.local}
                  onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                  placeholder="Local do evento"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            {/* Vincular Processo */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vincular Processo (opcional)
              </Label>
              
              {/* Processo selecionado */}
              {processoSelecionado && (
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                  <div className="text-sm">
                    <span className="font-medium">{processoSelecionado.numero}</span>
                    <span className="text-muted-foreground ml-2">
                      {processoSelecionado.polo_ativo} x {processoSelecionado.polo_passivo}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, processo_id: "" })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {!formData.processo_id && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={coordenacaoProcessoFiltro} onValueChange={setCoordenacaoProcessoFiltro}>
                      <SelectTrigger className="w-full sm:w-72">
                        <SelectValue placeholder="Filtrar por coordenação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as coordenações</SelectItem>
                        {coordenacoes?.map((coord) => (
                          <SelectItem key={coord.id} value={coord.id}>
                            {coord.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por número ou partes..."
                        value={processoSearch}
                        onChange={(e) => setProcessoSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {processos?.map((processo) => (
                      <div
                        key={processo.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                        onClick={() => setFormData({ ...formData, processo_id: processo.id })}
                      >
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{processo.numero}</span>
                        <span className="text-muted-foreground truncate">
                          {processo.polo_ativo} x {processo.polo_passivo}
                        </span>
                      </div>
                    ))}
                    {processos?.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhum processo encontrado
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Participantes */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="font-medium">Participantes</Label>
              
              {/* Selected participants as chips */}
              {formData.participantes_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md">
                  {formData.participantes_ids.map(id => {
                    const user = usuarios?.find(u => u.id === id);
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
                        onClick={() => toggleParticipante(id)}
                      >
                        {user?.nome || "Carregando..."}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={coordenacaoFiltro} onValueChange={setCoordenacaoFiltro}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="Filtrar por coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as coordenações</SelectItem>
                    {coordenacoes?.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id}>
                        {coord.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar participante..."
                    value={participanteSearch}
                    onChange={(e) => setParticipanteSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {filteredUsuarios?.filter(u => !formData.participantes_ids.includes(u.id)).map((usuario) => (
                  <div 
                    key={usuario.id} 
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => toggleParticipante(usuario.id)}
                  >
                    <UserPlus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{usuario.nome}</span>
                  </div>
                ))}
                {filteredUsuarios?.filter(u => !formData.participantes_ids.includes(u.id)).length === 0 && (
                  <p className="col-span-2 text-sm text-muted-foreground text-center py-2">
                    {formData.participantes_ids.length > 0 ? "Todos já adicionados" : "Nenhum participante encontrado"}
                  </p>
                )}
              </div>
            </div>

            {/* Notificação WhatsApp */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="enviar-whatsapp"
                  checked={formData.enviar_whatsapp}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviar_whatsapp: checked === true }))}
                />
                <Label htmlFor="enviar-whatsapp" className="cursor-pointer flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  <span>Enviar alerta via WhatsApp</span>
                </Label>
              </div>
              
              {formData.enviar_whatsapp && (
                <>
                  <p className="text-xs text-muted-foreground ml-7">
                    Os participantes com telefone cadastrado receberão uma mensagem no WhatsApp com os detalhes do evento.
                  </p>

                  {formData.dia_inteiro && (
                    <div className="ml-7">
                      <Label htmlFor="hora-alerta-evento" className="text-sm font-medium">
                        Horário base do alerta
                      </Label>
                      <div className="mt-2">
                        <Input
                          id="hora-alerta-evento"
                          type="time"
                          value={formData.hora_alerta}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, hora_alerta: e.target.value }))
                          }
                          className="h-8 w-36"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Para eventos “Dia inteiro” (sem hora), este horário define quando os lembretes
                          serão calculados.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Alertas - só aparece se enviar_whatsapp estiver marcado */}
                  <div className="ml-7 pt-2 border-t mt-2">
                    <Label className="text-sm font-medium">Tempos de Lembrete</Label>
                    <div className="flex flex-wrap gap-3 mt-2">
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
                </>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 pb-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createEvento.isPending || updateEvento.isPending || enviarWhatsApp.isPending}
                className="w-full sm:w-auto"
              >
                {(createEvento.isPending || updateEvento.isPending || enviarWhatsApp.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {enviarWhatsApp.isPending 
                  ? "Enviando WhatsApp..." 
                  : isEditing 
                    ? "Salvar" 
                    : "Criar Evento"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
