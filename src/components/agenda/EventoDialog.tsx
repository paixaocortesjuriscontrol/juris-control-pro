import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import { situacoesDisponiveis } from "@/constants/situacoesItem";
import { usePermissoesSituacao } from "@/hooks/usePermissoesSituacao";
import { ModeloTituloPicker } from "@/components/modelos/ModeloTituloPicker";
import { EtiquetaPicker } from "@/components/etiquetas/EtiquetaPicker";
import { resolverPadroes, resolverPrazoModelo } from "@/lib/aplicarPadroesModelo";
import { usePodeCancelarItens } from "@/hooks/usePodeCancelarItens";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
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
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { ItemAbas } from "@/components/comum/ItemAbas";
import { type ItemAnexosHandle } from "@/components/comum/ItemAnexos";
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
import { Badge } from "@/components/ui/badge";
import { parseISO, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BotaoPreencherIA } from "@/components/tarefas/BotaoPreencherIA";
import { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { useCreateEvento, useUpdateEvento, EventoAgenda } from "@/hooks/useEventosAgenda";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { useCoordenadoresDaCoordenacao, useEnvolvidosFixosDaCoordenacao } from "@/hooks/useCoordenadoresDaCoordenacao";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { CoordenacaoSelect } from "@/components/shared/CoordenacaoSelect";
import { AlertasConfigCard } from "@/components/shared/AlertasConfigCard";
import { ensureProcessoFromPublicacao } from "@/lib/ensureProcessoFromPublicacao";
import { useAuth } from "@/contexts/AuthContext";
import { PublicacaoVinculadaCollapsible } from "@/components/shared/PublicacaoVinculadaCollapsible";
import { registrarAuditoriaTarefa } from "@/hooks/useAuditoriaTarefas";
import { ProcessoResumoInline } from "@/components/processos/ProcessoResumoInline";
import { usePodeAlterarDatas } from "@/hooks/usePodeAlterarDatas";

function ScrollAreaOrDiv({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <div className="px-6">{children}</div>;
  return <ScrollArea className="flex-1 px-6">{children}</ScrollArea>;
}

interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: EventoAgenda | null;
  defaultProcessoId?: string;
  publicacao?: PublicacaoUnificada | null;
  inline?: boolean;
  /** Fluxo natural sem scroll interno (usado dentro de páginas). */
  embedded?: boolean;
  /**
   * Quando `true`, oculta o card verde expansível "Publicação DJEN vinculada"
   * dentro do formulário. Usado pelo layout side-by-side da tela Análise DJEN,
   * onde a publicação já é exibida em um painel lateral fixo à esquerda.
   */
  hidePublicacaoCollapsible?: boolean;
  secondarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  /**
   * Botão adicional (ex.: "Salvar e fechar" na Análise DJEN).
   */
  tertiarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  /**
   * Chamado após criar (não editar) o evento com sucesso.
   */
  onAfterCreate?: (info: { id: string; titulo: string }) => void;
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

export function EventoDialog({ open, onOpenChange, evento, defaultProcessoId, publicacao, inline = false, embedded = false, hidePublicacaoCollapsible = false, secondarySave, tertiarySave, onAfterCreate }: EventoDialogProps) {
  const createEvento = useCreateEvento();
  const updateEvento = useUpdateEvento();
  const queryClient = useQueryClient();
  const isEditing = !!evento;
  const secondaryClickedRef = useRef(false);
  const tertiaryClickedRef = useRef(false);
  const anexosRef = useRef<ItemAnexosHandle>(null);
  const { precisaSelecionar, unicaCoordenacaoId } = useCoordenacoesDoUsuario();
  const { user } = useAuth();
  const { datasBloqueadas, motivoBloqueio } = usePodeAlterarDatas(null, "EVENTO");
  const travarDatas = datasBloqueadas && isEditing;
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");

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
  const { data: coordenadoresIds = [] } = useCoordenadoresDaCoordenacao(coordenacaoId || null, "OUTROS");
  const { podeUsarSituacao, situacaoAtiva, comentarioObrigatorio } = usePermissoesSituacao(
    coordenacaoId || null,
    "EVENTO",
  );
  // Envolvidos fixos configurados na coordenação para este tipo
  const { data: envolvidosFixosIds = [] } = useEnvolvidosFixosDaCoordenacao(coordenacaoId || null, "OUTROS");
  useEffect(() => {
    if (envolvidosFixosIds.length === 0) return;
    setEnvolvidosIds((prev) => {
      const faltando = envolvidosFixosIds.filter((id) => !prev.includes(id));
      return faltando.length > 0 ? [...prev, ...faltando] : prev;
    });
  }, [JSON.stringify(envolvidosFixosIds)]);
  useEffect(() => {
    if (coordenadoresIds.length === 0) return;
    setResponsaveisIds((prev) => {
      const faltando = coordenadoresIds.filter((id) => !prev.includes(id));
      return faltando.length > 0 ? [...prev, ...faltando] : prev;
    });
  }, [JSON.stringify(coordenadoresIds)]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const [mostrarEnvolvidos, setMostrarEnvolvidos] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const [processoId, setProcessoId] = useState("");
  const [processoSearch, setProcessoSearch] = useState("");
  const [situacao, setSituacao] = useState<string>("pendente");
  const [situacaoInicial, setSituacaoInicial] = useState<string>("pendente");
  const [comentarioSituacao, setComentarioSituacao] = useState("");
  const { podeCancelar } = usePodeCancelarItens();

  // Recorrência
  const [recorrenciaTipo, setRecorrenciaTipo] = useState<string>("nenhuma");
  const [recorrenciaIntervalo, setRecorrenciaIntervalo] = useState<number>(1);
  const [recorrenciaFim, setRecorrenciaFim] = useState<string>("");
  const [recorrenciaOcorrencias, setRecorrenciaOcorrencias] = useState<string>("");

  // Reset do formulário para "novo evento". Reutilizado pelo useEffect de abertura
  // e pelo pós-Save quando o wrapper deve permanecer aberto para cadastrar outro item.
  const resetFormForNew = () => {
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
    setSituacao("pendente");
    setSituacaoInicial("pendente");
    setComentarioSituacao("");
    setRecorrenciaTipo("nenhuma");
    setRecorrenciaIntervalo(1);
    setRecorrenciaFim("");
    setRecorrenciaOcorrencias("");
    setCoordenacaoId(unicaCoordenacaoId || "");
  };

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
      setRecorrenciaTipo((evento as any).recorrencia_tipo || "nenhuma");
      setRecorrenciaIntervalo((evento as any).recorrencia_intervalo || 1);
      setRecorrenciaFim(((evento as any).recorrencia_fim || "").slice(0, 10));
      setSituacao(((evento as any).status as any) || "pendente");
      setSituacaoInicial(((evento as any).status as any) || "pendente");
      setComentarioSituacao("");
      setCoordenacaoId(((evento as any).coordenacao_id as string) || unicaCoordenacaoId || "");

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
      resetFormForNew();
    }
  }, [evento, open, alertasEvento, defaultProcessoId, unicaCoordenacaoId]);

  // Ao abrir com uma publicação sem processo_id resolvido, garantir criação/vínculo do processo
  useEffect(() => {
    if (!open) return;
    if (evento) return;
    if (processoId) return;
    if (!publicacao || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const proc = await ensureProcessoFromPublicacao(
          publicacao,
          user.id,
          null,
          unicaCoordenacaoId || null,
        );
        if (!cancelled && proc?.id) setProcessoId(proc.id);
      } catch (err) {
        console.error("[EventoDialog] ensureProcesso falhou:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [open, evento, processoId, publicacao?.id, user?.id]);

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
    if (precisaSelecionar && !coordenacaoId) {
      toast.error("Selecione a coordenação");
      return;
    }
    const situacaoMudou = situacao !== situacaoInicial;
    if (situacaoMudou && comentarioObrigatorio && !comentarioSituacao.trim()) {
      toast.error("Comentário obrigatório para mudar a situação");
      return;
    }


    let processoIdParaSalvar = processoId;
    if (publicacao && user?.id) {
      try {
        const proc = await ensureProcessoFromPublicacao(
          publicacao,
          user.id,
          null,
          coordenacaoId || unicaCoordenacaoId || null,
        );
        if (proc?.id) {
          processoIdParaSalvar = proc.id;
          setProcessoId(proc.id);
        }
      } catch (err: any) {
        toast.error("Erro ao vincular processo da publicação: " + (err?.message || err));
        return;
      }
    }

    const inicioISO = diaInteiro
      ? `${dataInicio}T00:00:00-03:00`
      : `${dataInicio}T${horaInicio || "09:00"}:00-03:00`;
    const fimISO = diaInteiro
      ? `${dataFim || dataInicio}T23:59:59-03:00`
      : `${dataFim || dataInicio}T${horaFim || horaInicio || "10:00"}:00-03:00`;

    const unidadeInfo = UNIDADES_ALERTA.find((u) => u.value === alertaUnidade)!;
    const minutosAlerta = (alertaValor || 0) * unidadeInfo.multiplicador;
    const alertas = minutosAlerta > 0 ? [minutosAlerta] : [];

    let recorrenciaFimCalculada = recorrenciaFim;
    const numeroOcorrencias = parseInt(recorrenciaOcorrencias);
    if (recorrenciaTipo !== "nenhuma" && numeroOcorrencias > 0 && dataInicio) {
      const base = parseISO(dataInicio);
      const step = Math.max(1, recorrenciaIntervalo);
      const offset = (numeroOcorrencias - 1) * step;
      let fim = base;
      if (recorrenciaTipo === "daily") fim = addDays(base, offset);
      else if (recorrenciaTipo === "weekdays") {
        // Avança N-1 dias úteis (pula sábado e domingo)
        let count = 0;
        fim = base;
        while (count < offset) {
          fim = addDays(fim, 1);
          const dow = fim.getDay();
          if (dow !== 0 && dow !== 6) count++;
        }
      }
      else if (recorrenciaTipo === "weekly") fim = addWeeks(base, offset);
      else if (recorrenciaTipo === "monthly") fim = addMonths(base, offset);
      else if (recorrenciaTipo === "yearly") fim = addYears(base, offset);
      recorrenciaFimCalculada = format(fim, "yyyy-MM-dd");
    }

    const payload = {
      titulo: titulo.trim(),
      descricao: observacoes || undefined,
      tipo: "evento",
      status: situacao,
      concluido_em: situacao === "concluido" ? new Date().toISOString() : null,
      data_inicio: inicioISO,
      data_fim: fimISO,
      dia_inteiro: diaInteiro,
      local: local || undefined,
      modalidade: modalidade || undefined,
      processo_id: processoIdParaSalvar || undefined,
      coordenacao_id: coordenacaoId || null,
      participantes_ids: responsaveisIds,
      alerta_minutos: alertas,
      enviar_whatsapp: alertas.length > 0,
      recorrente: recorrenciaTipo !== "nenhuma",
      recorrencia_tipo: recorrenciaTipo !== "nenhuma" ? recorrenciaTipo : null,
      recorrencia_intervalo: recorrenciaTipo !== "nenhuma" ? recorrenciaIntervalo : null,
      recorrencia_fim: recorrenciaTipo !== "nenhuma" && recorrenciaFimCalculada ? recorrenciaFimCalculada : null,
      recorrencia_rrule: recorrenciaTipo !== "nenhuma"
        ? `FREQ=${recorrenciaTipo.toUpperCase()};INTERVAL=${recorrenciaIntervalo}${recorrenciaFimCalculada ? `;UNTIL=${recorrenciaFimCalculada.replace(/-/g, "")}T235959Z` : ""}`
        : null,
    } as any;

    try {
      if (isEditing && evento) {
        await updateEvento.mutateAsync({ id: evento.id, ...payload });
        await persistirRelacionamentos(evento.id);
        await anexosRef.current?.uploadPendentes(evento.id, processoIdParaSalvar);
        if (situacaoMudou && comentarioSituacao.trim() && user?.id) {
          const { error: comErr } = await supabase.from("comentarios_eventos").insert({
            evento_id: evento.id,
            autor_id: user.id,
            conteudo: `[Situação: ${situacaoInicial} → ${situacao}] ${comentarioSituacao.trim()}`,
          });
          if (comErr) console.error("Falha ao gravar comentário da situação:", comErr);
        }
        await registrarAuditoriaTarefa({
          acao: 'atualizar', sucesso: true,
          dadosEntrada: payload, dadosSaida: { id: evento.id },
          origem: 'evento_dialog', tipoItem: 'evento',
          itemId: evento.id, processoId: processoIdParaSalvar || undefined,
          coordenacaoId: coordenacaoId || null,
        });
      } else {
        const novo = await createEvento.mutateAsync(payload);
        if (novo?.id) await persistirRelacionamentos(novo.id);
        if (novo?.id) await anexosRef.current?.uploadPendentes(novo.id, processoIdParaSalvar);
        await registrarAuditoriaTarefa({
          acao: 'criar', sucesso: true,
          dadosEntrada: payload, dadosSaida: { id: novo?.id },
          origem: 'evento_dialog', tipoItem: 'evento',
          itemId: novo?.id, processoId: processoIdParaSalvar || undefined,
          coordenacaoId: coordenacaoId || null,
        });
        if (novo?.id && onAfterCreate) {
          try { onAfterCreate({ id: novo.id, titulo: payload.titulo || "Evento" }); }
          catch (err) { console.warn("onAfterCreate falhou:", err); }
        }
      }
      if (secondaryClickedRef.current) {
        try { await secondarySave?.onAfterSuccess(); }
        catch (err) { console.error("secondarySave.onAfterSuccess falhou:", err); }
        finally { secondaryClickedRef.current = false; }
      }
      const tertiaryWasClicked = tertiaryClickedRef.current;
      if (tertiaryWasClicked) {
        try { await tertiarySave?.onAfterSuccess(); }
        catch (err) { console.error("tertiarySave.onAfterSuccess falhou:", err); }
        finally { tertiaryClickedRef.current = false; }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] }),
        queryClient.invalidateQueries({ queryKey: ["eventos-agenda-processo"] }),
        queryClient.invalidateQueries({ queryKey: ["processo"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo"] }),
      ]);
      await invalidarItensAgenda(queryClient);
      // Análise DJEN: se onAfterCreate foi fornecido e o usuário clicou no
      // Salvar primário (não em "Salvar e fechar"), mantém o formulário aberto
      // e reseta para novo cadastro do mesmo tipo.
      const manterAbertoParaNovo = !isEditing && !!onAfterCreate && !tertiaryWasClicked;
      if (manterAbertoParaNovo) {
        toast.success("Evento salvo. Você pode cadastrar outro item para esta publicação.");
        resetFormForNew();
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Erro ao salvar evento:", error);
      await registrarAuditoriaTarefa({
        acao: isEditing ? 'erro_atualizar' : 'erro_criar',
        sucesso: false,
        dadosEntrada: payload,
        erroMensagem: (error as any)?.message,
        erroDetalhes: { code: (error as any)?.code, details: (error as any)?.details },
        origem: 'evento_dialog', tipoItem: 'evento',
        itemId: evento?.id, processoId: processoIdParaSalvar || undefined,
        coordenacaoId: coordenacaoId || null,
      });
    }
  };

  const handleAlterarStatus = async (status: "pendente" | "concluido" | "cancelado") => {
    if (!evento?.id) return;
    await updateEvento.mutateAsync({
      id: evento.id,
      status,
      concluido_em: status === "concluido" ? new Date().toISOString() : null,
    } as any);
    onOpenChange(false);
  };

  const isPending = createEvento.isPending || updateEvento.isPending;
  const hasPublicacao = !!publicacao;

  const dialogBody = (
    <div className={embedded ? "flex w-full flex-col" : "flex flex-1 min-h-0 w-full overflow-hidden flex-col"}>
          <div className={embedded ? "flex flex-col w-full" : "flex flex-col min-h-0 w-full flex-1"}>
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2 shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                Evento
              </h3>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Situação</Label>
                <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {situacoesDisponiveis("evento", { podeGerenciar: podeCancelar, atual: situacao }).filter((s) => s.value === situacao || (situacaoAtiva(s.value) && podeUsarSituacao(s.value))).map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  form="evento-form-content"
                  size="sm"
                  disabled={isPending}
                  onClick={() => { secondaryClickedRef.current = false; }}
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isEditing ? "Salvar" : "Criar evento"}
                </Button>
              {hasPublicacao && (
                <BotaoPreencherIA
                  conteudo={publicacao?.conteudo}
                  tipoTarefa="AUDIÊNCIA"
                  processoNumero={publicacao?.processo_numero}
                  dataPublicacao={publicacao?.data_publicacao}
                  size="sm"
                  onResultado={(resultado) => {
                    if (resultado.titulo) setTitulo(resultado.titulo);
                    if (resultado.descricao || resultado.observacoes) {
                      setObservacoes([resultado.descricao, resultado.observacoes].filter(Boolean).join("\n\n"));
                    }
                    if (resultado.data_vencimento) {
                      setDataInicio(resultado.data_vencimento);
                      setDataFim(resultado.data_vencimento);
                    }
                  }}
                />
              )}
              </div>
            </div>
            <ScrollAreaOrDiv embedded={embedded}>
              <form onSubmit={handleSubmit} className="space-y-5 pb-6" id="evento-form-content">
            {situacao !== situacaoInicial && (
              <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <Label className="text-xs font-semibold">
                  Comentário da mudança de situação{comentarioObrigatorio ? " (obrigatório)" : " (opcional)"}
                </Label>
                <Textarea
                  value={comentarioSituacao}
                  onChange={(e) => setComentarioSituacao(e.target.value)}
                  placeholder="Explique o motivo da mudança de situação..."
                  className="min-h-[64px] text-sm"
                />
              </div>
            )}
            {hasPublicacao && !hidePublicacaoCollapsible && (
              <PublicacaoVinculadaCollapsible publicacao={publicacao as any} />
            )}
            {/* Título */}
            <div>
              <Label htmlFor="titulo" className="text-sm">
                Título do evento <span className="text-destructive">*</span>
              </Label>
              <div className="mt-1 flex justify-end items-center gap-1.5">
                {evento?.id && (
                  <EtiquetaPicker
                    entidade="evento"
                    entidadeId={evento.id}
                    coordenacaoId={coordenacaoId}
                    compact
                  />
                )}
                <ModeloTituloPicker
                  tipo="evento"
                  coordenacaoId={coordenacaoId}
                  onSelect={(m) => {
                    setTitulo(m.titulo);
                    if (m.descricao) setObservacoes((prev) => prev || m.descricao || "");
                    const p = resolverPadroes(m);
                    if (p.observacoes) setObservacoes((prev) => prev || p.observacoes);
                    if (!travarDatas && p.data_inicio) setDataInicio((prev) => prev || p.data_inicio);
                    if (!travarDatas && p.hora_inicio) setHoraInicio((prev) => prev || p.hora_inicio);
                    if (!travarDatas && p.data_fim) setDataFim((prev) => prev || p.data_fim);
                    if (!travarDatas && p.hora_fim) setHoraFim((prev) => prev || p.hora_fim);
                    if (p.dia_inteiro === "true") setDiaInteiro(true);
                    if (p.local) setLocal((prev) => prev || p.local);
                    if (p.modalidade) setModalidade((prev) => prev || p.modalidade);
                    // Prazo pré-programado no modelo → data do evento a partir da
                    // data base (data da publicação, se houver, ou hoje)
                    const prazoCalculado = resolverPrazoModelo(
                      m,
                      (publicacao as any)?.data_publicacao || (publicacao as any)?.data_disponibilizacao || null,
                    );
                    if (prazoCalculado) {
                      // Modelo escolhido explicitamente: o prazo programado
                      // substitui as datas atuais do formulário.
                      if (!travarDatas && !p.data_inicio) setDataInicio(prazoCalculado);
                      if (!travarDatas && !p.data_fim) setDataFim(prazoCalculado);
                    }
                  }}
                />
              </div>
              <AutoResizeTextarea
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
                  disabled={travarDatas}
                  title={travarDatas ? motivoBloqueio : undefined}
                  className="flex-1"
                />
                {!diaInteiro && (
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    disabled={travarDatas}
                    title={travarDatas ? motivoBloqueio : undefined}
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
                    disabled={travarDatas}
                    title={travarDatas ? motivoBloqueio : undefined}
                    className="w-28"
                  />
                )}
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  disabled={travarDatas}
                  title={travarDatas ? motivoBloqueio : undefined}
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

            {/* Alertas — configurados no botão Notificações do Painel de Controle */}
            <AlertasConfigCard />

            {/* Responsáveis */}
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
                  lockedIds={coordenadoresIds}
                />
              </div>
              {coordenadoresIds.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Responsáveis fixos configurados para Outros não podem ser removidos.
                </p>
              )}
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

            {/* Coordenação (sempre visível para admin/multi) */}
            {precisaSelecionar && hasPublicacao && (
              <CoordenacaoSelect
                value={coordenacaoId}
                onChange={setCoordenacaoId}
                required
              />
            )}

            {/* Processo (opcional) — oculto quando vindo de uma publicação */}
            <div className={cn("border rounded-lg p-3 space-y-2", hasPublicacao && "hidden")}>
              {precisaSelecionar && !hasPublicacao && (
                <div className="pb-2 border-b mb-2">
                  <CoordenacaoSelect
                    value={coordenacaoId}
                    onChange={setCoordenacaoId}
                    required
                  />
                </div>
              )}
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vincular processo (opcional)
              </Label>
              {processoSelecionado ? (
                <div className="p-2 bg-muted/50 rounded space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm min-w-0">
                      <span className="font-medium">{processoSelecionado.numero}</span>
                      <span className="text-muted-foreground ml-2">
                        {processoSelecionado.polo_ativo} x {processoSelecionado.polo_passivo}
                      </span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setProcessoId("")}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <ProcessoResumoInline processoId={String(processoSelecionado.id)} />
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

            {/* Recorrência */}
            <div className="rounded-md border p-3 space-y-3">
              <Label className="text-sm font-medium">Recorrência</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Frequência</Label>
                  <Select
                    value={recorrenciaTipo}
                    disabled={travarDatas}
                    onValueChange={(value) => {
                      setRecorrenciaTipo(value);
                      setRecorrenciaIntervalo(1);
                    }}
                  >
                    <SelectTrigger className="mt-1" title={travarDatas ? motivoBloqueio : undefined}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Não se repete</SelectItem>
                      <SelectItem value="daily">Diariamente</SelectItem>
                      <SelectItem value="weekdays">Dias úteis (Seg–Sex)</SelectItem>
                      <SelectItem value="weekly">Semanalmente</SelectItem>
                      <SelectItem value="monthly">Mensalmente</SelectItem>
                      <SelectItem value="yearly">Anualmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recorrenciaTipo !== "nenhuma" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Quantas vezes deve aparecer?
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex.: 9"
                      value={recorrenciaOcorrencias}
                      disabled={travarDatas}
                      title={travarDatas ? motivoBloqueio : undefined}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRecorrenciaOcorrencias(v);
                        const n = parseInt(v);
                        if (n && n > 0 && dataInicio) {
                          const base = parseISO(dataInicio);
                          const offset = n - 1;
                          let fim = base;
                          if (recorrenciaTipo === "daily") fim = addDays(base, offset);
                          else if (recorrenciaTipo === "weekdays") {
                            let count = 0;
                            fim = base;
                            while (count < offset) {
                              fim = addDays(fim, 1);
                              const dow = fim.getDay();
                              if (dow !== 0 && dow !== 6) count++;
                            }
                          }
                          else if (recorrenciaTipo === "weekly") fim = addWeeks(base, offset);
                          else if (recorrenciaTipo === "monthly") fim = addMonths(base, offset);
                          else if (recorrenciaTipo === "yearly") fim = addYears(base, offset);
                          setRecorrenciaFim(format(fim, "yyyy-MM-dd"));
                        }
                      }}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
              {recorrenciaTipo !== "nenhuma" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Ou até a data</Label>
                    <Input
                      type="date"
                      value={recorrenciaFim}
                      onChange={(e) => {
                        setRecorrenciaFim(e.target.value);
                        setRecorrenciaOcorrencias("");
                      }}
                      disabled={travarDatas}
                      className="mt-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Ex.: para aparecer por 9 dias seguidos, escolha <strong>Diariamente</strong> e informe <strong>9</strong>.
                  </p>
                </div>
              )}
            </div>

            <ItemAbas
              ref={anexosRef}
              tipo="evento"
              tipoComentario="evento"
              itemId={evento?.id}
              processoId={processoId}
            />

            <div>
              <Label htmlFor="observacoes" className="text-sm">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Digite observações sobre o evento"
                rows={4}
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
              {isEditing && evento?.status !== "pendente" && (
                <Button type="button" variant="outline" onClick={() => handleAlterarStatus("pendente")} disabled={isPending} className="w-full sm:w-auto">
                  Reabrir
                </Button>
              )}
              <Button
                type="submit"
                disabled={isPending}
                className="w-full sm:w-auto"
                onClick={() => { secondaryClickedRef.current = false; tertiaryClickedRef.current = false; }}
              >
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar" : "Criar evento"}
              </Button>
              {secondarySave && !isEditing && (
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={isPending}
                  className="w-full sm:w-auto"
                  onClick={() => { secondaryClickedRef.current = true; }}
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {secondarySave.label}
                </Button>
              )}
              {tertiarySave && !isEditing && (
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={isPending}
                  className="w-full sm:w-auto"
                  onClick={() => { tertiaryClickedRef.current = true; }}
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {tertiarySave.label}
                </Button>
              )}
            </div>
          </form>
        </ScrollAreaOrDiv>
          </div>
        </div>
  );

  if (inline) {
    return (
      <div className={embedded ? "w-full flex flex-col bg-background" : "h-full w-full flex flex-col bg-background overflow-hidden"}>
        {dialogBody}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden flex flex-col",
          "w-[95vw] max-w-2xl h-[90vh] max-h-[90vh]"
        )}
        aria-describedby="evento-dialog-description"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Evento</DialogTitle>
          <p id="evento-dialog-description">Formulário para criar ou editar um evento na agenda</p>
        </DialogHeader>
        {dialogBody}
      </DialogContent>
    </Dialog>
  );
}
