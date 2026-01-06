import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sanitizeFileName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MentionInput } from "@/components/ui/mention-input";
import { VincularTarefaDialog } from "@/components/delegacao/VincularTarefaDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ExternalLink,
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  ListChecks,
  MessageSquare,
  FileText,
  Upload,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TarefaDetalhesDialogProps {
  tarefa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function TarefaDetalhesDialog({
  tarefa,
  open,
  onOpenChange,
  onUpdate,
}: TarefaDetalhesDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [comentario, setComentario] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [tarefasRelacionadasOpen, setTarefasRelacionadasOpen] = useState(false);
  const [documentosOpen, setDocumentosOpen] = useState(false);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const [comentariosOpen, setComentariosOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [vincularTarefaOpen, setVincularTarefaOpen] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Verifica se o usuário atual é o criador da tarefa
  const isCreator = user?.id === tarefa?.criado_por;

  // Fetch comentários
  const { data: comentarios, isLoading: loadingComentarios } = useQuery({
    queryKey: ["comentarios-tarefa", tarefa?.id],
    queryFn: async () => {
      if (!tarefa?.id) return [];
      const { data, error } = await supabase
        .from("comentarios_tarefas")
        .select(`
          id,
          conteudo,
          created_at,
          autor:profiles!comentarios_prazos_autor_id_fkey(id, nome)
        `)
        .eq("tarefa_id", tarefa.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tarefa?.id && open,
  });

  // Fetch tarefas relacionadas (direto + mesmo processo)
  const { data: tarefasRelacionadas, isLoading: loadingRelacionadas } = useQuery({
    queryKey: ["tarefas-relacionadas", tarefa?.id, tarefa?.processo?.id],
    queryFn: async () => {
      if (!tarefa?.id) return [];

      // 1. Buscar relacionamentos diretos (tabela tarefas_relacionadas)
      const { data: relacionamentosDiretos, error: errRel } = await supabase
        .from("tarefas_relacionadas")
        .select("tarefa_relacionada_id")
        .eq("tarefa_origem_id", tarefa.id);

      if (errRel) throw errRel;

      // 2. Buscar relacionamentos inversos (onde esta tarefa é a relacionada)
      const { data: relacionamentosInversos, error: errInv } = await supabase
        .from("tarefas_relacionadas")
        .select("tarefa_origem_id")
        .eq("tarefa_relacionada_id", tarefa.id);

      if (errInv) throw errInv;

      // 3. Coletar IDs de tarefas relacionadas
      const idsRelacionados = new Set<string>();
      relacionamentosDiretos?.forEach(r => idsRelacionados.add(r.tarefa_relacionada_id));
      relacionamentosInversos?.forEach(r => idsRelacionados.add(r.tarefa_origem_id));

      // 4. Se tiver processo, buscar tarefas do mesmo processo
      if (tarefa.processo?.id) {
        const { data: tarefasProcesso, error: errProc } = await supabase
          .from("tarefas")
          .select("id")
          .eq("processo_id", tarefa.processo.id)
          .neq("id", tarefa.id)
          .limit(20);

        if (!errProc && tarefasProcesso) {
          tarefasProcesso.forEach(t => idsRelacionados.add(t.id));
        }
      }

      if (idsRelacionados.size === 0) return [];

      // 5. Buscar detalhes das tarefas relacionadas
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          status,
          prioridade,
          data_vencimento,
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `)
        .in("id", Array.from(idsRelacionados))
        .order("data_vencimento", { ascending: true })
        .limit(15);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tarefa?.id && open,
  });

  // Fetch documentos (por processo OU por tarefa)
  const { data: documentos, isLoading: loadingDocumentos } = useQuery({
    queryKey: ["documentos-tarefa", tarefa?.id, tarefa?.processo?.id],
    queryFn: async () => {
      if (!tarefa?.id) return [];

      const orFilters: string[] = [`tarefa_id.eq.${tarefa.id}`];
      if (tarefa?.processo?.id) {
        orFilters.push(`processo_id.eq.${tarefa.processo.id}`);
      }

      const { data, error } = await supabase
        .from("documentos")
        .select("id, nome, tipo, url, tamanho_bytes, created_at")
        .or(orFilters.join(","))
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tarefa?.id && open,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getStatusInfo = () => {
    if (tarefa?.status === "cumprido") {
      return {
        label: "Concluído",
        icon: CheckCircle2,
        className: "bg-green-500 text-white",
      };
    }
    if (tarefa?.isAtrasado) {
      return {
        label: "Atrasada",
        icon: AlertTriangle,
        className: "bg-red-500 text-white",
      };
    }
    return {
      label: "Pendente",
      icon: Clock,
      className: "bg-blue-500 text-white",
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  const handleConcluir = async () => {
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: "cumprido",
          data_cumprimento: new Date().toISOString(),
        })
        .eq("id", tarefa.id);

      if (error) throw error;

      toast({ title: "Tarefa concluída!" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao concluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReabrir = async () => {
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: "pendente",
          data_cumprimento: null,
        })
        .eq("id", tarefa.id);

      if (error) throw error;

      toast({ title: "Tarefa reaberta!" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao reabrir tarefa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEnviarComentario = async () => {
    if (!comentario.trim() || !user) return;

    setSendingComment(true);
    try {
      const { error } = await supabase.from("comentarios_tarefas").insert({
        tarefa_id: tarefa.id,
        autor_id: user.id,
        conteudo: comentario.trim(),
      });

      if (error) throw error;

      setComentario("");
      queryClient.invalidateQueries({ queryKey: ["comentarios-tarefa", tarefa.id] });
      toast({ title: "Comentário adicionado!" });
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar comentário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingComment(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("tarefas")
        .delete()
        .eq("id", tarefa.id);

      if (error) throw error;

      toast({ title: "Tarefa excluída!" });
      onOpenChange(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const copyProcessNumber = () => {
    if (tarefa?.processo?.numero) {
      navigator.clipboard.writeText(tarefa.processo.numero);
      toast({ title: "Número copiado!" });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = parseISO(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "hoje";
    if (diffDays === 1) return "ontem";
    if (diffDays < 30) return `há ${diffDays} dias`;
    if (diffDays < 365) return `há ${Math.floor(diffDays / 30)} meses`;
    return `há ${Math.floor(diffDays / 365)} anos`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUploadDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tarefa?.id) return;

    setUploadingDoc(true);
    try {
      const folder = tarefa.processo?.id ? tarefa.processo.id : `tarefas/${tarefa.id}`;
      const sanitizedName = sanitizeFileName(file.name);
      const fileName = `${folder}/${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos_processos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documentos_processos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('documentos').insert({
        nome: file.name,
        tipo: file.type,
        url: publicUrl,
        tamanho_bytes: file.size,
        processo_id: tarefa.processo?.id || null,
        tarefa_id: tarefa.id,
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["documentos-tarefa", tarefa.id, tarefa.processo?.id] });
      toast({ title: "Documento enviado!" });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocumento = async (docId: string, docUrl: string | null) => {
    setDeletingDocId(docId);
    try {
      // Delete from storage if URL exists
      if (docUrl) {
        const urlParts = docUrl.split('/documentos_processos/');
        if (urlParts[1]) {
          await supabase.storage.from('documentos_processos').remove([urlParts[1]]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from("documentos")
        .delete()
        .eq("id", docId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["documentos-tarefa", tarefa.id, tarefa.processo?.id] });
      toast({ title: "Documento excluído!" });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingDocId(null);
    }
  };

  if (!tarefa) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[90dvh] !flex !flex-col !gap-0 !p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground font-mono">
                    TAR.{tarefa.id.slice(0, 7).toUpperCase()}
                  </p>
                  <Badge className={cn("rounded-full", status.className)}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-medium">
                  {tarefa.titulo || "Sem título"}
                </DialogTitle>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Situação
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {tarefa.status !== "cumprido" ? (
                    <DropdownMenuItem onClick={handleConcluir}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      Concluir
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handleReabrir}>
                      <Clock className="w-4 h-4 mr-2 text-blue-500" />
                      Reabrir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {tarefa.processo?.id && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`/processos/${tarefa.processo.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Abrir Processo
                  </a>
                </Button>
              )}

              {isCreator && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/nova-tarefa?editar=${tarefa.id}`);
                    }}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Editar
                  </Button>

                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6 py-4 pb-6 px-6">
              {/* Processo vinculado */}
              {tarefa.processo && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Processo vinculado</h4>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-primary">
                        {tarefa.processo.numero}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={copyProcessNumber}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {tarefa.processo.polo_ativo && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tarefa.processo.polo_ativo}
                      </p>
                    )}
                    {tarefa.processo.cliente?.nome && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {tarefa.processo.cliente.nome}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Detalhes da Tarefa */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Detalhes da Tarefa</h4>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Tipo da Tarefa</p>
                    <p className="font-medium">{tarefa.tipo_tarefa || "Não informado"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground text-xs">Responsável</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {tarefa.responsavel?.nome ? getInitials(tarefa.responsavel.nome) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{tarefa.responsavel?.nome || "Não informado"}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground text-xs">Prioridade</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-1",
                        tarefa.prioridade === "urgente" && "border-red-500 text-red-500",
                        tarefa.prioridade === "alta" && "border-orange-500 text-orange-500",
                        tarefa.prioridade === "media" && "border-yellow-500 text-yellow-600",
                        tarefa.prioridade === "baixa" && "border-green-500 text-green-500"
                      )}
                    >
                      {tarefa.prioridade?.charAt(0).toUpperCase() + tarefa.prioridade?.slice(1) || "Média"}
                    </Badge>
                  </div>

                  {tarefa.data_base && (
                    <div>
                      <p className="text-muted-foreground text-xs">Data base</p>
                      <p className="font-medium">
                        {format(parseISO(tarefa.data_base), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}

                  {tarefa.data_vencimento && (
                    <div>
                      <p className="text-muted-foreground text-xs">Data prevista</p>
                      <p className="font-medium">
                        {format(parseISO(tarefa.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}

                  {tarefa.data_fatal && (
                    <div>
                      <p className="text-muted-foreground text-xs">Data Fatal</p>
                      <p className="font-medium text-red-500">
                        {format(parseISO(tarefa.data_fatal), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}

                  {tarefa.data_cumprimento && (
                    <div>
                      <p className="text-muted-foreground text-xs">Data de conclusão</p>
                      <p className="font-medium text-green-600">
                        {format(parseISO(tarefa.data_cumprimento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>

                {tarefa.descricao && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap">{tarefa.descricao}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Tarefas Relacionadas */}
              <Collapsible open={tarefasRelacionadasOpen} onOpenChange={setTarefasRelacionadasOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <ListChecks className="w-4 h-4" />
                      Tarefas relacionadas ({tarefasRelacionadas?.length || 0})
                    </span>
                    {tarefasRelacionadasOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {loadingRelacionadas ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : tarefasRelacionadas?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhuma tarefa relacionada encontrada
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tarefasRelacionadas?.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            {t.status === "cumprido" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-blue-500" />
                            )}
                            <span className={cn(t.status === "cumprido" && "line-through text-muted-foreground")}>
                              {t.titulo}
                            </span>
                          </div>
                          {t.data_vencimento && (
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(t.data_vencimento), "dd/MM", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setVincularTarefaOpen(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Vincular Existente
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/nova-tarefa?relacionada=${tarefa.id}${tarefa.processo?.id ? `&processo=${tarefa.processo.id}` : ''}`);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Criar Nova
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Documentos */}
              <Collapsible open={documentosOpen} onOpenChange={setDocumentosOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="w-4 h-4" />
                      Documentos ({documentos?.length || 0})
                    </span>
                    {documentosOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {loadingDocumentos ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : documentos?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum documento encontrado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {documentos?.map((doc) => (
                        <div 
                          key={doc.id} 
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm hover:bg-muted transition-colors gap-2"
                        >
                          <button 
                            onClick={async () => {
                              if (!doc.url) return;
                              try {
                                const response = await fetch(doc.url);
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = doc.nome;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } catch (error) {
                                toast({ title: "Erro ao baixar documento", variant: "destructive" });
                              }
                            }}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{doc.nome}</span>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {formatFileSize(doc.tamanho_bytes)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteDocumento(doc.id, doc.url)}
                              disabled={deletingDocId === doc.id}
                            >
                              {deletingDocId === doc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tarefa?.id && (
                    <div className="relative">
                      <input
                        type="file"
                        id="doc-upload"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleUploadDocumento}
                        disabled={uploadingDoc}
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full pointer-events-none"
                        disabled={uploadingDoc}
                      >
                        {uploadingDoc ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3 mr-1" />
                        )}
                        Enviar Documento
                      </Button>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Auditoria */}
              <Collapsible open={auditoriaOpen} onOpenChange={setAuditoriaOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      Auditoria
                    </span>
                    {auditoriaOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="text-sm text-muted-foreground">
                    <p>Criado em: {format(parseISO(tarefa.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Comentários */}
              <Collapsible open={comentariosOpen} onOpenChange={setComentariosOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="w-4 h-4" />
                      Comentários ({comentarios?.length || 0})
                    </span>
                    {comentariosOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  {/* Input de comentário */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {2000 - comentario.length} caracteres restantes
                      </p>
                    </div>
                    <MentionInput
                      placeholder="Digite seu comentário... Use @ para mencionar usuários"
                      value={comentario}
                      onChange={setComentario}
                      rows={3}
                      maxLength={2000}
                    />
                    <Button
                      size="sm"
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEnviarComentario();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEnviarComentario();
                      }}
                      disabled={!comentario.trim() || sendingComment}
                    >
                      {sendingComment && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      Comentar
                    </Button>
                  </div>

                  {/* Lista de comentários */}
                  {loadingComentarios ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : comentarios?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum comentário ainda
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {comentarios?.map((c) => (
                        <div key={c.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {c.autor?.nome ? getInitials(c.autor.nome) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{c.autor?.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimeAgo(c.created_at)} (
                                {format(parseISO(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })})
                              </p>
                            </div>
                          </div>
                          <p className="text-sm pl-10">{c.conteudo}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>


      {/* Vincular Tarefa Existente Dialog */}
      <VincularTarefaDialog
        open={vincularTarefaOpen}
        onOpenChange={setVincularTarefaOpen}
        tarefaOrigemId={tarefa.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["tarefas-relacionadas", tarefa.id, tarefa.processo?.id] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tarefa "{tarefa.titulo}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
