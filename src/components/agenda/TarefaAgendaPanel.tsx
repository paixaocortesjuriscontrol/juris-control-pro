import { useState } from "react";
import { format, parseISO, differenceInDays, startOfDay, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MentionInput } from "@/components/ui/mention-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DOMPurify from "dompurify";
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
  X,
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
  MessageSquare,
  Calendar,
  User,
  Tag,
  Briefcase,
  FileText,
  Send,
  Check,
  Building2,
  Gavel,
  MapPin,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface TarefaAgendaPanelProps {
  tarefa: {
    id: string;
    titulo: string;
    descricao?: string | null;
    data_inicio: string;
    data_fim?: string | null;
    status: string;
    prioridade?: string | null;
    processo_id?: string | null;
    responsavel_id?: string | null;
    criado_por?: string | null;
    concluido_em?: string | null;
    created_at: string;
    origem: "evento" | "tarefa";
    tipo: string;
    local?: string | null;
    processo?: {
      id: string;
      numero: string;
      cliente_id?: string | null;
      polo_ativo?: string | null;
    } | null;
    responsavel?: {
      id: string;
      nome: string;
    } | null;
    tipo_tarefa?: string | null;
    data_vencimento?: string | null;
    data_fatal?: string | null;
  };
  onClose: () => void;
  onUpdate: () => void;
}

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700 border-slate-300",
  media: "bg-blue-100 text-blue-700 border-blue-300",
  alta: "bg-amber-100 text-amber-700 border-amber-300",
  urgente: "bg-red-100 text-red-700 border-red-300",
};

