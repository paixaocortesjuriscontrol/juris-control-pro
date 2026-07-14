import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Loader2, FileText, Tag, AlertTriangle } from "lucide-react";
import { format, parseISO, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCreatePrazo, useUpdatePrazo, type Prazo } from "@/hooks/usePrazos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import { BotaoPreencherIA } from "@/components/tarefas/BotaoPreencherIA";
import { CoordenacaoSelect } from "@/components/shared/CoordenacaoSelect";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { AlertasConfigCard } from "@/components/shared/AlertasConfigCard";

type Unidade = "uteis" | "corridos";

function addBusinessDays(start: Date, days: number): Date {
  let remaining = days;
  const d = new Date(start);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

function subBusinessDays(start: Date, days: number): Date {
  let remaining = days;
  const d = new Date(start);
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

function computeDataLimite(base: Date | undefined, dias: number, unidade: Unidade): Date | undefined {
  if (!base || !dias || dias <= 0) return undefined;
  return unidade === "uteis" ? addBusinessDays(base, dias) : addDays(base, dias);
}

type PrazoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prazo?: Prazo | null;
  defaultProcessoId?: string;
  defaultTarefaRelacionadaId?: string;
  publicacao?: PublicacaoUnificada | null;
  inline?: boolean;
  secondarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
};

export function PrazoDialog({
  open,
  onOpenChange,
  prazo,
  defaultProcessoId,
  defaultTarefaRelacionadaId,
  publicacao,
  inline = false,
  secondarySave,
}: PrazoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createPrazo = useCreatePrazo();
  const updatePrazo = useUpdatePrazo();
  const secondaryClickedRef = useRef(false);
  const { precisaSelecionar, unicaCoordenacaoId } = useCoordenacoesDoUsuario();

  // Quando editando um prazo existente, carregar publicação vinculada (se houver)
  // para mostrar no card esquerdo do dialog.
  const { data: publicacaoVinculada } = useQuery({
    queryKey: ["prazo-publicacao-vinculada", prazo?.id],
    enabled: !!prazo?.id && open && !publicacao,
    queryFn: async (): Promise<PublicacaoUnificada | null> => {
      if (!prazo?.id) return null;
      // 1) vínculo com publicacoes_djen (termo)
      const { data: vTermo } = await supabase
        .from("tarefas_publicacoes")
        .select("publicacao_id")
        .eq("tarefa_id", prazo.id)
        .maybeSingle();
      if (vTermo?.publicacao_id) {
        const { data: p } = await supabase
          .from("publicacoes_djen")
          .select("*")
          .eq("id", vTermo.publicacao_id)
          .maybeSingle();
        if (p) {
          return {
            id: p.id,
            tipo_origem: "termo",
            processo_id: (p as any).processo_id ?? null,
            processo_numero: (p as any).processo_numero ?? null,
            conteudo: (p as any).conteudo ?? null,
            data_publicacao: (p as any).data_publicacao ?? null,
            data_disponibilizacao: (p as any).data_disponibilizacao ?? null,
            fonte: (p as any).fonte ?? null,
            lida: true,
            created_at: (p as any).created_at ?? new Date().toISOString(),
            monitoramento_id: (p as any).monitoramento_id ?? null,
            monitoramento_termo: null,
            monitoramento_descricao: null,
            monitoramento_tipo: null,
            monitoramento_oab: null,
            monitoramento_uf: null,
            coordenacao_id: null,
            coordenacao_nome: null,
            polo_ativo: (p as any).polo_ativo ?? null,
            polo_passivo: (p as any).polo_passivo ?? null,
            tribunal: (p as any).tribunal ?? null,
            tipo_comunicacao: (p as any).tipo_comunicacao ?? null,
          } as PublicacaoUnificada;
        }
      }
      // 2) vínculo com publicacoes_djen_processos
      const { data: vProc } = await supabase
        .from("tarefas_publicacoes_processos")
        .select("publicacao_processo_id")
        .eq("tarefa_id", prazo.id)
        .maybeSingle();
      if (vProc?.publicacao_processo_id) {
        const { data: p } = await supabase
          .from("publicacoes_djen_processos")
          .select("*")
          .eq("id", vProc.publicacao_processo_id)
          .maybeSingle();
        if (p) {
          return {
            id: p.id,
            tipo_origem: "processo",
            processo_id: (p as any).processo_id ?? null,
            processo_numero: (p as any).processo_numero ?? null,
            conteudo: (p as any).conteudo ?? null,
            data_publicacao: (p as any).data_publicacao ?? null,
            data_disponibilizacao: (p as any).data_disponibilizacao ?? null,
            fonte: (p as any).fonte ?? null,
            lida: true,
            created_at: (p as any).created_at ?? new Date().toISOString(),
            monitoramento_id: null,
            monitoramento_termo: null,
            monitoramento_descricao: null,
            monitoramento_tipo: null,
            monitoramento_oab: null,
            monitoramento_uf: null,
            coordenacao_id: null,
            coordenacao_nome: null,
            polo_ativo: (p as any).polo_ativo ?? null,
            polo_passivo: (p as any).polo_passivo ?? null,
            tribunal: (p as any).tribunal ?? null,
            tipo_comunicacao: (p as any).tipo_comunicacao ?? null,
          } as PublicacaoUnificada;
        }
      }
      return null;
    },
  });

  const publicacaoEfetiva = publicacao || publicacaoVinculada || null;

  const [titulo, setTitulo] = useState("");
  const [prazoDias, setPrazoDias] = useState<number>(0);
  const [prazoUnidade, setPrazoUnidade] = useState<Unidade>("uteis");
  const [dataLimite, setDataLimite] = useState<Date | undefined>(undefined);
  const [dataLimiteEditadaManualmente, setDataLimiteEditadaManualmente] = useState(false);
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const [mostrarEnvolvidos, setMostrarEnvolvidos] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [dataFatal, setDataFatal] = useState<Date | undefined>(undefined);
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [situacao, setSituacao] = useState<"pendente" | "cumprido" | "cancelado">("pendente");
  // Recorrência
  const [recorrenciaTipo, setRecorrenciaTipo] = useState<string>("nenhuma");
  const [recorrenciaIntervalo, setRecorrenciaIntervalo] = useState<number>(1);
  const [recorrenciaOcorrencias, setRecorrenciaOcorrencias] = useState<string>("");
  const [recorrenciaFim, setRecorrenciaFim] = useState<string>("");

  // data base = data da publicação (se houver) ou hoje
  const dataBase = useMemo<Date>(() => {
    if (publicacaoEfetiva?.data_disponibilizacao) {
      try { return parseISO(publicacaoEfetiva.data_disponibilizacao); } catch {}
    }
    if (publicacaoEfetiva?.data_publicacao) {
      try { return parseISO(publicacaoEfetiva.data_publicacao); } catch {}
    }
    return new Date();
  }, [publicacaoEfetiva?.data_disponibilizacao, publicacaoEfetiva?.data_publicacao]);

  // Reset / preload state on open
  useEffect(() => {
    if (!open) return;
    if (prazo) {
      setTitulo(prazo.titulo || "");
      setPrazoDias((prazo as any).prazo_dias ?? 0);
      setPrazoUnidade(((prazo as any).prazo_unidade as Unidade) || "uteis");
      setDataLimite(prazo.data_vencimento ? parseISO(prazo.data_vencimento) : undefined);
      setDataLimiteEditadaManualmente(true);
      setObservacoes(prazo.observacoes || "");
      setDataFatal((prazo as any).data_fatal ? parseISO((prazo as any).data_fatal) : undefined);
      setCoordenacaoId(((prazo as any).coordenacao_id as string) || "");
      setSituacao(((prazo as any).status as any) || "pendente");
      setRecorrenciaTipo(((prazo as any).recorrencia_tipo as string) || "nenhuma");
      setRecorrenciaIntervalo(((prazo as any).recorrencia_intervalo as number) || 1);
      setRecorrenciaFim(((prazo as any).recorrencia_fim ? String((prazo as any).recorrencia_fim).slice(0, 10) : ""));
      setRecorrenciaOcorrencias("");
      (async () => {
        const processoId = defaultProcessoId || prazo.processo_id;
        const [{ data: resps }, { data: envs }, { data: proc }] = await Promise.all([
          supabase.from("tarefa_responsaveis").select("usuario_id").eq("tarefa_id", prazo.id),
          supabase.from("tarefa_envolvidos").select("usuario_id").eq("tarefa_id", prazo.id),
          processoId
            ? supabase.from("processos").select("coordenacao_id").eq("id", processoId).maybeSingle()
            : Promise.resolve({ data: null } as any),
        ]);
        const respIds = (resps || []).map((r: any) => r.usuario_id);
        setResponsaveisIds(respIds.length > 0 ? respIds : (prazo.responsavel_id ? [prazo.responsavel_id] : []));
        const envIds = (envs || []).map((e: any) => e.usuario_id);
        setEnvolvidosIds(envIds);
        setMostrarEnvolvidos(envIds.length > 0);
        setCoordenacaoId((prev) => prev || (proc as any)?.coordenacao_id || unicaCoordenacaoId || "");
      })();
    } else {
      setTitulo("");
      setPrazoDias(0);
      setPrazoUnidade("uteis");
      setDataLimite(undefined);
      setDataLimiteEditadaManualmente(false);
      setResponsaveisIds([]);
      setEnvolvidosIds([]);
      setMostrarEnvolvidos(false);
      setObservacoes("");
      setDataFatal(undefined);
      setCoordenacaoId(unicaCoordenacaoId || "");
      setSituacao("pendente");
      setRecorrenciaTipo("nenhuma");
      setRecorrenciaIntervalo(1);
      setRecorrenciaOcorrencias("");
      setRecorrenciaFim("");
    }
  }, [open, prazo?.id, unicaCoordenacaoId]);

  // Auto-calcular data limite quando Prazo (dias) muda
  useEffect(() => {
    if (prazo) return;
    if (dataLimiteEditadaManualmente) return;
    const calc = computeDataLimite(dataBase, prazoDias, prazoUnidade);
    setDataLimite(calc);
  }, [prazo, prazoDias, prazoUnidade, dataBase, dataLimiteEditadaManualmente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tituloFinal = titulo.trim();
    if (!tituloFinal) {
      toast.error("Informe o título do prazo");
      return;
    }
    if (!dataLimite) {
      toast.error("Informe a data limite");
      return;
    }
    if (responsaveisIds.length === 0) {
      toast.error("Selecione ao menos um responsável");
      return;
    }
    if (precisaSelecionar && !coordenacaoId) {
      toast.error("Selecione a coordenação");
      return;
    }

    const payload = {
      titulo: tituloFinal,
      data_vencimento: format(dataLimite, "yyyy-MM-dd"),
      prioridade: "media" as const,
      processo_id: defaultProcessoId || prazo?.processo_id || null,
      responsavel_id: responsaveisIds[0],
      observacoes: observacoes.trim() || undefined,
      status: situacao,
      data_cumprimento: situacao === "cumprido" ? new Date().toISOString() : null,
      // Preserva o tipo original quando estamos editando uma tarefa/prazo
      // existente. Só fixa "PRAZO" quando é uma criação nova a partir deste
      // diálogo. Isso impede que editar uma tarefa via TarefaDetalhesPanel
      // (que reaproveita este diálogo) converta silenciosamente a tarefa
      // em PRAZO e a faça sumir da lista de tarefas.
      tipo_tarefa: prazo?.tipo_tarefa || "PRAZO",
      data_base: format(dataBase, "yyyy-MM-dd"),
      prazo_dias: prazoDias > 0 ? prazoDias : null,
      prazo_unidade: prazoDias > 0 ? prazoUnidade : null,
      alerta_dias: null,
      alerta_unidade: null,
      data_fatal: dataFatal ? format(dataFatal, "yyyy-MM-dd") : null,
      coordenacao_id: coordenacaoId || null,
      recorrente: recorrenciaTipo !== "nenhuma",
      recorrencia_tipo: recorrenciaTipo !== "nenhuma" ? recorrenciaTipo : null,
      recorrencia_intervalo: recorrenciaTipo !== "nenhuma" ? recorrenciaIntervalo : null,
      recorrencia_fim: recorrenciaTipo !== "nenhuma" && recorrenciaFim ? recorrenciaFim : null,
      recorrencia_rrule:
        recorrenciaTipo !== "nenhuma"
          ? `FREQ=${recorrenciaTipo.toUpperCase()};INTERVAL=${recorrenciaIntervalo}${
              recorrenciaFim ? `;UNTIL=${recorrenciaFim.replace(/-/g, "")}T235959Z` : ""
            }`
          : null,
    };

    try {
      let tarefaId: string | null = null;
      if (prazo) {
        await updatePrazo.mutateAsync({ id: prazo.id, ...payload });
        tarefaId = prazo.id;
      } else {
        const result = await createPrazo.mutateAsync({ ...payload, criado_por: user?.id });
        tarefaId = result?.id || null;
      }

      if (tarefaId) {
        // Atualizar coordenação do processo, se alterada
        const processoId = defaultProcessoId || prazo?.processo_id;
        if (processoId && coordenacaoId) {
          await supabase
            .from("processos")
            .update({ coordenacao_id: coordenacaoId })
            .eq("id", processoId);
        }

        await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", tarefaId);
        if (responsaveisIds.length > 0) {
          await supabase.from("tarefa_responsaveis").insert(
            responsaveisIds.map((uid) => ({ tarefa_id: tarefaId!, usuario_id: uid }))
          );
        }
        await supabase.from("tarefa_envolvidos").delete().eq("tarefa_id", tarefaId);
        if (envolvidosIds.length > 0) {
          await supabase.from("tarefa_envolvidos").insert(
            envolvidosIds.map((uid) => ({ tarefa_id: tarefaId!, usuario_id: uid }))
          );
        }

        if (defaultTarefaRelacionadaId && user?.id && !prazo) {
          await supabase.from("tarefas_relacionadas").insert({
            tarefa_origem_id: defaultTarefaRelacionadaId,
            tarefa_relacionada_id: tarefaId,
            criado_por: user.id,
          });
        }

        // Vincular à publicação (se aplicável)
        if (publicacao?.id && !prazo) {
          try {
            if (publicacao.tipo_origem === "termo") {
              await supabase.from("tarefas_publicacoes").insert({
                tarefa_id: tarefaId,
                publicacao_id: publicacao.id,
              });
            } else if (publicacao.tipo_origem === "processo") {
              await supabase.from("tarefas_publicacoes_processos").insert({
                tarefa_id: tarefaId,
                publicacao_processo_id: publicacao.id,
              });
            }
          } catch (err) {
            console.warn("Falha ao vincular prazo à publicação", err);
          }
        }
      }

      // Invalidar caches de processos para que processos recém-criados/atualizados
      // pelo botão "Adicionar" da Análise DJEN apareçam na tela Processos sem refresh.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] }),
        queryClient.invalidateQueries({ queryKey: ["processos"] }),
        queryClient.invalidateQueries({ queryKey: ["processos-paginados"] }),
        queryClient.invalidateQueries({ queryKey: ["pastas"] }),
      ]);

      if (secondaryClickedRef.current) {
        try { await secondarySave?.onAfterSuccess(); }
        catch (err) { console.error("secondarySave.onAfterSuccess falhou:", err); }
        finally { secondaryClickedRef.current = false; }
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar prazo: " + error.message);
    }
  };

  const handleAlterarStatus = async (status: "pendente" | "cumprido" | "cancelado") => {
    if (!prazo?.id) return;
    await updatePrazo.mutateAsync({
      id: prazo.id,
      status: status as any,
      data_cumprimento: status === "cumprido" ? new Date().toISOString() : null,
    });
    onOpenChange(false);
  };

  const isLoading = createPrazo.isPending || updatePrazo.isPending;
  const hasPublicacao = !!publicacaoEfetiva;

  const FormContent = (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
            Prazo
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Situação</Label>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">⏳ Pendente</SelectItem>
                <SelectItem value="cumprido">✔️ Cumprido</SelectItem>
                <SelectItem value="cancelado">❌ Cancelado</SelectItem>
              </SelectContent>
            </Select>
          {hasPublicacao ? (
            <BotaoPreencherIA
              conteudo={publicacaoEfetiva?.conteudo}
              tipoTarefa="PRAZO"
              processoNumero={publicacaoEfetiva?.processo_numero}
              dataPublicacao={publicacaoEfetiva?.data_publicacao}
              size="sm"
              onResultado={(resultado) => {
                if (resultado.titulo) setTitulo(resultado.titulo);
                if (resultado.observacoes) setObservacoes(resultado.observacoes);
                const dias = (resultado as any).dias_prazo as number | undefined;
                if (dias && dias > 0) {
                  setPrazoDias(dias);
                  setPrazoUnidade("uteis");
                  setDataLimiteEditadaManualmente(false);
                } else if (resultado.data_vencimento) {
                  try {
                    setDataLimite(parseISO(resultado.data_vencimento));
                    setDataLimiteEditadaManualmente(true);
                  } catch {}
                }
              }}
            />
          ) : (
            <Tag className="h-4 w-4 text-muted-foreground" />
          )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">
            Título do prazo<span className="text-destructive">*</span>
          </Label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Digite o título do prazo"
            className="h-10"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Prazo</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={prazoDias}
                onChange={(e) => {
                  const dias = parseInt(e.target.value || "0", 10);
                  setPrazoDias(dias);
                  if (prazo) setDataLimite(computeDataLimite(dataBase, dias, prazoUnidade));
                  setDataLimiteEditadaManualmente(false);
                }}
                className="h-10 w-20"
              />
              <Select
                value={prazoUnidade}
                onValueChange={(v) => {
                  const unidade = v as Unidade;
                  setPrazoUnidade(unidade);
                  if (prazo) setDataLimite(computeDataLimite(dataBase, prazoDias, unidade));
                  setDataLimiteEditadaManualmente(false);
                }}
              >
                <SelectTrigger className="h-10 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uteis">Dias úteis</SelectItem>
                  <SelectItem value="corridos">Dias corridos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">
              Data limite<span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-10 w-full justify-start text-left font-normal",
                    !dataLimite && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataLimite ? format(dataLimite, "dd/MM/yyyy", { locale: ptBR }) : "__/__/____"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataLimite}
                  onSelect={(d) => {
                    setDataLimite(d);
                    setDataLimiteEditadaManualmente(true);
                  }}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Alerta</Label>
          <div className="flex gap-2 max-w-xs">
            <Input
              type="number"
              min={0}
              value={alertaDias}
              onChange={(e) => setAlertaDias(parseInt(e.target.value || "0", 10))}
              className="h-10 w-20"
            />
            <Select value={alertaUnidade} onValueChange={(v) => setAlertaUnidade(v as Unidade)}>
              <SelectTrigger className="h-10 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corridos">Dia(s) antes</SelectItem>
                <SelectItem value="uteis">Dia(s) úteis antes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              Prazo Fatal
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-10 w-full justify-start text-left font-normal",
                    !dataFatal && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFatal ? format(dataFatal, "dd/MM/yyyy", { locale: ptBR }) : "__/__/____"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFatal}
                  onSelect={(d) => setDataFatal(d)}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          {precisaSelecionar && (
            <CoordenacaoSelect
              value={coordenacaoId}
              onChange={setCoordenacaoId}
              className="space-y-1.5"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">
            Responsáveis<span className="text-destructive">*</span>
          </Label>
          <PeoplePicker
            selectedIds={responsaveisIds}
            onChange={setResponsaveisIds}
            placeholder="Adicionar responsável"
            emptyLabel="Nenhum responsável selecionado"
          />
          {!mostrarEnvolvidos && (
            <button
              type="button"
              onClick={() => setMostrarEnvolvidos(true)}
              className="text-xs text-primary hover:underline"
            >
              + Envolver mais pessoas
            </button>
          )}
        </div>

        {mostrarEnvolvidos && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Envolvidos (acompanham)</Label>
              <button
                type="button"
                onClick={() => {
                  setMostrarEnvolvidos(false);
                  setEnvolvidosIds([]);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ocultar
              </button>
            </div>
            <PeoplePicker
              selectedIds={envolvidosIds}
              onChange={setEnvolvidosIds}
              placeholder="Adicionar envolvido"
              emptyLabel="Apenas para acompanhamento"
              icon="users"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-sm">Observações</Label>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Digite observações sobre o prazo"
            rows={4}
          />
        </div>

      </div>

      <div className="flex justify-end gap-2 px-5 py-3 border-t bg-muted/30">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        {prazo?.id && (prazo.status as string) !== "cancelado" && (
          <Button type="button" variant="destructive" onClick={() => handleAlterarStatus("cancelado")} disabled={isLoading}>
            Cancelar prazo
          </Button>
        )}
        {prazo?.id && prazo.status !== "pendente" && (
          <Button type="button" variant="outline" onClick={() => handleAlterarStatus("pendente")} disabled={isLoading}>
            Reabrir
          </Button>
        )}
        {prazo?.id && prazo.status !== "cumprido" && (
          <Button type="button" variant="outline" onClick={() => handleAlterarStatus("cumprido")} disabled={isLoading}>
            Concluir
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading}
          onClick={() => { secondaryClickedRef.current = false; }}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
        {secondarySave && !prazo?.id && (
          <Button
            type="submit"
            variant="secondary"
            disabled={isLoading}
            onClick={() => { secondaryClickedRef.current = true; }}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {secondarySave.label}
          </Button>
        )}
      </div>
    </form>
  );

  if (inline) {
    if (!hasPublicacao) {
      return <div className="h-full flex flex-col bg-background overflow-hidden">{FormContent}</div>;
    }
    return (
      <div className="rounded-md border bg-background overflow-hidden flex flex-col lg:flex-row min-h-[70vh] max-h-[calc(100vh-12rem)]">
        <div className="hidden lg:flex flex-1 border-r flex-col min-h-0">
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Publicação
              </span>
            </div>
            <div className="space-y-1 text-sm">
              {publicacaoEfetiva?.processo_numero && (
                <div className="font-mono text-xs">
                  {aplicarMascaraCnj(publicacaoEfetiva.processo_numero)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {publicacaoEfetiva?.data_publicacao && (
                  <span>
                    Publicado em{" "}
                    {format(parseISO(publicacaoEfetiva.data_publicacao), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                )}
                {publicacaoEfetiva?.tribunal && <Badge variant="outline">{publicacaoEfetiva.tribunal}</Badge>}
                {publicacaoEfetiva?.tipo_comunicacao && (
                  <Badge variant="outline">{publicacaoEfetiva.tipo_comunicacao}</Badge>
                )}
              </div>
              {(publicacaoEfetiva?.polo_ativo || publicacaoEfetiva?.polo_passivo) && (
                <div className="text-xs text-muted-foreground pt-1">
                  {publicacaoEfetiva?.polo_ativo}{" "}
                  {publicacaoEfetiva?.polo_passivo ? `× ${publicacaoEfetiva.polo_passivo}` : ""}
                </div>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className={cn("text-sm", conteudoDisplayClasses)}>
              {formatConteudoParaExibicao(publicacaoEfetiva?.conteudo || "")}
            </div>
          </ScrollArea>
        </div>
        <div className="w-full lg:w-[480px] flex flex-col bg-background min-h-0">
          {FormContent}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden flex flex-col",
          hasPublicacao ? "max-w-5xl w-[95vw] h-[88vh]" : "sm:max-w-[640px] max-h-[92vh]"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Prazo</DialogTitle>
        </DialogHeader>

        {hasPublicacao ? (
          <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Left card: publicação */}
            <div className="hidden lg:flex flex-1 border-r flex-col min-h-0">
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Publicação
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {publicacaoEfetiva?.processo_numero && (
                    <div className="font-mono text-xs">{aplicarMascaraCnj(publicacaoEfetiva.processo_numero)}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {publicacaoEfetiva?.data_publicacao && (
                      <span>
                        Publicado em{" "}
                        {format(parseISO(publicacaoEfetiva.data_publicacao), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                    {publicacaoEfetiva?.tribunal && <Badge variant="outline">{publicacaoEfetiva.tribunal}</Badge>}
                    {publicacaoEfetiva?.tipo_comunicacao && (
                      <Badge variant="outline">{publicacaoEfetiva.tipo_comunicacao}</Badge>
                    )}
                  </div>
                  {(publicacaoEfetiva?.polo_ativo || publicacaoEfetiva?.polo_passivo) && (
                    <div className="text-xs text-muted-foreground pt-1">
                      {publicacaoEfetiva?.polo_ativo} {publicacaoEfetiva?.polo_passivo ? `× ${publicacaoEfetiva.polo_passivo}` : ""}
                    </div>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className={cn("text-sm", conteudoDisplayClasses)}>
                  {formatConteudoParaExibicao(publicacaoEfetiva?.conteudo || "")}
                </div>
              </ScrollArea>
            </div>

            {/* Right: form */}
            <div className="w-full lg:w-[480px] flex flex-col bg-background min-h-0">
              {FormContent}
            </div>
          </div>
        ) : (
          FormContent
        )}
      </DialogContent>
    </Dialog>
  );
}