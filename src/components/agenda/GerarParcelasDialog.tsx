import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import { situacoesDisponiveis } from "@/constants/situacoesItem";
import { ModeloTituloPicker } from "@/components/modelos/ModeloTituloPicker";
import { resolverPadroes } from "@/lib/aplicarPadroesModelo";
import { usePermissoesSituacao } from "@/hooks/usePermissoesSituacao";
import { usePodeCancelarItens } from "@/hooks/usePodeCancelarItens";
import { useCoordenadoresDaCoordenacao, useEnvolvidosFixosDaCoordenacao } from "@/hooks/useCoordenadoresDaCoordenacao";
import { useState, useEffect, useMemo, useRef } from "react";
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
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Textarea } from "@/components/ui/textarea";
import { ItemAbas } from "@/components/comum/ItemAbas";
import { type ItemAnexosHandle } from "@/components/comum/ItemAnexos";
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
import { toZonedTime } from "date-fns-tz";
import { Loader2, Calendar, DollarSign, Hash, Clock, FileText, Search, X, UserPlus, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EventoAgenda } from "@/hooks/useEventosAgenda";
import { AGENDA_INFINITE_QUERY_KEY } from "@/hooks/useAgendaUnificada";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { CoordenacaoSelect } from "@/components/shared/CoordenacaoSelect";

interface GerarParcelasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: EventoAgenda | null; // Para modo edição
  defaultProcessoId?: string;
  inline?: boolean;
  embedded?: boolean;
}

const INTERVALOS = [
  { value: "semanal", label: "Semanal (7 dias)" },
  { value: "quinzenal", label: "Quinzenal (15 dias)" },
  { value: "mensal", label: "Mensal (30 dias)" },
];

const ALERTAS_OPCOES = [
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
];