export function TarefaAgendaPanel({
  tarefa,
  onClose,
  onUpdate,
}: TarefaAgendaPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [comentario, setComentario] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [comentariosOpen, setComentariosOpen] = useState(true);
  const [detalhesOpen, setDetalhesOpen] = useState(true);
  const [publicacaoOpen, setPublicacaoOpen] = useState(true);
  const [processoOpen, setProcessoOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch comentários
  const { data: comentarios, isLoading: loadingComentarios } = useQuery({
    queryKey: ["comentarios-tarefa-agenda", tarefa.id],
    queryFn: async () => {
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
    enabled: tarefa.origem === "tarefa",
  });

  // Fetch processo completo
  const { data: processoCompleto } = useQuery({
    queryKey: ["processo-completo-agenda", tarefa.processo_id],
    queryFn: async () => {
      if (!tarefa.processo_id) return null;
      const { data, error } = await supabase
        .from("processos")
        .select(`
          id, numero, status, instancia, area, vara, comarca, uf, classe,
          polo_ativo, polo_passivo, assunto, coordenacao_id,
          cliente:clientes(id, nome),
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome)
        `)
        .eq("id", tarefa.processo_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tarefa.processo_id,
  });

  // Fetch vínculo publicação de TERMOS
  const { data: vinculoPublicacao, isLoading: loadingVinculoTermo } = useQuery({
    queryKey: ["tarefa-publicacao-vinculo-agenda", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_publicacoes")
        .select("publicacao_id")
        .eq("tarefa_id", tarefa.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: tarefa.origem === "tarefa",
    staleTime: 0,
  });

  // Fetch vínculo publicação de PROCESSOS
  const { data: vinculoPublicacaoProcesso, isLoading: loadingVinculoProcesso } = useQuery({
    queryKey: ["tarefa-publicacao-processo-vinculo-agenda", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_publicacoes_processos")
        .select("publicacao_processo_id")
        .eq("tarefa_id", tarefa.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: tarefa.origem === "tarefa",
    staleTime: 0,
  });

  // Fetch publicação de TERMOS
  const { data: publicacaoTermo, isLoading: loadingPublicacaoTermo } = useQuery({
    queryKey: ["publicacao-djen-agenda", vinculoPublicacao?.publicacao_id],
    queryFn: async () => {
      if (!vinculoPublicacao?.publicacao_id) return null;
      const { data, error } = await supabase
        .from("publicacoes_djen")
        .select(`
          *,
          monitoramento:monitoramentos_djen(tipo, termo_busca, oab, uf)
        `)
        .eq("id", vinculoPublicacao.publicacao_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!vinculoPublicacao?.publicacao_id,
    staleTime: 0,
  });

  // Fetch publicação de PROCESSOS
  const { data: publicacaoProcesso, isLoading: loadingPublicacaoProcesso } = useQuery({
    queryKey: ["publicacao-djen-processo-agenda", vinculoPublicacaoProcesso?.publicacao_processo_id],
    queryFn: async () => {
      if (!vinculoPublicacaoProcesso?.publicacao_processo_id) return null;
      const { data, error } = await supabase
        .from("publicacoes_djen_processos")
        .select("*")
        .eq("id", vinculoPublicacaoProcesso.publicacao_processo_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!vinculoPublicacaoProcesso?.publicacao_processo_id,
    staleTime: 0,
  });

  // Unificar publicação de qualquer origem
  const publicacao = publicacaoTermo || publicacaoProcesso;
  const tipoPublicacao = publicacaoTermo ? 'termo' : (publicacaoProcesso ? 'processo' : null);
  const temPublicacao = publicacao !== null && publicacao !== undefined;
  const loadingPublicacao = loadingVinculoTermo || loadingVinculoProcesso || loadingPublicacaoTermo || loadingPublicacaoProcesso;

  // Fetch cliente info (se não tiver processo completo)
  const clienteInfo = processoCompleto?.cliente || null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const today = startOfDay(new Date());
  const dataVencimento = tarefa.data_vencimento 
    ? parseISO(tarefa.data_vencimento) 
    : parseISO(tarefa.data_inicio.split('T')[0]);
  const isAtrasado = tarefa.status !== "concluido" && tarefa.status !== "cumprido" && isAfter(today, dataVencimento);
  const dias = differenceInDays(dataVencimento, today);

  const getStatusInfo = () => {
    if (tarefa.status === "concluido" || tarefa.status === "cumprido") {
      return {
        label: "Concluído",
        icon: CheckCircle2,
        className: "bg-emerald-500 text-white",
      };
    }
    if (isAtrasado) {
      return {
        label: `Atrasado (${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""})`,
        icon: AlertTriangle,
        className: "bg-destructive text-white",
      };
    }
    return {
      label: dias === 0 ? "Vence hoje" : `${dias} dia${dias !== 1 ? "s" : ""} restantes`,
      icon: Clock,
      className: "bg-amber-500 text-white",
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  const handleConcluir = async () => {
    setUpdatingStatus(true);
    try {
      if (tarefa.origem === "tarefa") {
        const { error } = await supabase
          .from("tarefas")
          .update({
            status: "cumprido",
            data_cumprimento: new Date().toISOString(),
          })
          .eq("id", tarefa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .update({
            status: "concluido",
            concluido_em: new Date().toISOString(),
          })
          .eq("id", tarefa.id);
        if (error) throw error;
      }
      toast({ title: "Concluído com sucesso!" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao concluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReabrir = async () => {
    setUpdatingStatus(true);
    try {
      if (tarefa.origem === "tarefa") {
        const { error } = await supabase
          .from("tarefas")
          .update({
            status: "pendente",
            data_cumprimento: null,
          })
          .eq("id", tarefa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .update({
            status: "pendente",
            concluido_em: null,
          })
          .eq("id", tarefa.id);
        if (error) throw error;
      }
      toast({ title: "Reaberto com sucesso!" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao reabrir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEnviarComentario = async () => {
    if (!comentario.trim() || !user || tarefa.origem !== "tarefa") return;

    setSendingComment(true);
    try {
      const { error } = await supabase.from("comentarios_tarefas").insert({
        tarefa_id: tarefa.id,
        autor_id: user.id,
        conteudo: comentario.trim(),
      });

      if (error) throw error;

      setComentario("");
      queryClient.invalidateQueries({ queryKey: ["comentarios-tarefa-agenda", tarefa.id] });
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
      if (tarefa.origem === "tarefa") {
        const { error } = await supabase
          .from("tarefas")
          .delete()
          .eq("id", tarefa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .delete()
          .eq("id", tarefa.id);
        if (error) throw error;
      }
      toast({ title: "Excluído com sucesso!" });
      onClose();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const copyProcessNumber = () => {
    if (tarefa.processo?.numero) {
      navigator.clipboard.writeText(tarefa.processo.numero);
      toast({ title: "Número copiado!" });
    }
  };

  const handleEdit = () => {
    if (tarefa.origem === "tarefa") {
      navigate(`/nova-tarefa?editar=${tarefa.id}`);
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

  const canEdit = tarefa.criado_por === user?.id || !tarefa.criado_por;
  const isConcluido = tarefa.status === "concluido" || tarefa.status === "cumprido";

  return (
    <Card className="h-full flex flex-col border-l-4 border-l-primary">
      <CardHeader className="pb-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-mono">
              {tarefa.origem === "tarefa" ? "TAR" : "EVT"}.{tarefa.id.slice(0, 7).toUpperCase()}
            </p>
            <h3 className="font-semibold text-lg leading-tight break-words">
              {tarefa.titulo}
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Status Badge */}
        <Badge className={cn("w-fit gap-1", status.className)}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </Badge>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {!isConcluido ? (
            <Button 
              size="sm" 
              onClick={handleConcluir}
              disabled={updatingStatus}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updatingStatus ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Concluir
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleReabrir}
              disabled={updatingStatus}
            >
              {updatingStatus ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Clock className="w-3 h-3 mr-1" />}
              Reabrir
            </Button>
          )}

          {tarefa.processo?.id && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/processos/${tarefa.processo.id}`}>
                <ExternalLink className="w-3 h-3 mr-1" />
                Processo
              </a>
            </Button>
          )}

          {canEdit && tarefa.origem === "tarefa" && (
            <Button size="sm" variant="outline" onClick={handleEdit}>
              <Edit className="w-3 h-3 mr-1" />
              Editar
            </Button>
          )}

          {canEdit && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Excluir
            </Button>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-4">
          {/* Publicação Vinculada Section */}
          {temPublicacao && publicacao && (
            <>
              <Collapsible open={publicacaoOpen} onOpenChange={setPublicacaoOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Gavel className="w-4 h-4 text-primary" />
                      Publicação Vinculada
                    </span>
                    {publicacaoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {/* Info do Diário */}
                  <div className="border rounded-lg p-3 bg-primary/5 space-y-2">
                    <p className="font-semibold text-primary text-sm">
                      {publicacao.fonte || "Diário de Justiça Eletrônico"} - DJN
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Publicado em: <strong>{publicacao.data_publicacao ? format(parseISO(publicacao.data_publicacao), "dd/MM/yyyy", { locale: ptBR }) : "-"}</strong>
                    </p>
                    <p className="text-xs">
                      Processo: <span className="font-mono font-medium">{publicacao.processo_numero || processoCompleto?.numero}</span>
                    </p>
                    {tipoPublicacao === 'termo' && publicacaoTermo?.monitoramento && (
                      <p className="text-xs">
                        Termo encontrado: <strong className="text-primary">
                          {publicacaoTermo.monitoramento.tipo === 'advogado'
                            ? `OAB ${publicacaoTermo.monitoramento.oab} ${publicacaoTermo.monitoramento.uf}`
                            : publicacaoTermo.monitoramento.termo_busca
                          }
                        </strong>
                      </p>
                    )}
                  </div>

                  {/* Conteúdo da Publicação */}
                  <div className="border rounded-lg p-3 bg-muted/30 max-h-[300px] overflow-y-auto">
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-p:leading-relaxed text-xs"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(publicacao.conteudo || "Sem conteúdo disponível", {
                          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'span', 'div', 'ul', 'ol', 'li', 'a'],
                          ALLOWED_ATTR: ['href', 'target', 'class'],
                        })
                      }}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* Detalhes do Processo Section */}
          {processoCompleto && (
            <>
              <Collapsible open={processoOpen} onOpenChange={setProcessoOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Scale className="w-4 h-4" />
                      Detalhes do Processo
                    </span>
                    {processoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
                    {/* Número do Processo */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-medium text-primary">
                          {processoCompleto.numero}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={copyProcessNumber}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={`/processos/${processoCompleto.id}`}>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    {/* Cliente */}
                    {clienteInfo && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{clienteInfo.nome}</span>
                      </div>
                    )}

                    {/* Partes */}
                    {processoCompleto.polo_ativo && (
                      <div className="text-xs space-y-1">
                        <p><span className="text-muted-foreground">Autor:</span> {processoCompleto.polo_ativo}</p>
                        {processoCompleto.polo_passivo && (
                          <p><span className="text-muted-foreground">Réu:</span> {processoCompleto.polo_passivo}</p>
                        )}
                      </div>
                    )}

                    {/* Grid de informações */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {processoCompleto.status && (
                        <div>
                          <span className="text-muted-foreground">Status:</span>{" "}
                          <Badge variant="secondary" className="text-[10px] h-5">{processoCompleto.status}</Badge>
                        </div>
                      )}
                      {processoCompleto.instancia && (
                        <div>
                          <span className="text-muted-foreground">Instância:</span> {processoCompleto.instancia}
                        </div>
                      )}
                      {processoCompleto.area && (
                        <div>
                          <span className="text-muted-foreground">Área:</span> {processoCompleto.area}
                        </div>
                      )}
                      {processoCompleto.classe && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Classe:</span> {processoCompleto.classe}
                        </div>
                      )}
                    </div>

                    {/* Localização */}
                    {(processoCompleto.vara || processoCompleto.comarca) && (
                      <div className="flex items-start gap-2 text-xs">
                        <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground" />
                        <div>
                          {processoCompleto.vara && <p>{processoCompleto.vara}</p>}
                          {processoCompleto.comarca && (
                            <p className="text-muted-foreground">
                              {processoCompleto.comarca}{processoCompleto.uf ? ` - ${processoCompleto.uf}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Advogado Responsável */}
                    {processoCompleto.advogado_responsavel && (
                      <div className="flex items-center gap-2 text-xs">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Responsável:</span>
                        <span>{processoCompleto.advogado_responsavel.nome}</span>
                      </div>
                    )}

                    {/* Assunto */}
                    {processoCompleto.assunto && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Assunto:</span>
                        <p className="mt-1">{processoCompleto.assunto}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* Detalhes Section */}
          <Collapsible open={detalhesOpen} onOpenChange={setDetalhesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4" />
                  Detalhes da Tarefa
                </span>
                {detalhesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {/* Grid de informações */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs">Data</span>
                  </div>
                  <p className="font-medium">
                    {format(parseISO(tarefa.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>

                {tarefa.responsavel && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="text-xs">Responsável</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(tarefa.responsavel.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{tarefa.responsavel.nome.split(' ')[0]}</span>
                    </div>
                  </div>
                )}

                {tarefa.prioridade && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-xs">Prioridade</span>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", PRIORIDADE_COLORS[tarefa.prioridade])}>
                      {PRIORIDADE_LABELS[tarefa.prioridade] || tarefa.prioridade}
                    </Badge>
                  </div>
                )}

                {tarefa.tipo_tarefa && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Tag className="w-3 h-3" />
                      <span className="text-xs">Tipo</span>
                    </div>
                    <p className="text-sm">{tarefa.tipo_tarefa}</p>
                  </div>
                )}

                {tarefa.data_fatal && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-xs">Data Fatal</span>
                    </div>
                    <p className="text-sm font-medium text-destructive">
                      {format(parseISO(tarefa.data_fatal), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}

                {tarefa.concluido_em && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-xs">Concluído em</span>
                    </div>
                    <p className="text-sm font-medium text-emerald-600">
                      {format(parseISO(tarefa.concluido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>

              {/* Descrição */}
              {tarefa.descricao && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Descrição</span>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-2 rounded">
                    {tarefa.descricao}
                  </p>
                </div>
              )}

              {/* Local */}
              {tarefa.local && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Local</span>
                  <p className="text-sm">{tarefa.local}</p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Comentários Section - Apenas para tarefas */}
          {tarefa.origem === "tarefa" && (
            <Collapsible open={comentariosOpen} onOpenChange={setComentariosOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="w-4 h-4" />
                    Comentários ({comentarios?.length || 0})
                  </span>
                  {comentariosOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                {/* Input de comentário */}
                <div className="space-y-2">
                  <div className="relative">
                    <MentionInput
                      placeholder="Escreva um comentário..."
                      value={comentario}
                      onChange={setComentario}
                      rows={2}
                      maxLength={2000}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {2000 - comentario.length} caracteres
                    </span>
                    <Button
                      size="sm"
                      onClick={handleEnviarComentario}
                      disabled={!comentario.trim() || sendingComment}
                    >
                      {sendingComment ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3 mr-1" />
                      )}
                      Enviar
                    </Button>
                  </div>
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
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {comentarios?.map((c) => (
                      <div key={c.id} className="p-2 rounded-lg bg-muted/30 space-y-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {c.autor?.nome ? getInitials(c.autor.nome) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{c.autor?.nome}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatTimeAgo(c.created_at)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm pl-8">{c.conteudo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{tarefa.titulo}"? 
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
    </Card>
  );
}
