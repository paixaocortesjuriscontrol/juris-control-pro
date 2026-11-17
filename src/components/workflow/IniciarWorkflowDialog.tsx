import { useState, useMemo, useEffect } from "react";
import { vincularItemPublicacao } from "@/lib/vincularItemPublicacao";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useIniciarWorkflow, useWorkflows } from "@/hooks/useWorkflows";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { useUsuariosCoordenacao } from "@/hooks/useUsuariosCoordenacao";
import { useProcessosPaginados } from "@/hooks/useProcessosPaginados";
import { Play, Search, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import type { ItemCriado } from "@/components/shared/ItensCriadosPublicacaoCard";
import { supabase } from "@/integrations/supabase/client";
import {
  WORKFLOW_ITEM_LABELS,
  type SobrescritaEtapa,
  type WorkflowItemType,
} from "@/lib/workflowExecutor";

type EtapaModelo = {
  id: string;
  titulo: string;
  ordem: number;
  tipo_item: WorkflowItemType;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  descricao?: string | null;
  dias_previsto: number;
  dias_fatal?: number | null;
  tipo_prazo: "dias_corridos" | "dias_uteis";
};

const PRIORIDADES: { valor: SobrescritaEtapa["prioridade"]; rotulo: string }[] = [
  { valor: "baixa", rotulo: "Baixa" },
  { valor: "media", rotulo: "Média" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "urgente", rotulo: "Urgente" },
];

interface IniciarWorkflowDialogProps {
  workflowId?: string;
  workflowName?: string;
  preSelectedProcesso?: { id: string; numero: string; coordenacao_id?: string } | null;
  trigger?: React.ReactNode;
  /** Renderiza o formulário direto na página, sem abrir janela/popup */
  inline?: boolean;
  /** Lista todos os workflows acessíveis e usa a coordenação do fluxo escolhido. */
  listarTodosWorkflows?: boolean;
  onDone?: () => void;
  publicacaoOrigem?: PublicacaoUnificada | null;
  onStarted?: (item: { id: string; titulo: string; tipo: ItemCriado["tipo"] }) => void | Promise<void>;
}

export function IniciarWorkflowDialog({
  workflowId: initialWorkflowId,
  workflowName: initialWorkflowName,
  preSelectedProcesso,
  trigger,
  inline,
  listarTodosWorkflows = false,
  onDone,
  publicacaoOrigem,
  onStarted,
}: IniciarWorkflowDialogProps) {
  const dataBaseInicial =
    String(publicacaoOrigem?.data_publicacao || publicacaoOrigem?.data_disponibilizacao || "").slice(0, 10) ||
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [open, setOpen] = useState(!!inline);
  const { coordenacoes, unicaCoordenacaoId, precisaSelecionar } = useCoordenacoesDoUsuario();
  const [coordenacaoId, setCoordenacaoId] = useState(preSelectedProcesso?.coordenacao_id || unicaCoordenacaoId || "");

  // Coordenação única chega de forma assíncrona: vincula automaticamente quando carregar
  useEffect(() => {
    if (!preSelectedProcesso && unicaCoordenacaoId) {
      setCoordenacaoId((atual) => atual || unicaCoordenacaoId);
    }
  }, [unicaCoordenacaoId, preSelectedProcesso]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(initialWorkflowId || "");
  const [search, setSearch] = useState("");
  const [selectedProcesso, setSelectedProcesso] = useState(preSelectedProcesso || null);
  const [responsavelInicial, setResponsavelInicial] = useState("");
  
  const [observacoes, setObservacoes] = useState("");
  const [respEtapas, setRespEtapas] = useState<Record<string, string[]>>({});
  // O que foi alterado etapa por etapa nesta execução (o modelo não muda).
  const [edicoesEtapas, setEdicoesEtapas] = useState<Record<string, SobrescritaEtapa>>({});
  const [envEtapas, setEnvEtapas] = useState<Record<string, string[]>>({});
  const [envModelo, setEnvModelo] = useState<Record<string, string[]>>({});
  const [etapasWf, setEtapasWf] = useState<EtapaModelo[]>([]);
  useEffect(() => {
    setRespEtapas({});
    setEdicoesEtapas({});
    setEnvEtapas({});
    setEnvModelo({});
    if (!selectedWorkflowId) { setEtapasWf([]); return; }
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("workflow_etapas")
        .select("id, titulo, ordem, tipo_item, prioridade, descricao, dias_previsto, dias_fatal, tipo_prazo")
        .eq("workflow_id", selectedWorkflowId)
        .order("ordem");
      if (!ativo) return;
      const etapas = ((data as any[]) || []) as EtapaModelo[];
      setEtapasWf(etapas);
      const ids = etapas.map((e) => e.id);
      if (!ids.length) return;
      const { data: ev } = await supabase
        .from("workflow_etapa_envolvidos")
        .select("etapa_id, usuario_id")
        .in("etapa_id", ids);
      if (!ativo) return;
      const mapa: Record<string, string[]> = {};
      ((ev as any[]) || []).forEach((r) => {
        if (!mapa[r.etapa_id]) mapa[r.etapa_id] = [];
        mapa[r.etapa_id].push(r.usuario_id);
      });
      setEnvModelo(mapa);
      setEnvEtapas(mapa);
    })();
    return () => { ativo = false; };
  }, [selectedWorkflowId]);
  const [dataInicio, setDataInicio] = useState(dataBaseInicial);

  useEffect(() => {
    if (publicacaoOrigem) setDataInicio(dataBaseInicial);
  }, [publicacaoOrigem?.id, dataBaseInicial]);


  const { data: usuarios = [] } = useUsuariosCoordenacao(coordenacaoId || undefined);


  const { data: processosData } = useProcessosPaginados({
    search,
    coordenacao_id: coordenacaoId || "all",
    enabled: open && search.length >= 3 && !preSelectedProcesso,
  });
  const processos = useMemo(() => processosData?.processos || [], [processosData]);

  const { data: workflows = [], isLoading: carregandoWorkflows } = useWorkflows({
    coordenacaoId: listarTodosWorkflows ? undefined : coordenacaoId || undefined,
    ativo: true,
  });

  const selectedWorkflow = useMemo(
    () => workflows?.find((w: any) => w.id === selectedWorkflowId),
    [workflows, selectedWorkflowId]
  );

  /**
   * Só envia o que mudou em relação ao modelo; o resto segue o padrão do fluxo.
   */
  const sobrescritas = useMemo(() => {
    const out: Record<string, SobrescritaEtapa> = {};
    const num = (v: any) =>
      v === null || v === undefined || v === "" ? null : Number.isNaN(Number(v)) ? null : Number(v);
    for (const et of etapasWf) {
      const ed = edicoesEtapas[et.id] || {};
      const s: SobrescritaEtapa = {};
      const titulo = String(ed.titulo ?? et.titulo ?? "").trim();
      if (titulo && titulo !== et.titulo) s.titulo = titulo;
      const tipo = ed.tipo_item || et.tipo_item;
      if (tipo && tipo !== et.tipo_item) s.tipo_item = tipo;
      const prio = ed.prioridade || et.prioridade;
      if (prio && prio !== et.prioridade) s.prioridade = prio;
      const prev = num(ed.dias_previsto ?? et.dias_previsto ?? 0) ?? 0;
      if (prev !== (num(et.dias_previsto) ?? 0)) s.dias_previsto = prev;
      const fatal = ed.dias_fatal === undefined ? num(et.dias_fatal) : num(ed.dias_fatal);
      if (fatal !== num(et.dias_fatal)) s.dias_fatal = fatal;
      const unid = ed.tipo_prazo || et.tipo_prazo;
      if (unid && unid !== et.tipo_prazo) s.tipo_prazo = unid;
      const desc = ed.descricao === undefined ? (et.descricao ?? "") : ed.descricao;
      if (desc !== (et.descricao ?? "")) s.descricao = desc;
      const env = envEtapas[et.id] || [];
      const envMod = envModelo[et.id] || [];
      if (env.slice().sort().join(",") !== envMod.slice().sort().join(",")) s.envolvidos = env;
      if (Object.keys(s).length) out[et.id] = s;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(etapasWf),
    JSON.stringify(edicoesEtapas),
    JSON.stringify(envEtapas),
    JSON.stringify(envModelo),
  ]);

  const editarEtapa = (etapaId: string, campo: keyof SobrescritaEtapa, valor: any) =>
    setEdicoesEtapas((atual) => ({
      ...atual,
      [etapaId]: { ...(atual[etapaId] || {}), [campo]: valor },
    }));

  const iniciar = useIniciarWorkflow();

  const vincularPrimeiroItemAPublicacao = async (item: { id: string; tipo: string }) => {
    if (!publicacaoOrigem?.id) return;
    await vincularItemPublicacao(item, { tipo: publicacaoOrigem.tipo_origem, id: publicacaoOrigem.id });
  };

  const handleSubmit = async () => {
    if (!coordenacaoId) {
      toast.error("Selecione uma coordenação");
      return;
    }
    if (!selectedWorkflowId) {
      toast.error("Selecione um workflow");
      return;
    }
    if (publicacaoOrigem && !selectedProcesso?.id) {
      toast.error("Workflow criado a partir de publicação exige processo vinculado.");
      return;
    }
    if (!selectedProcesso?.id) {
      toast.warning("O workflow será iniciado sem processo vinculado.");
    }
    const resultado = await iniciar.mutateAsync({
      workflow_id: selectedWorkflowId,

      processo_id: selectedProcesso?.id,
      processo_numero: selectedProcesso?.numero,
      coordenacao_id: coordenacaoId,
      responsavel_inicial: responsavelInicial || undefined,
      responsaveis_etapas: Object.fromEntries(
        Object.entries(respEtapas).filter(([, v]) => Array.isArray(v) && v.length > 0)
      ),
      sobrescritas_etapas: Object.keys(sobrescritas).length ? sobrescritas : undefined,
      observacoes: observacoes || undefined,
      data_inicio: dataInicio || undefined,
      publicacao_origem_tipo: publicacaoOrigem?.tipo_origem,
      publicacao_origem_id: publicacaoOrigem?.id,
    });
    // Todas as etapas iniciais recebem a publicação de origem (não só a primeira)
    const itensIniciais = ((resultado as any).itens?.length ? (resultado as any).itens : resultado.item ? [resultado.item] : []) as { id: string; tipo: string; titulo: string }[];
    for (const it of itensIniciais) {
      try {
        await vincularPrimeiroItemAPublicacao(it);
      } catch (e) {
        console.error("Falha ao vincular publicação ao item do workflow", e);
      }
    }
    for (const it of itensIniciais) {
      await onStarted?.(it as { id: string; titulo: string; tipo: ItemCriado["tipo"] });
    }
    if (!inline) setOpen(false);
    reset();
    onDone?.();
  };

  const reset = () => {
    setCoordenacaoId(preSelectedProcesso?.coordenacao_id || unicaCoordenacaoId || "");
    setSelectedWorkflowId(initialWorkflowId || "");
    setSearch("");
    setSelectedProcesso(preSelectedProcesso || null);
    setResponsavelInicial("");
    setRespEtapas({});
    setEdicoesEtapas({});
    setEnvEtapas({});


    setObservacoes("");
    setDataInicio(dataBaseInicial);
  };

  const body = (
    <div className="space-y-4 py-4">
          {precisaSelecionar || preSelectedProcesso ? (
            <div className="space-y-2">
              <Label htmlFor="coord">Coordenação *</Label>
              <Select
                value={coordenacaoId}
                disabled={!!preSelectedProcesso}
                onValueChange={(v) => {
                  setCoordenacaoId(v);
                  setSelectedProcesso(null);
                  if (!initialWorkflowId) setSelectedWorkflowId("");
                }}
              >
                <SelectTrigger id="coord">
                  <SelectValue placeholder="Selecione a coordenação" />
                </SelectTrigger>
                <SelectContent>
                  {coordenacoes?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Coordenação: {coordenacoes?.[0]?.nome || "carregando..."}
            </p>
          )}

          {!initialWorkflowId && (
            <div className="space-y-2">
              <Label htmlFor="workflow">Workflow *</Label>
              <Select
                value={selectedWorkflowId}
                onValueChange={(workflowSelecionadoId) => {
                  setSelectedWorkflowId(workflowSelecionadoId);
                  if (listarTodosWorkflows) {
                    const workflowSelecionado = workflows.find((workflow: any) => workflow.id === workflowSelecionadoId);
                    if (workflowSelecionado?.coordenacao_id) {
                      setCoordenacaoId(workflowSelecionado.coordenacao_id);
                    }
                  }
                }}
                disabled={!listarTodosWorkflows && !coordenacaoId}
              >
                <SelectTrigger id="workflow">
                  <SelectValue placeholder="Selecione o workflow" />
                </SelectTrigger>
                <SelectContent>
                  {carregandoWorkflows ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">Carregando workflows...</div>
                  ) : workflows.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      Nenhum workflow ativo nesta coordenação.
                    </div>
                  ) : (
                    workflows.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.nome}{listarTodosWorkflows && w.coordenacao?.nome ? ` — ${w.coordenacao.nome}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {!preSelectedProcesso && (
            <div className="space-y-2">
              <Label htmlFor="proc">Processo (opcional)</Label>


              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="proc"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por número ou parte (mín. 3 caracteres)"
                  className="pl-9"
                />
              </div>
              {selectedProcesso && (
                <div className="rounded-md border p-2 text-sm flex justify-between items-center">
                  <span className="font-medium">{selectedProcesso.numero}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProcesso(null)}
                  >
                    Trocar
                  </Button>
                </div>
              )}
              {!selectedProcesso && search.length >= 3 && (
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {processos.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Nenhum processo encontrado
                    </div>
                  ) : (
                    processos.map((p: any) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-b-0"
                        onClick={() => setSelectedProcesso(p)}
                      >
                        <div className="font-medium">{p.numero}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.assunto || p.polo_ativo || ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {preSelectedProcesso && (
            <div className="rounded-md border p-2 text-sm">
              <span className="font-medium">Processo: {preSelectedProcesso.numero}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="resp">Responsável inicial</Label>
            <Select
              value={responsavelInicial || ""}
              onValueChange={(v) => setResponsavelInicial(v || "")}
              disabled={!coordenacaoId}
            >
              <SelectTrigger id="resp">
                <SelectValue placeholder="Selecione um usuário (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome} {u.cargo ? `(${u.cargo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {etapasWf.length > 0 && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1">
                <Label>Etapas — revise antes de criar</Label>
                <p className="text-xs text-muted-foreground">
                  Cada etapa abre com os dados do modelo. O que você mudar aqui vale só para esta
                  execução; o modelo continua igual.
                </p>
              </div>
              {etapasWf.map((et, i) => {
                const ed = edicoesEtapas[et.id] || {};
                return (
                  <div key={et.id} className="space-y-2 rounded-md border bg-muted/20 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Etapa {i + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <Select
                          value={String(ed.tipo_item || et.tipo_item)}
                          onValueChange={(v) => editarEtapa(et.id, "tipo_item", v as WorkflowItemType)}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(WORKFLOW_ITEM_LABELS).map(([valor, rotulo]) => (
                              <SelectItem key={valor} value={valor} className="text-xs">
                                {rotulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(ed.prioridade || et.prioridade || "media")}
                          onValueChange={(v) => editarEtapa(et.id, "prioridade", v)}
                        >
                          <SelectTrigger className="h-7 w-[100px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORIDADES.map((p) => (
                              <SelectItem key={String(p.valor)} value={String(p.valor)} className="text-xs">
                                {p.rotulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Input
                      value={ed.titulo ?? et.titulo}
                      onChange={(e) => editarEtapa(et.id, "titulo", e.target.value)}
                      aria-label={`Título da etapa ${i + 1}`}
                      className="h-8 text-sm"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        Previsto em
                        <Input
                          type="number"
                          min={0}
                          value={String(ed.dias_previsto ?? et.dias_previsto ?? 0)}
                          onChange={(e) => editarEtapa(et.id, "dias_previsto", e.target.value === "" ? 0 : Number(e.target.value))}
                          className="h-7 w-16 text-xs"
                          aria-label={`Dias previstos da etapa ${i + 1}`}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        fatal em
                        <Input
                          type="number"
                          min={0}
                          value={
                            ed.dias_fatal === undefined
                              ? et.dias_fatal == null
                                ? ""
                                : String(et.dias_fatal)
                              : ed.dias_fatal == null
                                ? ""
                                : String(ed.dias_fatal)
                          }
                          onChange={(e) =>
                            editarEtapa(et.id, "dias_fatal", e.target.value === "" ? null : Number(e.target.value))
                          }
                          className="h-7 w-16 text-xs"
                          aria-label={`Dias fatais da etapa ${i + 1}`}
                        />
                      </label>
                      <Select
                        value={String(ed.tipo_prazo || et.tipo_prazo || "dias_corridos")}
                        onValueChange={(v) => editarEtapa(et.id, "tipo_prazo", v)}
                      >
                        <SelectTrigger className="h-7 w-[112px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dias_corridos" className="text-xs">
                            corridos
                          </SelectItem>
                          <SelectItem value="dias_uteis" className="text-xs">
                            úteis
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Responsáveis</span>
                        <MultiSelecaoPessoas
                          pessoas={usuarios}
                          valores={respEtapas[et.id] || []}
                          onChange={(ids) => setRespEtapas((a) => ({ ...a, [et.id]: ids }))}
                          disabled={!coordenacaoId}
                          placeholder="Padrão do modelo"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Envolvidos</span>
                        <MultiSelecaoPessoas
                          pessoas={usuarios}
                          valores={envEtapas[et.id] || []}
                          onChange={(ids) => setEnvEtapas((a) => ({ ...a, [et.id]: ids }))}
                          disabled={!coordenacaoId}
                          placeholder="Nenhum"
                        />
                      </div>
                    </div>

                    <Textarea
                      value={ed.descricao ?? et.descricao ?? ""}
                      onChange={(e) => editarEtapa(et.id, "descricao", e.target.value)}
                      placeholder="Descrição da etapa"
                      aria-label={`Descrição da etapa ${i + 1}`}
                      className="min-h-[54px] text-sm"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="data-inicio">
              {publicacaoOrigem ? "Data-base da publicação" : "Data de início da execução"}
            </Label>
            <Input
              id="data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {publicacaoOrigem
                ? "Os prazos serão contados a partir desta data, como no cadastro normal."
                : "Se ficar em branco, assume a data de hoje."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
      {publicacaoOrigem && !selectedProcesso?.id && (
        <p className="text-xs text-destructive rounded-md border border-destructive/40 bg-destructive/10 p-2">
          Para iniciar um workflow a partir de publicação, <strong>selecione o processo</strong>.
        </p>
      )}
      {!publicacaoOrigem && !selectedProcesso?.id && !preSelectedProcesso && (
        <p className="text-xs text-amber-600 dark:text-amber-500 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2">
          Atenção: o workflow será iniciado <strong>sem processo vinculado</strong>. Os itens criados ficarão sem processo no Painel de Controle.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={iniciar.isPending || !selectedWorkflowId || (!!publicacaoOrigem && !selectedProcesso?.id)}
          className={inline ? "" : "w-full"}
        >
          {iniciar.isPending ? "Iniciando..." : "Iniciar execução"}
        </Button>
        {inline && onDone && (
          <Button variant="outline" onClick={onDone}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="h-full min-h-0 overflow-y-auto p-4">
        {initialWorkflowName && (
          <p className="mb-2 text-sm font-semibold">
            Workflow: {initialWorkflowName}
          </p>
        )}
        {body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-2" />
            Iniciar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Iniciar Workflow{initialWorkflowName ? `: ${initialWorkflowName}` : ""}
          </DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Seletor de várias pessoas da coordenação para uma etapa do workflow.
 * Lista vazia significa "Padrão do modelo": a etapa segue a configuração do fluxo.
 */
function MultiSelecaoPessoas({
  pessoas,
  valores,
  onChange,
  disabled,
  placeholder,
}: {
  pessoas: { id: string; nome: string; cargo?: string | null }[];
  valores: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const selecionados = pessoas.filter((p) => valores.includes(p.id));
  const filtro = busca.trim().toLowerCase();
  const visiveis = filtro
    ? pessoas.filter(
        (p) =>
          p.nome.toLowerCase().includes(filtro) ||
          String(p.cargo || "").toLowerCase().includes(filtro)
      )
    : pessoas;

  const alternar = (id: string) =>
    onChange(valores.includes(id) ? valores.filter((v) => v !== id) : [...valores, id]);

  return (
    <Popover
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (!o) setBusca("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={cn("truncate", selecionados.length === 0 && "text-muted-foreground")}>
            {selecionados.length === 0
              ? placeholder
              : selecionados.map((p) => p.nome).join(", ")}
          </span>
          {selecionados.length > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
              {selecionados.length}
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <Command filter={null}>
          <CommandInput placeholder="Buscar pessoa..." value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-56">
            <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
            <CommandGroup>
              {visiveis.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => alternar(p.id)}
                  className="gap-2"
                >
                  <Checkbox checked={valores.includes(p.id)} className="pointer-events-none" />
                  <span className="truncate">{p.nome}</span>
                  {p.cargo && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{p.cargo}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between border-t p-2">
          <span className="text-xs text-muted-foreground">
            {valores.length === 0 ? "Padrão do modelo" : `${valores.length} pessoa(s) selecionada(s)`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange([])}
            disabled={valores.length === 0}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