export function GerarParcelasDialog({ open, onOpenChange, evento, defaultProcessoId, inline = false, embedded = false }: GerarParcelasDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const anexosRef = useRef<ItemAnexosHandle>(null);
  /** Padrões aplicados pelo último modelo escolhido (para limpar ao trocar) */
  const modeloPadroesRef = useRef<Record<string, string> | null>(null);
  const isEditing = !!evento;
  const [situacao, setSituacao] = useState<string>("pendente");
  const { podeCancelar } = usePodeCancelarItens();
  const { precisaSelecionar, unicaCoordenacaoId, coordenacoes: coordenacoesUsuario, isAdmin } = useCoordenacoesDoUsuario();
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const { data: responsaveisFixosIds = [] } = useCoordenadoresDaCoordenacao(
    coordenacaoId || null,
    "PARCELAMENTO",
  );
  const { data: envolvidosFixosIds = [] } = useEnvolvidosFixosDaCoordenacao(
    coordenacaoId || null,
    "PARCELAMENTO",
  );
  const coordenadoresIds = Array.from(
    new Set([...responsaveisFixosIds, ...envolvidosFixosIds]),
  );
  const { podeUsarSituacao, situacaoAtiva } = usePermissoesSituacao(coordenacaoId || null, "PARCELAMENTO");

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    totalParcelas: 12,
    dataVencimento: format(new Date(), "yyyy-MM-dd"),
    valorPadrao: "",
    intervalo: "mensal",
    participantes_ids: [] as string[],
    enviar_whatsapp: false,
    alerta_minutos: [30] as number[],
    // Para parcelas não existe "hora de vencimento". Este horário é a base para calcular os lembretes.
    hora_alerta: "09:00",
  });
  
  // Estados para busca de processo (suporta múltiplos vínculos)
  const [coordenacaoProcessoFiltro, setCoordenacaoProcessoFiltro] = useState<string>(unicaCoordenacaoId ?? "todas");
  const [processoSearch, setProcessoSearch] = useState("");
  const [processoIds, setProcessoIds] = useState<string[]>([]);
  const processoFixoNoDetalhe = !!defaultProcessoId && !evento;

  // Estados para participantes
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>(unicaCoordenacaoId ?? "todas");
  const [participanteSearch, setParticipanteSearch] = useState("");

  // Coordenações visíveis para o usuário (admin vê todas; membros veem só as suas)
  const coordenacoes = coordenacoesUsuario;

  // Auto-seleção quando o usuário tem apenas uma coordenação
  useEffect(() => {
    if (!unicaCoordenacaoId) return;
    setCoordenacaoProcessoFiltro((v) => (v === "todas" ? unicaCoordenacaoId : v));
    setCoordenacaoFiltro((v) => (v === "todas" ? unicaCoordenacaoId : v));
  }, [unicaCoordenacaoId]);

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

  // Buscar processos selecionados (múltiplos) para exibir como chips
  const { data: processosSelecionados = [] } = useQuery({
    queryKey: ["processos-selecionados-parcelas", processoIds.slice().sort().join(",")],
    queryFn: async () => {
      if (processoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo")
        .in("id", processoIds);
      if (error) return [];
      return data || [];
    },
    enabled: processoIds.length > 0,
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

  // Buscar alertas do parcelamento (tempos de lembrete) para modo edição
  // OBS: Parcelamento usa a tabela `alertas_parcela` (não `alertas_evento`).
  const { data: alertasParcelaMinutos } = useQuery({
    queryKey: ["alertas-parcela-minutos", evento?.id],
    queryFn: async () => {
      if (!evento?.id) return [];

      const { data, error } = await supabase
        .from("alertas_parcela")
        .select("minutos_antes, parcelas_evento!inner(evento_id)")
        .eq("parcelas_evento.evento_id", evento.id);

      if (error) throw error;

      const minutos = (data ?? [])
        .map((a: any) => a.minutos_antes)
        .filter((m: any) => typeof m === "number") as number[];

      // Dedup + ordena para manter UI estável
      return Array.from(new Set(minutos)).sort((a, b) => a - b);
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
  // Datas individuais por parcela (quando editadas manualmente)
  const [datasIndividuais, setDatasIndividuais] = useState<string[]>([]);

  // Carregar dados do evento quando em modo edição
  useEffect(() => {
    if (!open) return;

    if (evento) {
      const dataInicioSP = toZonedTime(new Date(evento.data_inicio), "America/Sao_Paulo");
      const primeiraData =
        parcelasExistentes?.[0]?.data_vencimento || format(dataInicioSP, "yyyy-MM-dd");

      // Carregar processos vinculados (múltiplos) com fallback ao processo_id legado
      (async () => {
        const { data: links } = await supabase
          .from("evento_processos")
          .select("processo_id")
          .eq("evento_id", evento.id);
        const ids = (links || []).map((l: any) => l.processo_id);
        if (ids.length > 0) {
          setProcessoIds(ids);
        } else if (evento.processo_id) {
          setProcessoIds([evento.processo_id]);
        } else {
          setProcessoIds([]);
        }
      })();

      setFormData((prev) => ({
        ...prev,
        titulo: evento.titulo,
        descricao: evento.descricao || "",
        totalParcelas: evento.total_parcelas || parcelasExistentes?.length || 12,
        dataVencimento: primeiraData,
        valorPadrao: "",
        intervalo: "mensal", // Detectar intervalo se possível
        participantes_ids: evento.participantes?.map((p) => p.usuario_id) || [],
        enviar_whatsapp: evento.enviar_whatsapp || false,
        // quando a query de alertas carregar, usa o valor real (evita voltar para 30)
        alerta_minutos:
          alertasParcelaMinutos !== undefined
            ? alertasParcelaMinutos
            : prev.alerta_minutos,
        // horário base para disparo dos lembretes (quando não há hora de vencimento)
        hora_alerta: format(dataInicioSP, "HH:mm") || prev.hora_alerta || "09:00",
      }));
      setSituacao(((evento as any).status as any) || "pendente");
      setCoordenacaoId(((evento as any).coordenacao_id as string) || unicaCoordenacaoId || "");

      // Carregar valores e datas individuais das parcelas existentes
      if (parcelasExistentes && parcelasExistentes.length > 0) {
        const valores = parcelasExistentes.map((p) => p.valor?.toString() || "");
        setValoresIndividuais(valores);
        const datas = parcelasExistentes.map((p) => p.data_vencimento);
        setDatasIndividuais(datas);
      }
    } else {
      setFormData({
        titulo: "",
        descricao: "",
        totalParcelas: 12,
        dataVencimento: format(new Date(), "yyyy-MM-dd"),
        valorPadrao: "",
        intervalo: "mensal",
        participantes_ids: [],
        enviar_whatsapp: false,
        alerta_minutos: [30],
        hora_alerta: "09:00",
      });
      setProcessoIds(defaultProcessoId ? [defaultProcessoId] : []);
      setValoresIndividuais([]);
      setDatasIndividuais([]);
      setSituacao("pendente");
      setCoordenacaoId(unicaCoordenacaoId || "");
    }
  }, [evento, open, parcelasExistentes, alertasParcelaMinutos, defaultProcessoId, unicaCoordenacaoId]);

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
      // Usar data individual se existir, senão usar data calculada
      const dataIndividual = datasIndividuais[i - 1];
      const dataParcela = dataIndividual 
        ? new Date(dataIndividual + "T12:00:00")
        : new Date(dataAtual);
      
      parcelas.push({
        numero: i,
        data: dataParcela,
        valor: valoresIndividuais[i - 1] || formData.valorPadrao,
      });
      
      // Calcular próxima data (baseada na data atual calculada, não na individual)
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
    if (coordenadoresIds.includes(userId)) return;
    setFormData(prev => ({
      ...prev,
      participantes_ids: prev.participantes_ids.includes(userId)
        ? prev.participantes_ids.filter(id => id !== userId)
        : [...prev.participantes_ids, userId],
    }));
  };

  // Coordenadores da coordenação são participantes obrigatórios (fixos)
  useEffect(() => {
    if (coordenadoresIds.length === 0) return;
    setFormData((prev) => {
      const faltando = coordenadoresIds.filter((id) => !prev.participantes_ids.includes(id));
      if (faltando.length === 0) return prev;
      return { ...prev, participantes_ids: [...prev.participantes_ids, ...faltando] };
    });
  }, [JSON.stringify(coordenadoresIds)]);

  const toggleAlerta = (minutos: number) => {
    setFormData(prev => ({
      ...prev,
      alerta_minutos: prev.alerta_minutos.includes(minutos)
        ? prev.alerta_minutos.filter(m => m !== minutos)
        : [...prev.alerta_minutos, minutos],
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

    if (precisaSelecionar && !coordenacaoId) {
      toast.error("Selecione a coordenação do parcelamento");
      return;
    }

    if (formData.totalParcelas < 1 || formData.totalParcelas > 120) {
      toast.error("Número de parcelas deve ser entre 1 e 120");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && evento) {
        // Atualizar evento existente - parcelamento é recorrente até todas parcelas serem pagas
          const { error: updateError } = await supabase
            .from("eventos_agenda")
            .update({
              titulo: formData.titulo,
              descricao:
                formData.descricao ||
                `Parcelamento com ${formData.totalParcelas} parcelas. Valor total: R$ ${valorTotal}`,
              // mantém o evento de parcelamento apontando para a data da 1ª parcela, mas com um horário base para alertas
              data_inicio: `${formData.dataVencimento}T${formData.hora_alerta || "09:00"}:00-03:00`,
              processo_id: processoIds[0] || null,
              coordenacao_id: coordenacaoId || null,
              total_parcelas: formData.totalParcelas,
              enviar_whatsapp: formData.enviar_whatsapp,
              recorrente: true, // Parcelamento é recorrente até terminar
              status: situacao,
              concluido_em: situacao === "concluido" ? new Date().toISOString() : null,
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

        // Sincronizar processos vinculados (múltiplos)
        await (supabase as any).from("evento_processos").delete().eq("evento_id", evento.id);
        if (processoIds.length > 0) {
          await (supabase as any).from("evento_processos").insert(
            processoIds.map((pid) => ({ evento_id: evento.id, processo_id: pid }))
          );
        }

        // Atualizar parcelas - deletar antigas e criar novas
        // Isso também deleta os alertas_parcela em cascata
        await supabase.from("parcelas_evento").delete().eq("evento_id", evento.id);
        
        const parcelasParaInserir = parcelasPreview.map((parcela) => ({
          evento_id: evento.id,
          numero: parcela.numero,
          data_vencimento: format(parcela.data, "yyyy-MM-dd"),
          valor: parcela.valor ? parseFloat(parcela.valor.replace(",", ".")) : null,
          status: "pendente",
        }));

        const { data: parcelasCriadas, error: parcelasError } = await supabase
          .from("parcelas_evento")
          .insert(parcelasParaInserir)
          .select("id");

        if (parcelasError) throw parcelasError;

        // Criar alertas por parcela se enviar_whatsapp estiver ativo
        if (formData.enviar_whatsapp && formData.alerta_minutos.length > 0 && parcelasCriadas) {
          const alertasParcelas = parcelasCriadas.flatMap((parcela) =>
            formData.alerta_minutos.map((minutos) => ({
              parcela_id: parcela.id,
              minutos_antes: minutos,
            }))
          );
          await supabase.from("alertas_parcela").insert(alertasParcelas);
        }

        toast.success("Parcelamento atualizado!");
        await anexosRef.current?.uploadPendentes(evento.id, processoIds[0] || null);
      } else {
        // Criar novo evento - parcelamento é recorrente até todas parcelas serem pagas
        const { data: novoEvento, error: eventoError } = await supabase
          .from("eventos_agenda")
          .insert({
            titulo: formData.titulo,
            descricao:
              formData.descricao ||
              `Parcelamento com ${formData.totalParcelas} parcelas. Valor total: R$ ${valorTotal}`,
            tipo: "parcelamento",
            // Como parcela não tem hora, guardamos um horário base para disparo dos lembretes
            data_inicio: `${formData.dataVencimento}T${formData.hora_alerta || "09:00"}:00-03:00`,
            dia_inteiro: true,
            criado_por: user.id,
            status: situacao,
            total_parcelas: formData.totalParcelas,
            processo_id: processoIds[0] || null,
            coordenacao_id: coordenacaoId || null,
            enviar_whatsapp: formData.enviar_whatsapp,
            recorrente: true, // Parcelamento é recorrente até terminar
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

        // Vincular múltiplos processos
        if (processoIds.length > 0) {
          await (supabase as any).from("evento_processos").insert(
            processoIds.map((pid) => ({ evento_id: novoEvento.id, processo_id: pid }))
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

        const { data: parcelasCriadas, error: parcelasError } = await supabase
          .from("parcelas_evento")
          .insert(parcelasParaInserir)
          .select("id");

        if (parcelasError) throw parcelasError;

        // Criar alertas por parcela se enviar_whatsapp estiver ativo
        if (formData.enviar_whatsapp && formData.alerta_minutos.length > 0 && parcelasCriadas) {
          const alertasParcelas = parcelasCriadas.flatMap((parcela) =>
            formData.alerta_minutos.map((minutos) => ({
              parcela_id: parcela.id,
              minutos_antes: minutos,
            }))
          );
          await supabase.from("alertas_parcela").insert(alertasParcelas);
        }

        toast.success(`Parcelamento criado com ${formData.totalParcelas} parcelas!`);
        await anexosRef.current?.uploadPendentes(novoEvento.id, processoIds[0] || null);
      }
      
      await queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["parcelas-evento"] });
      await invalidarItensAgenda(queryClient);

      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar parcelamento:", error);
      toast.error("Erro ao salvar parcelamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAlterarStatus = async (status: "pendente" | "concluido" | "cancelado") => {
    if (!evento?.id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("eventos_agenda")
        .update({
          status,
          concluido_em: status === "concluido" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", evento.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      await invalidarItensAgenda(queryClient);
      toast.success(status === "concluido" ? "Parcelamento concluído" : status === "cancelado" ? "Parcelamento cancelado" : "Parcelamento reaberto");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao atualizar parcelamento: " + (error?.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerInline = (
    <div className="px-4 pt-4 sm:px-6 sm:pt-5 pb-3 shrink-0 border-b flex items-center justify-between gap-3">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Parcelamento
      </h3>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Situação</Label>
        <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {situacoesDisponiveis("parcelamento", { podeGerenciar: podeCancelar, atual: situacao }).filter((s) => s.value === situacao || (situacaoAtiva(s.value) && podeUsarSituacao(s.value))).map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="submit"
          form="parcelamento-form-content"
          size="sm"
          disabled={isSubmitting || !formData.titulo.trim()}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Salvar" : "Criar Parcelamento"}
        </Button>
      </div>
    </div>
  );
  const headerDialog = (
    <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2 shrink-0">
      <div className="flex items-center justify-between gap-3">
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Parcelamento
        </DialogTitle>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Situação</Label>
          <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {situacoesDisponiveis("parcelamento", { podeGerenciar: podeCancelar, atual: situacao }).filter((s) => s.value === situacao || (situacaoAtiva(s.value) && podeUsarSituacao(s.value))).map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            form="parcelamento-form-content"
            size="sm"
            disabled={isSubmitting || !formData.titulo.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Salvar" : "Criar Parcelamento"}
          </Button>
        </div>
      </div>
    </DialogHeader>
  );

  const Body = (
    <>
      {inline ? headerInline : headerDialog}

        <div className={embedded ? "px-4 sm:px-6" : "flex-1 overflow-y-auto px-4 sm:px-6"}>
          <form id="parcelamento-form-content" onSubmit={handleSubmit} className="space-y-4 pb-4">
            {precisaSelecionar && (
              <CoordenacaoSelect
                value={coordenacaoId}
                onChange={setCoordenacaoId}
                required
              />
            )}
            {/* Título do Parcelamento */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="titulo" className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Título do Parcelamento *
                </Label>
                <ModeloTituloPicker
                  tipo="parcela"
                  coordenacaoId={coordenacaoId}
                  onSelect={(m) => {
                    const anterior = modeloPadroesRef.current || {};
                    const p = resolverPadroes(m);
                    /** Limpa o que o modelo anterior preencheu e o novo não define */
                    const limpou = (key: string, atual: any) =>
                      anterior[key] && !p[key] && String(atual ?? "") === anterior[key];
                    setFormData((prev) => {
                      const next: any = { ...prev, titulo: m.titulo };
                      if (limpou("descricao", next.descricao)) next.descricao = "";
                      if (!next.descricao && (p.descricao || m.descricao)) next.descricao = p.descricao || m.descricao;
                      if (limpou("dataVencimento", next.dataVencimento)) next.dataVencimento = "";
                      if (p.dataVencimento) next.dataVencimento = p.dataVencimento;
                      if (p.totalParcelas) next.totalParcelas = Number(p.totalParcelas);
                      if (limpou("valorPadrao", next.valorPadrao)) next.valorPadrao = "";
                      if (p.valorPadrao && !next.valorPadrao) next.valorPadrao = p.valorPadrao;
                      if (p.intervalo) next.intervalo = p.intervalo;
                      if (limpou("hora_alerta", next.hora_alerta)) next.hora_alerta = "";
                      if (p.hora_alerta) next.hora_alerta = p.hora_alerta;
                      return next;
                    });
                    modeloPadroesRef.current = { ...p, descricao: p.descricao || m.descricao || "" };
                  }}
                />
              </div>
              <AutoResizeTextarea
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Parcelamento Eduardo - Acordo Trabalhista"
                required
              />
            </div>

            {/* Vincular Processos (múltiplos) */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vincular Processos (opcional)
              </Label>

              {/* Processos selecionados como chips */}
              {processosSelecionados.length > 0 && (
                <div className="space-y-1">
                  {processosSelecionados.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                    >
                      <div className="text-sm min-w-0 flex-1">
                        <span className="font-medium">{p.numero}</span>
                        <span className="text-muted-foreground ml-2 truncate">
                          {p.polo_ativo} x {p.polo_passivo}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="p-1 hover:bg-destructive/10 rounded shrink-0"
                        onClick={() =>
                          setProcessoIds((prev) => prev.filter((id) => id !== p.id))
                        }
                        title="Remover vínculo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!processoFixoNoDetalhe && (
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
                  
                  <div className="space-y-1">
                    {processos?.filter((pp) => !processoIds.includes(pp.id)).map((processo) => (
                      <div
                        key={processo.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                        onClick={() => {
                          setProcessoIds((prev) => prev.includes(processo.id) ? prev : [...prev, processo.id]);
                          setProcessoSearch("");
                        }}
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
              
              <div className="grid grid-cols-2 gap-2">
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
                  <Label className="font-medium">Datas e Valores das Parcelas</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Recalcular datas automáticas
                        setDatasIndividuais([]);
                      }}
                    >
                      Recalcular Datas
                    </Button>
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
                      Preencher valores
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
                      Limpar valores
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                    {parcelasPreview.map((parcela) => (
                      <div
                        key={parcela.numero}
                        className="flex flex-wrap items-center gap-2 text-sm py-2 px-2 rounded bg-muted/30"
                      >
                        <span className="font-medium w-20 shrink-0">
                          Parcela {parcela.numero}/{formData.totalParcelas}
                        </span>
                        <Input
                          type="date"
                          value={datasIndividuais[parcela.numero - 1] || format(parcela.data, "yyyy-MM-dd")}
                          onChange={(e) => {
                            const novasDatas = [...datasIndividuais];
                            while (novasDatas.length < formData.totalParcelas) {
                              novasDatas.push("");
                            }
                            novasDatas[parcela.numero - 1] = e.target.value;
                            setDatasIndividuais(novasDatas);
                          }}
                          className="h-8 w-36"
                        />
                        <div className="flex items-center gap-1">
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
                            className="h-8 w-24"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            )}

            {/* Notificação WhatsApp */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="enviar-whatsapp-parcelas"
                  checked={formData.enviar_whatsapp}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviar_whatsapp: checked === true }))}
                />
                <Label htmlFor="enviar-whatsapp-parcelas" className="cursor-pointer flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  <span>Enviar alerta via WhatsApp</span>
                </Label>
              </div>
              
              {formData.enviar_whatsapp && (
                <>
                  <p className="text-xs text-muted-foreground ml-7">
                    Os participantes com telefone cadastrado receberão lembretes via WhatsApp.
                  </p>

                  <div className="ml-7">
                    <Label htmlFor="hora-alerta-parcelas" className="text-sm font-medium">
                      Horário base do alerta
                    </Label>
                    <div className="mt-2">
                      <Input
                        id="hora-alerta-parcelas"
                        type="time"
                        value={formData.hora_alerta}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, hora_alerta: e.target.value }))
                        }
                        className="h-8 w-36"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Como a parcela não tem horário de vencimento, este horário é usado como base
                        para calcular os lembretes (ex.: 30min antes).
                      </p>
                    </div>
                  </div>

                  {/* Alertas - só aparece se enviar_whatsapp estiver marcado */}
                  <div className="ml-7 pt-2 border-t mt-2">
                    <Label className="text-sm font-medium">Tempos de Lembrete</Label>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {ALERTAS_OPCOES.map((opcao) => (
                        <div key={opcao.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`alerta-parcela-${opcao.value}`}
                            checked={formData.alerta_minutos.includes(opcao.value)}
                            onCheckedChange={() => toggleAlerta(opcao.value)}
                          />
                          <Label htmlFor={`alerta-parcela-${opcao.value}`} className="cursor-pointer text-sm">
                            {opcao.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <ItemAbas
              ref={anexosRef}
              tipo="parcelamento"
              tipoComentario="evento"
              itemId={evento?.id}
              processoId={processoIds[0] || null}
            />

            <div>
              <Label htmlFor="descricao" className="text-sm">Observações</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes adicionais do parcelamento"
                rows={4}
                className="mt-1.5"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 sm:px-6 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          {isEditing && evento?.status !== "pendente" && (
            <Button type="button" variant="outline" onClick={() => handleAlterarStatus("pendente")} disabled={isSubmitting}>
              Reabrir
            </Button>
          )}
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
    </>
  );

  if (inline) {
    return (
      <div className={embedded ? "flex flex-col bg-background" : "h-full flex flex-col bg-background overflow-hidden"}>
        {Body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col p-0">
        {Body}
      </DialogContent>
    </Dialog>
  );
}
