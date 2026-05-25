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
import { CalendarIcon, Loader2, Search, Upload, FileText, Trash2, Plus, Link2, Users, Briefcase, ClipboardList } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, sanitizeFileName } from "@/lib/utils";
import { useCreatePrazo, useUpdatePrazo, type Prazo } from "@/hooks/usePrazos";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrlOrEmpty } from "@/utils/signedUrl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { TIPOS_TAREFA } from "@/constants/tiposTarefa";
import { Separator } from "@/components/ui/separator";

const CUSTOM_TIPOS_KEY = "tarefas_tipos_customizados_v1";

function loadCustomTipos(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TIPOS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveCustomTipo(tipo: string) {
  const list = loadCustomTipos();
  if (!list.includes(tipo)) {
    list.push(tipo);
    localStorage.setItem(CUSTOM_TIPOS_KEY, JSON.stringify(list));
  }
}

type PrazoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prazo?: Prazo | null;
  defaultProcessoId?: string;
  defaultTarefaRelacionadaId?: string;
};

export function PrazoDialog({
  open,
  onOpenChange,
  prazo,
  defaultProcessoId,
  defaultTarefaRelacionadaId,
}: PrazoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();
  const [prioridade, setPrioridade] = useState<string>("media");
  const [processoId, setProcessoId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Projuris-style fields
  const [tipoTarefa, setTipoTarefa] = useState<string>("");
  const [dataBase, setDataBase] = useState<Date | undefined>();
  const [dataFatal, setDataFatal] = useState<Date | undefined>();
  const [localLink, setLocalLink] = useState("");
  const [gruposTrabalho, setGruposTrabalho] = useState("");
  const [customTipos, setCustomTipos] = useState<string[]>(() => loadCustomTipos());
  const [showAddTipo, setShowAddTipo] = useState(false);
  const [novoTipo, setNovoTipo] = useState("");
  
  // Anexos
  const [anexos, setAnexos] = useState<File[]>([]);
  const [uploadingAnexos, setUploadingAnexos] = useState(false);
  
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
  const { data: clientes, isLoading: loadingClientes } = useQuery({
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

  // Buscar dados do processo atual quando editando
  const { data: processoAtual } = useQuery({
    queryKey: ["processo-atual-prazo", prazo?.processo_id],
    queryFn: async () => {
      if (!prazo?.processo_id) return null;
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, assunto, polo_ativo, polo_passivo, coordenacao_id, cliente_id")
        .eq("id", prazo.processo_id)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    enabled: open && !!prazo?.processo_id,
  });

  // Buscar processo padrão quando fornecido
  const { data: processoDefault, isLoading: loadingProcessoDefault } = useQuery({
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

  // Combinar processo atual/padrão com processos filtrados
  const processoBase = processoAtual || processoDefault;
  const processos = processoBase 
    ? [processoBase, ...(processosFiltrados?.filter(p => p.id !== processoBase.id) || [])]
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

  // Ao editar, pré-preencher filtros com base no processo vinculado (se houver)
  useEffect(() => {
    if (!open || !prazo || !processoAtual) return;

    if (!coordenacaoId && processoAtual.coordenacao_id) {
      setCoordenacaoId(processoAtual.coordenacao_id);
    }
    if (!clienteId && processoAtual.cliente_id) {
      setClienteId(processoAtual.cliente_id);
    }
  }, [open, prazo, processoAtual, coordenacaoId, clienteId]);

  useEffect(() => {
    if (prazo) {
      setTitulo(prazo.titulo);
      setDescricao(prazo.descricao || "");
      setDataVencimento(prazo.data_vencimento ? parseISO(prazo.data_vencimento) : undefined);
      setPrioridade(prazo.prioridade);
      setProcessoId(prazo.processo_id || "");
      setResponsavelId(prazo.responsavel_id || "");
      setObservacoes(prazo.observacoes || "");
      setAnexos([]);
      setTipoTarefa(prazo.tipo_tarefa || "");
      setDataBase(prazo.data_base ? parseISO(prazo.data_base) : undefined);
      setDataFatal(prazo.data_fatal ? parseISO(prazo.data_fatal) : undefined);
      setGruposTrabalho(prazo.grupos_trabalho || "");
      setLocalLink("");
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
      setAnexos([]);
      setTipoTarefa("");
      setDataBase(undefined);
      setDataFatal(undefined);
      setGruposTrabalho("");
      setLocalLink("");
    }
    setShowAddTipo(false);
    setNovoTipo("");
  }, [prazo, open, defaultProcessoId]);

  const showProcessoSelect = !!coordenacaoId || !!clienteId || searchProcesso.length >= 3 || !!processoDefault || !!processoAtual || !!defaultProcessoId;

  const handleSelectCliente = (value: string) => {
    if (value.startsWith("__")) return;
    setClienteId(value);
  };

  const handleAddAnexo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAnexos(prev => [...prev, ...Array.from(files)]);
    }
    e.target.value = '';
  };

  const handleRemoveAnexo = (index: number) => {
    setAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo || !dataVencimento) {
      return;
    }

    const prazoData = {
      titulo,
      descricao: descricao || undefined,
      data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
      prioridade: prioridade as "baixa" | "media" | "alta" | "urgente",
      processo_id: (processoId === "__none__" || !processoId) ? null : processoId,
      responsavel_id: responsavelId || undefined,
      observacoes: [
        observacoes?.trim(),
        localLink?.trim() ? `Local/Link: ${localLink.trim()}` : "",
      ].filter(Boolean).join("\n\n") || undefined,
      tipo_tarefa: tipoTarefa || null,
      data_base: dataBase ? format(dataBase, "yyyy-MM-dd") : null,
      data_fatal: dataFatal ? format(dataFatal, "yyyy-MM-dd") : null,
      grupos_trabalho: gruposTrabalho || null,
    };

    try {
      let novaTarefaId: string | null = null;
      
      if (prazo) {
        await updatePrazo.mutateAsync({ id: prazo.id, ...prazoData });
      } else {
        const result = await createPrazo.mutateAsync({
          ...prazoData,
          criado_por: user?.id,
        });
        novaTarefaId = result?.id || null;
      }

      // Se foi criada como tarefa relacionada, criar o vínculo
      if (novaTarefaId && defaultTarefaRelacionadaId && user?.id) {
        await supabase.from("tarefas_relacionadas").insert({
          tarefa_origem_id: defaultTarefaRelacionadaId,
          tarefa_relacionada_id: novaTarefaId,
          criado_por: user.id,
        });
      }

      // Upload de anexos se houver
      if (anexos.length > 0 && processoId) {
        setUploadingAnexos(true);
        for (const file of anexos) {
          const sanitizedName = sanitizeFileName(file.name);
          const fileName = `${processoId}/${Date.now()}_${sanitizedName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('documentos_processos')
            .upload(fileName, file);

          if (uploadError) {
            console.error("Erro ao fazer upload:", uploadError);
            toast.error(`Erro ao enviar ${file.name}`);
            continue;
          }

          const signedUrl = await getSignedUrlOrEmpty("documentos_processos", fileName);

          await supabase.from('documentos').insert({
            nome: file.name,
            tipo: file.type,
            url: signedUrl,
            tamanho_bytes: file.size,
            processo_id: processoId,
            uploaded_by: user?.id,
          });
        }
        setUploadingAnexos(false);
        queryClient.invalidateQueries({ queryKey: ["documentos-tarefa", processoId] });
        toast.success(`${anexos.length} documento(s) anexado(s)`);
      }

      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  };

  const isLoading = createPrazo.isPending || updatePrazo.isPending || uploadingAnexos;

  const allTipos = Array.from(new Set([...TIPOS_TAREFA, ...customTipos])).sort();

  const handleAddTipo = () => {
    const v = novoTipo.trim().toUpperCase();
    if (!v) {
      toast.error("Informe o nome do tipo");
      return;
    }
    saveCustomTipo(v);
    setCustomTipos(loadCustomTipos());
    setTipoTarefa(v);
    setNovoTipo("");
    setShowAddTipo(false);
    toast.success("Tipo adicionado");
  };

  const DatePickerField = ({
    value,
    onChange,
    placeholder = "Selecionar data",
  }: {
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
    placeholder?: string;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} locale={ptBR} className="pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {prazo ? "Alterar Tarefa" : "Nova Tarefa"}
              </DialogTitle>
              {prazo?.identificador_projuris && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {prazo.identificador_projuris}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-6 py-5">
            <div className="space-y-6">
              {/* SECTION: Vínculo */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Link2 className="h-3.5 w-3.5" />
                  Vínculo
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Coordenação</Label>
                    <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Filtrar por coordenação" /></SelectTrigger>
                      <SelectContent>
                        {coordenacoes?.map((coord) => (
                          <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cliente</Label>
                    <Select value={clienteId} onValueChange={handleSelectCliente}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
                      <SelectContent>
                        {loadingClientes ? (
                          <SelectItem value="__loading">Carregando clientes...</SelectItem>
                        ) : clientes?.length ? (
                          clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__empty">Nenhum cliente encontrado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Buscar processo</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchProcesso}
                      onChange={(e) => setSearchProcesso(e.target.value)}
                      placeholder="Digite 3+ caracteres para buscar..."
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Processo vinculado</Label>
                  {!showProcessoSelect ? (
                    <p className="text-xs text-muted-foreground p-2.5 border rounded-md bg-muted/40">
                      Selecione uma coordenação, cliente ou digite 3+ caracteres para buscar processos
                    </p>
                  ) : loadingProcessos || (defaultProcessoId && loadingProcessoDefault) ? (
                    <div className="flex items-center gap-2 p-2.5 border rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs text-muted-foreground">Carregando processos...</span>
                    </div>
                  ) : processos?.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2.5 border rounded-md bg-muted/40">
                      Nenhum processo encontrado com os filtros selecionados
                    </p>
                  ) : (
                    <Select value={processoId} onValueChange={setProcessoId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Sem vínculo com processo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem vínculo com processo</SelectItem>
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
              </section>

              <Separator />

              {/* SECTION: Detalhes */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Briefcase className="h-3.5 w-3.5" />
                  Detalhes da tarefa
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Tipo de tarefa *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setShowAddTipo((v) => !v)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Novo tipo
                      </Button>
                    </div>
                    <Select value={tipoTarefa} onValueChange={setTipoTarefa}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="h-[260px]">
                          {allTipos.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    {showAddTipo && (
                      <div className="flex gap-2 pt-1">
                        <Input
                          value={novoTipo}
                          onChange={(e) => setNovoTipo(e.target.value)}
                          placeholder="Nome do novo tipo"
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddTipo();
                            }
                          }}
                        />
                        <Button type="button" size="sm" className="h-8" onClick={handleAddTipo}>
                          Adicionar
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Título</Label>
                    <Input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Título opcional (usa o tipo se vazio)"
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data base</Label>
                    <DatePickerField value={dataBase} onChange={setDataBase} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data prevista *</Label>
                    <DatePickerField value={dataVencimento} onChange={setDataVencimento} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data fatal</Label>
                    <DatePickerField value={dataFatal} onChange={setDataFatal} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Local / Link</Label>
                  <Input
                    value={localLink}
                    onChange={(e) => setLocalLink(e.target.value)}
                    placeholder="Endereço, sala, link da videoconferência..."
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Descreva os detalhes da tarefa..."
                    rows={3}
                  />
                </div>
              </section>

              <Separator />

              {/* SECTION: Atribuição */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Users className="h-3.5 w-3.5" />
                  Atribuição
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Responsável *</Label>
                    <Select value={responsavelId} onValueChange={setResponsavelId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                      <SelectContent>
                        {advogados?.map((advogado) => (
                          <SelectItem key={advogado.id} value={advogado.id}>{advogado.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Grupos de trabalho</Label>
                    <Input
                      value={gruposTrabalho}
                      onChange={(e) => setGruposTrabalho(e.target.value)}
                      placeholder="Ex: Trabalhista, Cível..."
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prioridade *</Label>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações adicionais..."
                    rows={2}
                  />
                </div>
              </section>

              {/* SECTION: Anexos */}
              {processoId && (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <FileText className="h-3.5 w-3.5" />
                        Documentos em anexo
                      </div>
                      <div className="relative">
                        <input
                          type="file"
                          id="anexos-prazo-upload"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleAddAnexo}
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                        />
                        <Button type="button" variant="outline" size="sm" className="pointer-events-none h-8">
                          <Upload className="w-3 h-3 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </div>
                    {anexos.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3 border rounded-md bg-muted/30">
                        Nenhum documento anexado
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {anexos.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded-md text-sm bg-background">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-primary shrink-0" />
                              <span className="truncate">{file.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => handleRemoveAnexo(index)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploadingAnexos ? "Enviando anexos..." : prazo ? "Salvar" : "Criar Tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}