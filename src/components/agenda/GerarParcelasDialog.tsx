import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { Loader2, Calendar, DollarSign, Hash, Clock, FileText, Search, X, UserPlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventoAgenda } from "@/hooks/useEventosAgenda";

interface GerarParcelasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: EventoAgenda | null; // Para modo edição
}

const INTERVALOS = [
  { value: "semanal", label: "Semanal (7 dias)" },
  { value: "quinzenal", label: "Quinzenal (15 dias)" },
  { value: "mensal", label: "Mensal (30 dias)" },
];

export function GerarParcelasDialog({ open, onOpenChange, evento }: GerarParcelasDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!evento;
  
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    totalParcelas: 12,
    dataVencimento: format(new Date(), "yyyy-MM-dd"),
    valorPadrao: "",
    intervalo: "mensal",
    processo_id: "",
    participantes_ids: [] as string[],
  });
  
  // Estados para busca de processo
  const [coordenacaoProcessoFiltro, setCoordenacaoProcessoFiltro] = useState<string>("todas");
  const [processoSearch, setProcessoSearch] = useState("");
  
  // Estados para participantes
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>("todas");
  const [participanteSearch, setParticipanteSearch] = useState("");

  // Query para buscar coordenações
  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-parcelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Query para buscar processos com filtro por coordenação
  const { data: processos } = useQuery({
    queryKey: ["processos-parcelas", coordenacaoProcessoFiltro, processoSearch],
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
    queryKey: ["processo-selecionado-parcelas", formData.processo_id],
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

  // Query para buscar usuários (participantes)
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-parcelas", coordenacaoFiltro],
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

  // Buscar parcelas existentes para edição
  const { data: parcelasExistentes } = useQuery({
    queryKey: ["parcelas-evento", evento?.id],
    queryFn: async () => {
      if (!evento?.id) return [];
      const { data, error } = await supabase
        .from("parcelas_evento")
        .select("*")
        .eq("evento_id", evento.id)
        .order("numero");
      if (error) throw error;
      return data;
    },
    enabled: !!evento?.id && open,
  });

  const filteredUsuarios = useMemo(() => {
    if (!usuarios) return [];
    if (!participanteSearch) return usuarios;
    return usuarios.filter(u => 
      u.nome.toLowerCase().includes(participanteSearch.toLowerCase())
    );
  }, [usuarios, participanteSearch]);
  
  // Valores individuais por parcela
  const [valoresIndividuais, setValoresIndividuais] = useState<string[]>([]);

  // Carregar dados do evento quando em modo edição
  useEffect(() => {
    if (evento && open) {
      const primeiraData = parcelasExistentes?.[0]?.data_vencimento || format(new Date(evento.data_inicio), "yyyy-MM-dd");
      
      setFormData({
        titulo: evento.titulo,
        descricao: evento.descricao || "",
        totalParcelas: evento.total_parcelas || parcelasExistentes?.length || 12,
        dataVencimento: primeiraData,
        valorPadrao: "",
        intervalo: "mensal", // Detectar intervalo se possível
        processo_id: evento.processo_id || "",
        participantes_ids: evento.participantes?.map(p => p.usuario_id) || [],
      });
      
      // Carregar valores individuais das parcelas existentes
      if (parcelasExistentes && parcelasExistentes.length > 0) {
        const valores = parcelasExistentes.map(p => p.valor?.toString() || "");
        setValoresIndividuais(valores);
      }
    } else if (!evento && open) {
      setFormData({
        titulo: "",
        descricao: "",
        totalParcelas: 12,
        dataVencimento: format(new Date(), "yyyy-MM-dd"),
        valorPadrao: "",
        intervalo: "mensal",
        processo_id: "",
        participantes_ids: [],
      });
      setValoresIndividuais([]);
    }
  }, [evento, open, parcelasExistentes]);

  // Atualizar valores individuais quando muda total de parcelas ou valor padrão
  const atualizarValoresIndividuais = (novoPadrao?: string, novoTotal?: number) => {
    const total = novoTotal ?? formData.totalParcelas;
    const padrao = novoPadrao ?? formData.valorPadrao;
    
    setValoresIndividuais(prev => {
      const novosValores = [...prev];
      while (novosValores.length < total) {
        novosValores.push(padrao);
      }
      if (novosValores.length > total) {
        novosValores.length = total;
      }
      return novosValores;
    });
  };

  // Calcular preview das parcelas
  const calcularParcelas = () => {
    const parcelas: { numero: number; data: Date; valor: string }[] = [];

    let dataAtual = new Date(formData.dataVencimento + "T12:00:00");
    
    for (let i = 1; i <= formData.totalParcelas; i++) {
      parcelas.push({
        numero: i,
        data: new Date(dataAtual),
        valor: valoresIndividuais[i - 1] || formData.valorPadrao,
      });
      
      // Calcular próxima data
      if (formData.intervalo === "semanal") {
        dataAtual = addWeeks(dataAtual, 1);
      } else if (formData.intervalo === "quinzenal") {
        dataAtual = addDays(dataAtual, 15);
      } else {
        dataAtual = addMonths(dataAtual, 1);
      }
    }
    
    return parcelas;
  };

  const parcelasPreview = calcularParcelas();
  
  // Calcular valor total considerando valores individuais
  const valorTotal = parcelasPreview.reduce((acc, p) => {
    const valor = parseFloat((p.valor || "0").replace(",", ".")) || 0;
    return acc + valor;
  }, 0).toFixed(2);

  const toggleParticipante = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      participantes_ids: prev.participantes_ids.includes(userId)
        ? prev.participantes_ids.filter(id => id !== userId)
        : [...prev.participantes_ids, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (!formData.titulo.trim()) {
      toast.error("Informe um título para o parcelamento");
      return;
    }

    if (formData.totalParcelas < 1 || formData.totalParcelas > 120) {
      toast.error("Número de parcelas deve ser entre 1 e 120");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && evento) {
        // Atualizar evento existente
        const { error: updateError } = await supabase
          .from("eventos_agenda")
          .update({
            titulo: formData.titulo,
            descricao: formData.descricao || `Parcelamento com ${formData.totalParcelas} parcelas. Valor total: R$ ${valorTotal}`,
            processo_id: formData.processo_id || null,
            total_parcelas: formData.totalParcelas,
          })
          .eq("id", evento.id);

        if (updateError) throw updateError;

        // Atualizar participantes
        await supabase.from("participantes_evento").delete().eq("evento_id", evento.id);
        if (formData.participantes_ids.length > 0) {
          await supabase.from("participantes_evento").insert(
            formData.participantes_ids.map(userId => ({
              evento_id: evento.id,
              usuario_id: userId,
            }))
          );
        }

        // Atualizar parcelas - deletar antigas e criar novas
        await supabase.from("parcelas_evento").delete().eq("evento_id", evento.id);
        
        const parcelasParaInserir = parcelasPreview.map((parcela) => ({
          evento_id: evento.id,
          numero: parcela.numero,
          data_vencimento: format(parcela.data, "yyyy-MM-dd"),
          valor: parcela.valor ? parseFloat(parcela.valor.replace(",", ".")) : null,
          status: "pendente",
        }));

        const { error: parcelasError } = await supabase
          .from("parcelas_evento")
          .insert(parcelasParaInserir);

        if (parcelasError) throw parcelasError;

        toast.success("Parcelamento atualizado!");
      } else {
        // Criar novo evento
        const { data: novoEvento, error: eventoError } = await supabase
          .from("eventos_agenda")
          .insert({
            titulo: formData.titulo,
            descricao: formData.descricao || `Parcelamento com ${formData.totalParcelas} parcelas. Valor total: R$ ${valorTotal}`,
            tipo: "parcelamento",
            data_inicio: new Date(formData.dataVencimento + "T12:00:00").toISOString(),
            dia_inteiro: true,
            criado_por: user.id,
            status: "pendente",
            total_parcelas: formData.totalParcelas,
            processo_id: formData.processo_id || null,
          })
          .select("id")
          .single();

        if (eventoError) throw eventoError;

        // Criar participantes
        if (formData.participantes_ids.length > 0) {
          await supabase.from("participantes_evento").insert(
            formData.participantes_ids.map(userId => ({
              evento_id: novoEvento.id,
              usuario_id: userId,
            }))
          );
        }

        // Criar as parcelas filhas
        const parcelasParaInserir = parcelasPreview.map((parcela) => ({
          evento_id: novoEvento.id,
          numero: parcela.numero,
          data_vencimento: format(parcela.data, "yyyy-MM-dd"),
          valor: parcela.valor ? parseFloat(parcela.valor.replace(",", ".")) : null,
          status: "pendente",
        }));

        const { error: parcelasError } = await supabase
          .from("parcelas_evento")
          .insert(parcelasParaInserir);

        if (parcelasError) throw parcelasError;

        toast.success(`Parcelamento criado com ${formData.totalParcelas} parcelas!`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-evento"] });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar parcelamento:", error);
      toast.error("Erro ao salvar parcelamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {isEditing ? "Editar Parcelamento" : "Novo Parcelamento"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Edite os dados do parcelamento e suas parcelas."
              : "Crie um parcelamento com múltiplas parcelas. Os lembretes serão enviados no vencimento de cada parcela."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* Título do Parcelamento */}
            <div>
              <Label htmlFor="titulo" className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Título do Parcelamento *
              </Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Parcelamento Eduardo - Acordo Trabalhista"
                required
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes adicionais do parcelamento"
              />
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
                  <button
                    type="button"
                    className="p-1 hover:bg-muted rounded"
                    onClick={() => setFormData({ ...formData, processo_id: "" })}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {!formData.processo_id && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={coordenacaoProcessoFiltro} onValueChange={setCoordenacaoProcessoFiltro}>
                      <SelectTrigger className="w-full sm:w-48">
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

            {/* Responsáveis/Participantes */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="font-medium flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Responsáveis
              </Label>
              
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
                  <SelectTrigger className="w-full sm:w-48">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total de Parcelas */}
              <div>
                <Label htmlFor="totalParcelas" className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" />
                  Nº de Parcelas *
                </Label>
                <Input
                  id="totalParcelas"
                  type="number"
                  min={1}
                  max={120}
                  value={formData.totalParcelas}
                  onChange={(e) => {
                    const novoTotal = parseInt(e.target.value) || 1;
                    setFormData({ ...formData, totalParcelas: novoTotal });
                    atualizarValoresIndividuais(undefined, novoTotal);
                  }}
                  required
                />
              </div>

              {/* Valor Padrão */}
              <div>
                <Label htmlFor="valorPadrao" className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  Valor Padrão (R$)
                </Label>
                <Input
                  id="valorPadrao"
                  type="text"
                  value={formData.valorPadrao}
                  onChange={(e) => {
                    const novoValor = e.target.value;
                    setFormData({ ...formData, valorPadrao: novoValor });
                    atualizarValoresIndividuais(novoValor);
                  }}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Edite valores individuais abaixo
                </p>
              </div>

              {/* Data da Primeira Parcela */}
              <div>
                <Label htmlFor="dataVencimento" className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  1ª Parcela (Vencimento) *
                </Label>
                <Input
                  id="dataVencimento"
                  type="date"
                  value={formData.dataVencimento}
                  onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                  required
                />
              </div>

              {/* Intervalo */}
              <div>
                <Label htmlFor="intervalo" className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Intervalo entre Parcelas
                </Label>
                <Select
                  value={formData.intervalo}
                  onValueChange={(value) => setFormData({ ...formData, intervalo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALOS.map((intervalo) => (
                      <SelectItem key={intervalo.value} value={intervalo.value}>
                        {intervalo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resumo */}
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total de parcelas:</span>
                  <Badge variant="secondary" className="ml-2">{formData.totalParcelas}</Badge>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Valor total:</span>
                  <Badge variant="outline" className="ml-2">R$ {valorTotal}</Badge>
                </div>
              </div>
            </Card>

            {/* Preview das Parcelas com valores */}
            {parcelasPreview.length > 0 && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="font-medium">Valores das Parcelas</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Preencher todas com valor padrão
                        const novosValores = Array(formData.totalParcelas).fill(formData.valorPadrao);
                        setValoresIndividuais(novosValores);
                      }}
                      disabled={!formData.valorPadrao}
                    >
                      Preencher todas com valor padrão
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Limpar para edição manual
                        setValoresIndividuais(Array(formData.totalParcelas).fill(""));
                      }}
                    >
                      Limpar para editar
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {parcelasPreview.map((parcela) => (
                      <div
                        key={parcela.numero}
                        className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-muted/30"
                      >
                        <span className="font-medium w-24 shrink-0">
                          Parcela {parcela.numero}/{formData.totalParcelas}
                        </span>
                        <span className="text-muted-foreground w-24 shrink-0">
                          {format(parcela.data, "dd/MM/yyyy")}
                        </span>
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-muted-foreground">R$</span>
                          <Input
                            type="text"
                            value={valoresIndividuais[parcela.numero - 1] ?? ""}
                            onChange={(e) => {
                              const novosValores = [...valoresIndividuais];
                              while (novosValores.length < formData.totalParcelas) {
                                novosValores.push("");
                              }
                              novosValores[parcela.numero - 1] = e.target.value;
                              setValoresIndividuais(novosValores);
                            }}
                            placeholder="0,00"
                            className="h-8 w-28"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 sm:px-6 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !formData.titulo.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditing ? "Salvando..." : "Criando..."}
              </>
            ) : (
              <>
                {isEditing ? "Salvar" : "Criar Parcelamento"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
