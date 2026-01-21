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
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Coins,
  Receipt,
  DollarSign,
  CalendarCheck,
  Users,
  Hash,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { AGENDA_INFINITE_QUERY_KEY } from "@/hooks/useAgendaUnificada";

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
    criador?: {
      id: string;
      nome: string;
    } | null;
    tipo_tarefa?: string | null;
    data_vencimento?: string | null;
    data_fatal?: string | null;
    // Parcelamento fields
    total_parcelas?: number | null;
    // Projuris-specific fields
    identificador_projuris?: string | null;
    hora_criacao?: string | null;
    hora_prevista?: string | null;
    hora_fatal?: string | null;
    hora_conclusao?: string | null;
    link_local?: string | null;
    orgao?: string | null;
    orgao_julgador?: string | null;
    instancia?: string | null;
    situacao_processo?: string | null;
    partes_ativas?: string | null;
    partes_passivas?: string | null;
    outras_partes?: string | null;
    envolvimento_clientes?: string | null;
    criado_por_nome?: string | null;
    concluido_por_nome?: string | null;
    grupos_trabalho?: string | null;
    marcadores?: string | null;
    modulo?: string | null;
    quadro_kanban?: string | null;
    // Evento/participantes
    participantes?: { usuario_id: string; usuario?: { id: string; nome: string } }[];
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

