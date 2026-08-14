import { useState, useMemo } from "react";
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
import { useProcessosPaginados } from "@/hooks/useProcessosPaginados";
import { Play, Search } from "lucide-react";
import { toast } from "sonner";

interface IniciarWorkflowDialogProps {
  workflowId?: string;
  workflowName?: string;
  preSelectedProcesso?: { id: string; numero: string; coordenacao_id?: string } | null;
  trigger?: React.ReactNode;
}

export function IniciarWorkflowDialog({
  workflowId: initialWorkflowId,
  workflowName: initialWorkflowName,
  preSelectedProcesso,
  trigger,
}: IniciarWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const { coordenacoes } = useCoordenacoesDoUsuario();
  const [coordenacaoId, setCoordenacaoId] = useState(preSelectedProcesso?.coordenacao_id || "");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(initialWorkflowId || "");
  const [search, setSearch] = useState("");
  const [selectedProcesso, setSelectedProcesso] = useState(preSelectedProcesso || null);
  const [responsavelInicial, setResponsavelInicial] = useState("");
  const [observacoes, setObservacoes] = useState("");

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

  const handleSubmit = async () => {
    if (!coordenacaoId) {
      toast.error("Selecione uma coordenação");
      return;
    }
    if (!selectedWorkflowId) {
      toast.error("Selecione um workflow");
      return;
    }
    await iniciar.mutateAsync({
      workflow_id: selectedWorkflowId,
      processo_id: selectedProcesso?.id,
      processo_numero: selectedProcesso?.numero,
      coordenacao_id: coordenacaoId,
      responsavel_inicial: responsavelInicial || undefined,
      observacoes: observacoes || undefined,
    });
    setOpen(false);
    reset();
  };

  const reset = () => {
    setCoordenacaoId(preSelectedProcesso?.coordenacao_id || "");
    setSelectedWorkflowId(initialWorkflowId || "");
    setSearch("");
    setSelectedProcesso(preSelectedProcesso || null);
    setResponsavelInicial("");
    setObservacoes("");
  };

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
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="coord">Coordenação *</Label>
            <Select
              value={coordenacaoId}
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
              <Label htmlFor="proc">Processo</Label>
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
            <Label htmlFor="resp">Responsável inicial (UUID)</Label>
            <Input
              id="resp"
              value={responsavelInicial}
              onChange={(e) => setResponsavelInicial(e.target.value)}
              placeholder="UUID do usuário (opcional)"
            />
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
          <Button
            onClick={handleSubmit}
            disabled={iniciar.isPending || !selectedWorkflowId}
            className="w-full"
          >
            {iniciar.isPending ? "Iniciando..." : "Iniciar execução"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
