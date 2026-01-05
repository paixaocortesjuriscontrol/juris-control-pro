import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X,
  ExternalLink,
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  Copy,
  Loader2,
  ListChecks,
  Calendar,
  User,
  FileText,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TarefaDetalhesPanelProps {
  tarefa: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function TarefaDetalhesPanel({
  tarefa,
  onClose,
  onUpdate,
}: TarefaDetalhesPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comentario, setComentario] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [tarefasRelacionadasOpen, setTarefasRelacionadasOpen] = useState(false);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const [comentariosOpen, setComentariosOpen] = useState(true);

  // Fetch comentários
  const { data: comentarios, isLoading: loadingComentarios } = useQuery({
    queryKey: ["comentarios-tarefa", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comentarios_prazos")
        .select(`
          id,
          conteudo,
          created_at,
          autor:profiles!comentarios_prazos_autor_id_fkey(id, nome)
        `)
        .eq("prazo_id", tarefa.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
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
    if (tarefa.status === "concluido") {
      return {
        label: "Concluído com sucesso",
        icon: CheckCircle2,
        className: "bg-green-500 text-white",
      };
    }
    if (tarefa.isAtrasado) {
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
        .from("prazos")
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
        .from("prazos")
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
      const { error } = await supabase.from("comentarios_prazos").insert({
        prazo_id: tarefa.id,
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

  const copyProcessNumber = () => {
    if (tarefa.processo?.numero) {
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-mono">
              TAR.{tarefa.id.slice(0, 7).toUpperCase()}
            </p>
            <Badge className={cn("rounded-full", status.className)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
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
              {tarefa.status !== "concluido" ? (
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

          <Button size="sm" variant="outline" asChild>
            <a href={`/processos/${tarefa.processo?.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              Abrir
            </a>
          </Button>

          <Button size="sm" variant="outline">
            <Edit className="w-3 h-3 mr-1" />
            Editar
          </Button>

          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
            <Trash2 className="w-3 h-3 mr-1" />
            Excluir
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-6">
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

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Título</p>
                <p className="font-medium">{tarefa.titulo || "Não informado"}</p>
              </div>
              
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
                  Tarefas relacionadas
                </span>
                {tarefasRelacionadasOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Button size="sm" className="w-full">
                Adicionar
              </Button>
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
                <Textarea
                  placeholder="Utilize o @ antes de um nome para citar outros usuários do sistema."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value.slice(0, 2000))}
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={handleEnviarComentario}
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
                      <div className="flex gap-2 pl-10 text-xs text-primary">
                        <button className="hover:underline">Responder</button>
                        <button className="hover:underline">Editar</button>
                        <button className="hover:underline text-destructive">Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