const TIPO_LABELS: Record<string, string> = {
  evento: "Evento",
  tarefa: "Tarefa",
  tarefa_delegada: "Tarefa Delegada",
  prazo: "Prazo",
  audiencia: "Audiência",
  prazo_parcela: "Parcela",
  parcelamento: "Parcelamento",
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
  const [parcelamentoOpen, setParcelamentoOpen] = useState(true);
  const [participantesOpen, setParticipantesOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [descartarDialogOpen, setDescartarDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // Local status override para refletir mudanças imediatamente na UI
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  
  // Usar statusOverride se disponível, senão usar status original
  const statusAtual = statusOverride ?? tarefa.status;

  const isParcelamento = tarefa.tipo === "parcelamento" || tarefa.tipo === "prazo_parcela";

  // Fetch comentários de tarefas
  const { data: comentariosTarefas, isLoading: loadingComentariosTarefas } = useQuery({
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

  // Fetch comentários de eventos
  const { data: comentariosEventos, isLoading: loadingComentariosEventos } = useQuery({
    queryKey: ["comentarios-evento-agenda", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comentarios_eventos")
        .select(`
          id,
          conteudo,
          created_at,
          autor_id
        `)
        .eq("evento_id", tarefa.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Buscar nomes dos autores
      if (data && data.length > 0) {
        const autorIds = [...new Set(data.map(c => c.autor_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", autorIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(c => ({
          ...c,
          autor: profilesMap.get(c.autor_id) || null
        }));
      }
      return data || [];
    },
    enabled: tarefa.origem === "evento",
  });

  // Unificar comentários
  const comentarios = tarefa.origem === "tarefa" ? comentariosTarefas : comentariosEventos;
  const loadingComentarios = tarefa.origem === "tarefa" ? loadingComentariosTarefas : loadingComentariosEventos;

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

  // Fetch parcelas do evento (se for parcelamento)
  const { data: parcelas, isLoading: loadingParcelas } = useQuery({
    queryKey: ["parcelas-evento-agenda", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_evento")
        .select("*")
        .eq("evento_id", tarefa.id)
        .order("numero", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: isParcelamento && tarefa.origem === "evento",
  });

  // Fetch evento completo para parcelamentos (campos adicionais)
  const { data: eventoCompleto } = useQuery({
    queryKey: ["evento-completo-agenda", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_agenda")
        .select(`
          *,
          criador:profiles!eventos_agenda_criado_por_fkey(id, nome)
        `)
        .eq("id", tarefa.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: tarefa.origem === "evento",
  });

  // Fetch cliente do evento separadamente (se tiver cliente_id)
  const eventoClienteId = (eventoCompleto as any)?.cliente_id;
  const { data: clienteEvento } = useQuery({
    queryKey: ["cliente-evento-agenda", eventoClienteId],
    queryFn: async () => {
      if (!eventoClienteId) return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .eq("id", eventoClienteId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!eventoClienteId,
  });

  // Fetch tarefa completa para mais detalhes
  const { data: tarefaCompleta } = useQuery({
    queryKey: ["tarefa-completa-agenda", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          *,
          criador:profiles!tarefas_criado_por_fkey(id, nome),
          delegador:profiles!tarefas_delegado_por_id_fkey(id, nome)
        `)
        .eq("id", tarefa.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: tarefa.origem === "tarefa",
  });

  // Fetch cliente info (se não tiver processo completo)
  const clienteInfo = processoCompleto?.cliente || clienteEvento || null;

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
  const isAtrasado = statusAtual !== "concluido" && statusAtual !== "cumprido" && isAfter(today, dataVencimento);
  const dias = differenceInDays(dataVencimento, today);

  const getStatusInfo = () => {
    if (statusAtual === "concluido" || statusAtual === "cumprido") {
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

  const patchAgendaCacheStatus = (nextStatus: string, concluidoEm: string | null) => {
    // Atualiza otimisticamente a lista (useInfiniteQuery) para refletir o badge imediatamente.
    queryClient.setQueriesData({ queryKey: [AGENDA_INFINITE_QUERY_KEY] }, (oldData: any) => {
      if (!oldData?.pages || !Array.isArray(oldData.pages)) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => {
          if (!Array.isArray(page)) return page;
          return page.map((it: any) => {
            if (!it || it.id !== tarefa.id || it.origem !== tarefa.origem) return it;
            return {
              ...it,
              status: nextStatus,
              concluido_em: concluidoEm,
              // Ao concluir, nunca deve aparecer como atrasado.
              // Ao reabrir, deixamos o cálculo definitivo para o refetch.
              is_atrasado: nextStatus === "concluido" || nextStatus === "cumprido" ? false : it.is_atrasado,
            };
          });
        }),
      };
    });
  };

  const handleConcluir = async () => {
    setUpdatingStatus(true);
    try {
      const concluidoEm = new Date().toISOString();
      if (tarefa.origem === "tarefa") {
        const { error } = await supabase
          .from("tarefas")
          .update({
            status: "cumprido",
            data_cumprimento: concluidoEm,
            updated_at: concluidoEm,
          })
          .eq("id", tarefa.id);
        if (error) throw error;
        setStatusOverride("cumprido");
        patchAgendaCacheStatus("cumprido", null);
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .update({
            status: "concluido",
            concluido_em: concluidoEm,
            updated_at: concluidoEm,
          })
          .eq("id", tarefa.id);
        if (error) throw error;
        setStatusOverride("concluido");
        patchAgendaCacheStatus("concluido", concluidoEm);
      }
      toast({ title: "Concluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
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
      const updatedAt = new Date().toISOString();
      if (tarefa.origem === "tarefa") {
        const { error } = await supabase
          .from("tarefas")
          .update({
            status: "pendente",
            data_cumprimento: null,
            updated_at: updatedAt,
          })
          .eq("id", tarefa.id);
        if (error) throw error;
        setStatusOverride("pendente");
        patchAgendaCacheStatus("pendente", null);
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .update({
            status: "pendente",
            concluido_em: null,
            updated_at: updatedAt,
          })
          .eq("id", tarefa.id);
        if (error) throw error;
        setStatusOverride("pendente");
        patchAgendaCacheStatus("pendente", null);
      }
      toast({ title: "Reaberto com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
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
    if (!comentario.trim() || !user) return;

    setSendingComment(true);
    try {
      if (tarefa.origem === "tarefa") {
        const { error } = await supabase.from("comentarios_tarefas").insert({
          tarefa_id: tarefa.id,
          autor_id: user.id,
          conteudo: comentario.trim(),
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["comentarios-tarefa-agenda", tarefa.id] });
      } else {
        const { error } = await supabase.from("comentarios_eventos").insert({
          evento_id: tarefa.id,
          autor_id: user.id,
          conteudo: comentario.trim(),
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["comentarios-evento-agenda", tarefa.id] });
      }

      setComentario("");
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

  const handleDescartar = async () => {
    setDescartando(true);
    try {
      if (tarefa.origem === "tarefa") {
        // Usar delete ao invés de status descartado para tarefas (tipo não suporta)
        const { error } = await supabase
          .from("tarefas")
          .delete()
          .eq("id", tarefa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .update({ status: "descartado" })
          .eq("id", tarefa.id);
        if (error) throw error;
      }
      toast({ title: "Atividade descartada!" });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      queryClient.refetchQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      onClose();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao descartar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDescartando(false);
      setDescartarDialogOpen(false);
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
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      queryClient.refetchQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
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

          {canEdit && !isConcluido && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-amber-600 hover:text-amber-700"
              onClick={() => setDescartarDialogOpen(true)}
              disabled={descartando}
            >
              {descartando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
              Descartar
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
                    <div className={`text-xs ${conteudoDisplayClasses}`}>
                      {formatConteudoParaExibicao(publicacao.conteudo)}
                    </div>
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

          {/* Seção de Parcelamento */}
          {isParcelamento && tarefa.origem === "evento" && (
            <>
              <Collapsible open={parcelamentoOpen} onOpenChange={setParcelamentoOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      Detalhes do Parcelamento
                    </span>
                    {parcelamentoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <div className="border rounded-lg p-3 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                    {/* Resumo do Parcelamento */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Hash className="w-3 h-3" />
                          <span className="text-xs">Total de Parcelas</span>
                        </div>
                        <p className="font-bold text-lg text-emerald-700 dark:text-emerald-400">
                          {tarefa.total_parcelas || parcelas?.length || "-"}
                        </p>
                      </div>
                      
                      {eventoCompleto && (eventoCompleto as any).valor_parcela && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="w-3 h-3" />
                            <span className="text-xs">Valor Base</span>
                          </div>
                          <p className="font-bold text-lg text-emerald-700 dark:text-emerald-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((eventoCompleto as any).valor_parcela)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Cliente do Parcelamento */}
                    {clienteInfo && (
                      <div className="flex items-center gap-2 text-sm border-t pt-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium">{clienteInfo.nome}</span>
                      </div>
                    )}

                    {/* Tabela de Parcelas */}
                    {loadingParcelas ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : parcelas && parcelas.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-xs py-2">#</TableHead>
                              <TableHead className="text-xs py-2">Vencimento</TableHead>
                              <TableHead className="text-xs py-2">Valor</TableHead>
                              <TableHead className="text-xs py-2">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parcelas.map((parcela: any) => {
                              const vencido = parcela.data_vencimento && isAfter(startOfDay(new Date()), startOfDay(parseISO(parcela.data_vencimento)));
                              const isPago = parcela.status === 'pago' || parcela.status === 'concluido';
                              return (
                                <TableRow key={parcela.id} className={cn(isPago && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                                  <TableCell className="text-xs py-1.5 font-medium">{parcela.numero}</TableCell>
                                  <TableCell className="text-xs py-1.5">
                                    {parcela.data_vencimento 
                                      ? format(parseISO(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="text-xs py-1.5 font-mono">
                                    {parcela.valor 
                                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela.valor)
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="text-xs py-1.5">
                                    {isPago ? (
                                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                                        Pago
                                      </Badge>
                                    ) : vencido ? (
                                      <Badge variant="destructive" className="text-[10px]">
                                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                        Vencido
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px]">
                                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                                        Pendente
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhuma parcela individual cadastrada
                      </p>
                    )}

                    {/* Estatísticas */}
                    {parcelas && parcelas.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Pagas</p>
                          <p className="font-bold text-emerald-600">
                            {parcelas.filter((p: any) => p.status === 'pago' || p.status === 'concluido').length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pendentes</p>
                          <p className="font-bold text-amber-600">
                            {parcelas.filter((p: any) => p.status !== 'pago' && p.status !== 'concluido' && !(p.data_vencimento && isAfter(startOfDay(new Date()), startOfDay(parseISO(p.data_vencimento))))).length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Vencidas</p>
                          <p className="font-bold text-destructive">
                            {parcelas.filter((p: any) => p.status !== 'pago' && p.status !== 'concluido' && p.data_vencimento && isAfter(startOfDay(new Date()), startOfDay(parseISO(p.data_vencimento)))).length}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* Seção de Participantes (para eventos) */}
          {tarefa.origem === "evento" && tarefa.participantes && tarefa.participantes.length > 0 && (
            <>
              <Collapsible open={participantesOpen} onOpenChange={setParticipantesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Users className="w-4 h-4" />
                      Participantes ({tarefa.participantes.length})
                    </span>
                    {participantesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                    {tarefa.participantes.map((p) => (
                      <div key={p.usuario_id} className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {p.usuario?.nome ? getInitials(p.usuario.nome) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{p.usuario?.nome || "Usuário"}</span>
                      </div>
                    ))}
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

                {/* Tipo do Item */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Info className="w-3 h-3" />
                    <span className="text-xs">Tipo</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {TIPO_LABELS[tarefa.tipo] || tarefa.tipo}
                  </Badge>
                </div>

                {/* Criado por */}
                {(tarefaCompleta?.criador || eventoCompleto?.criador) && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="text-xs">Criado por</span>
                    </div>
                    <span className="text-sm">
                      {(tarefaCompleta?.criador as any)?.nome || (eventoCompleto?.criador as any)?.nome}
                    </span>
                  </div>
                )}

                {/* Delegado por */}
                {tarefaCompleta?.delegador && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span className="text-xs">Delegado por</span>
                    </div>
                    <span className="text-sm">{(tarefaCompleta.delegador as any)?.nome}</span>
                  </div>
                )}

                {/* Data de Criação */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <CalendarCheck className="w-3 h-3" />
                    <span className="text-xs">Criado em</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(tarefa.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
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

              {/* Informações Projuris */}
              {tarefa.origem === "tarefa" && tarefa.identificador_projuris && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="text-xs font-medium text-muted-foreground">Dados Projuris</span>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-2">
                    {tarefa.identificador_projuris && (
                      <div>
                        <span className="text-muted-foreground">ID:</span>{" "}
                        <span className="font-mono">{tarefa.identificador_projuris}</span>
                      </div>
                    )}
                    {tarefa.hora_fatal && (
                      <div>
                        <span className="text-muted-foreground">Hora Fatal:</span>{" "}
                        <span className="text-destructive font-medium">{tarefa.hora_fatal}</span>
                      </div>
                    )}
                    {tarefa.orgao && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Órgão:</span>{" "}
                        <span>{tarefa.orgao}</span>
                      </div>
                    )}
                    {tarefa.partes_ativas && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Partes Ativas:</span>{" "}
                        <span className="break-words">{tarefa.partes_ativas.substring(0, 100)}...</span>
                      </div>
                    )}
                    {tarefa.partes_passivas && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Partes Passivas:</span>{" "}
                        <span className="break-words">{tarefa.partes_passivas.substring(0, 100)}...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Comentários Section - Para tarefas e eventos */}
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
        </CardContent>
      </ScrollArea>

      {/* Descartar Confirmation Dialog */}
      <AlertDialog open={descartarDialogOpen} onOpenChange={setDescartarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar atividade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja descartar "{tarefa.titulo}"? 
              A atividade será removida da sua lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={descartando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDescartar}
              disabled={descartando}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {descartando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
