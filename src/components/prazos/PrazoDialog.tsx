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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCreatePrazo, useUpdatePrazo, type Prazo } from "@/hooks/usePrazos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";

type PrazoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prazo?: Prazo | null;
  defaultProcessoId?: string;
};

export function PrazoDialog({
  open,
  onOpenChange,
  prazo,
  defaultProcessoId,
}: PrazoDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();
  const [prioridade, setPrioridade] = useState<string>("media");
  const [processoId, setProcessoId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  
  // Filtros para processos
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [searchProcesso, setSearchProcesso] = useState("");

  const createPrazo = useCreatePrazo();
  const updatePrazo = useUpdatePrazo();

  // Buscar coordenações
  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-prazo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Buscar clientes (filtrados por coordenação se selecionada)
  const { data: clientes } = useQuery({
    queryKey: ["clientes-prazo", coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from("clientes")
        .select("id, nome")
        .order("nome");
      
      // Se tiver coordenação, buscar apenas clientes com processos nessa coordenação
      if (coordenacaoId) {
        const { data: processosIds } = await supabase
          .from("processos")
          .select("cliente_id")
          .eq("coordenacao_id", coordenacaoId)
          .not("cliente_id", "is", null);
        
        const clienteIds = [...new Set(processosIds?.map(p => p.cliente_id).filter(Boolean) || [])];
        if (clienteIds.length > 0) {
          query = query.in("id", clienteIds);
        } else {
          return [];
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Buscar processo padrão quando fornecido
  const { data: processoDefault } = useQuery({
    queryKey: ["processo-default", defaultProcessoId],
    queryFn: async () => {
      if (!defaultProcessoId) return null;
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, assunto, polo_ativo, polo_passivo")
        .eq("id", defaultProcessoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!defaultProcessoId && !prazo,
  });

  // Buscar processos filtrados (só carrega quando tiver pelo menos um filtro)
  const { data: processosFiltrados, isLoading: loadingProcessos } = useQuery({
    queryKey: ["processos-prazo", coordenacaoId, clienteId, searchProcesso],
    queryFn: async () => {
      let query = supabase
        .from("processos")
        .select("id, numero, assunto, polo_ativo, polo_passivo")
        .order("numero")
        .limit(50);
      
      if (coordenacaoId) {
        query = query.eq("coordenacao_id", coordenacaoId);
      }
      if (clienteId) {
        query = query.eq("cliente_id", clienteId);
      }
      if (searchProcesso.length >= 3) {
        query = query.or(`numero.ilike.%${searchProcesso}%,polo_ativo.ilike.%${searchProcesso}%,polo_passivo.ilike.%${searchProcesso}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open && (!!coordenacaoId || !!clienteId || searchProcesso.length >= 3),
  });

  // Combinar processo padrão com processos filtrados
  const processos = processoDefault 
    ? [processoDefault, ...(processosFiltrados?.filter(p => p.id !== processoDefault.id) || [])]
    : processosFiltrados;

  const { data: advogados } = useQuery({
    queryKey: ["advogados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Resetar cliente quando trocar coordenação
  useEffect(() => {
    setClienteId("");
    setProcessoId("");
  }, [coordenacaoId]);

  useEffect(() => {
    if (prazo) {
      setTitulo(prazo.titulo);
      setDescricao(prazo.descricao || "");
      setDataVencimento(prazo.data_vencimento ? parseISO(prazo.data_vencimento) : undefined);
      setPrioridade(prazo.prioridade);
      setProcessoId(prazo.processo_id);
      setResponsavelId(prazo.responsavel_id || "");
      setObservacoes(prazo.observacoes || "");
    } else {
      setTitulo("");
      setDescricao("");
      setDataVencimento(undefined);
      setPrioridade("media");
      setProcessoId(defaultProcessoId || "");
      setResponsavelId("");
      setObservacoes("");
      setCoordenacaoId("");
      setClienteId("");
      setSearchProcesso("");
    }
  }, [prazo, open, defaultProcessoId]);

  const showProcessoSelect = !!coordenacaoId || !!clienteId || searchProcesso.length >= 3 || !!processoDefault;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo || !dataVencimento || !processoId) {
      return;
    }

    const prazoData = {
      titulo,
      descricao: descricao || undefined,
      data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
      prioridade: prioridade as "baixa" | "media" | "alta" | "urgente",
      processo_id: processoId,
      responsavel_id: responsavelId || undefined,
      observacoes: observacoes || undefined,
    };

    if (prazo) {
      await updatePrazo.mutateAsync({ id: prazo.id, ...prazoData });
    } else {
      await createPrazo.mutateAsync(prazoData);
    }

    onOpenChange(false);
  };

  const isLoading = createPrazo.isPending || updatePrazo.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {prazo ? "Editar Prazo" : "Novo Prazo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Contestação, Recurso, Audiência..."
              required
            />
          </div>

          {/* Filtros para seleção de processo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Coordenação</Label>
              <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por coordenação" />
                </SelectTrigger>
                <SelectContent>
                  {coordenacoes?.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId} disabled={!coordenacaoId && clientes?.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Buscar Processo</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchProcesso}
                onChange={(e) => setSearchProcesso(e.target.value)}
                placeholder="Digite 3+ caracteres para buscar..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="processo">Processo *</Label>
            {!showProcessoSelect ? (
              <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                Selecione uma coordenação, cliente ou digite 3+ caracteres para buscar processos
              </p>
            ) : loadingProcessos ? (
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando processos...</span>
              </div>
            ) : processos?.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                Nenhum processo encontrado com os filtros selecionados
              </p>
            ) : (
              <Select value={processoId} onValueChange={setProcessoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o processo" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {processos?.map((processo) => (
                      <SelectItem key={processo.id} value={processo.id}>
                        {processo.numero} - {processo.polo_ativo || processo.assunto || "Sem assunto"}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataVencimento && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimento
                      ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataVencimento}
                    onSelect={setDataVencimento}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade *</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {advogados?.map((advogado) => (
                  <SelectItem key={advogado.id} value={advogado.id}>
                    {advogado.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva os detalhes do prazo..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {prazo ? "Salvar" : "Criar Prazo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
