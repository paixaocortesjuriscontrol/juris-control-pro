import { useState, useMemo, useEffect } from "react";
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
import { Play, Search } from "lucide-react";
import { toast } from "sonner";
import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import type { ItemCriado } from "@/components/shared/ItensCriadosPublicacaoCard";
import { supabase } from "@/integrations/supabase/client";

interface IniciarWorkflowDialogProps {
  workflowId?: string;
  workflowName?: string;
  preSelectedProcesso?: { id: string; numero: string; coordenacao_id?: string } | null;
  trigger?: React.ReactNode;
  /** Renderiza o formulário direto na página, sem abrir janela/popup */
  inline?: boolean;
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
  onDone,
  publicacaoOrigem,
  onStarted,
}: IniciarWorkflowDialogProps) {
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
  const hoje = new Date().toISOString().split("T")[0];
  const [dataInicio, setDataInicio] = useState(hoje);


  const { data: usuarios = [] } = useUsuariosCoordenacao(coordenacaoId || undefined);


  const { data: processosData } = useProcessosPaginados({
    search,
    coordenacao_id: coordenacaoId || "all",
    enabled: open && search.length >= 3 && !preSelectedProcesso,
  });
  const processos = useMemo(() => processosData?.processos || [], [processosData]);

  const { data: workflows } = useWorkflows({
    coordenacaoId: coordenacaoId || undefined,
    ativo: true,
  });

  const selectedWorkflow = useMemo(
    () => workflows?.find((w: any) => w.id === selectedWorkflowId),
    [workflows, selectedWorkflowId]
  );

  const iniciar = useIniciarWorkflow();

  const vincularPrimeiroItemAPublicacao = async (item: { id: string; tipo: string }) => {
    if (!publicacaoOrigem?.id) return;
    const tipo = item.tipo.toLowerCase();
    if (tipo === "tarefa" || tipo === "prazo") {
      if (publicacaoOrigem.tipo_origem === "termo") {
        const { error } = await supabase.from("tarefas_publicacoes").insert({
          tarefa_id: item.id,
          publicacao_id: publicacaoOrigem.id,
        });
        if (error) throw error;
      } else if (publicacaoOrigem.tipo_origem === "processo") {
        const { error } = await supabase.from("tarefas_publicacoes_processos").insert({
          tarefa_id: item.id,
          publicacao_processo_id: publicacaoOrigem.id,
        });
        if (error) throw error;
      }
    } else if (tipo === "audiencia") {
      if (publicacaoOrigem.tipo_origem === "termo") {
        const { error } = await supabase.from("audiencias_publicacoes").insert({
          audiencia_id: item.id,
          publicacao_id: publicacaoOrigem.id,
        });
        if (error) throw error;
      } else if (publicacaoOrigem.tipo_origem === "processo") {
        const { error } = await supabase.from("audiencias_publicacoes_processos").insert({
          audiencia_id: item.id,
          publicacao_processo_id: publicacaoOrigem.id,
        });
        if (error) throw error;
      } else if (publicacaoOrigem.tipo_origem === "descartada") {
        const { error } = await supabase.from("audiencias_publicacoes_descartadas").insert({
          audiencia_id: item.id,
          publicacao_descartada_id: publicacaoOrigem.id,
        });
        if (error) throw error;
      }
    }
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
    const resultado = await iniciar.mutateAsync({
      workflow_id: selectedWorkflowId,

      processo_id: selectedProcesso?.id,
      processo_numero: selectedProcesso?.numero,
      coordenacao_id: coordenacaoId,
      responsavel_inicial: responsavelInicial || undefined,
      observacoes: observacoes || undefined,
      data_inicio: dataInicio || undefined,
      publicacao_origem_tipo: publicacaoOrigem?.tipo_origem,
      publicacao_origem_id: publicacaoOrigem?.id,
    });
    if (resultado.item) {
      await vincularPrimeiroItemAPublicacao(resultado.item);
      await onStarted?.(resultado.item as { id: string; titulo: string; tipo: ItemCriado["tipo"] });
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


    setObservacoes("");
    setDataInicio(hoje);
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
                onValueChange={setSelectedWorkflowId}
                disabled={!coordenacaoId}
              >
                <SelectTrigger id="workflow">
                  <SelectValue placeholder="Selecione o workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows?.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.nome}
                    </SelectItem>
                  ))}
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
          <div className="space-y-2">
            <Label htmlFor="data-inicio">Data de início da execução</Label>
            <Input
              id="data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se ficar em branco, assume a data de hoje. A primeira etapa é criada
              nesta data; dias previstos e prazo fatal são orientativos.
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
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={iniciar.isPending || !selectedWorkflowId}
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
      <div>
        <p className="text-sm font-semibold">
          Iniciar Workflow{initialWorkflowName ? `: ${initialWorkflowName}` : ""}
        </p>
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
      <DialogContent className="sm:max-w-md">
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
