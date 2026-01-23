import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AGENDA_INFINITE_QUERY_KEY } from "@/hooks/useAgendaUnificada";
import { format, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatConteudoParaExibicao, conteudoDisplayClasses, formatDateOnlyFull } from "@/utils/formatConteudo";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  Building2,
  Gavel,
  Loader2,
  User,
  Plus,
  Clock,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  Printer,
  ExternalLink,
  X,
  Check,
  RotateCcw,
  Trash2,
  MessageSquare,
  Send,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BotaoPreencherIA } from "@/components/tarefas/BotaoPreencherIA";

const formSchema = z.object({
  tipo_tarefa: z.string().min(1, "Tipo é obrigatório"),
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().optional(),
  responsavel_id: z.string().min(1, "Responsável é obrigatório"),
  data_vencimento: z.string().min(1, "Data prevista é obrigatória"),
  data_fatal: z.string().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
});

type FormValues = z.infer<typeof formSchema>;

interface TarefaPublicacaoViewProps {
  tarefaId: string;
  processoId: string;
  onVoltar: () => void;
}

const tiposTarefa = [
  "PRAZO",
  "TAREFA EQUIPE",
  "INTIMAÇÃO",
  "DEFESA",
  "RECURSO",
  "CONTRARRAZÕES",
  "PETIÇÃO",
  "DILIGÊNCIA",
  "AUDIÊNCIA",
  "PROTOCOLO",
  "ANÁLISE",
  "MANIFESTAÇÃO",
  "OUTROS"
];

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  cumprido: "Cumprida",
  atrasado: "Atrasada",
};

export function TarefaPublicacaoView({
  tarefaId,
  processoId,
  onVoltar,
}: TarefaPublicacaoViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [comentario, setComentario] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hoje = format(new Date(), "yyyy-MM-dd");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_tarefa: "INTIMAÇÃO",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      data_vencimento: hoje,
      data_fatal: "",
      prioridade: "alta",
    },
  });

  // Buscar tarefa selecionada
  const { data: tarefa } = useQuery({
    queryKey: ["tarefa-detalhe", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          *,
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `)
        .eq("id", tarefaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tarefaId,
  });

  // Buscar vínculo tarefa-publicação de TERMOS (publicacoes_djen)
  const { data: vinculoPublicacao } = useQuery({
    queryKey: ["tarefa-publicacao-vinculo", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_publicacoes")
        .select("publicacao_id")
        .eq("tarefa_id", tarefaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tarefaId,
  });

  // Buscar vínculo tarefa-publicação de PROCESSOS (publicacoes_djen_processos)
  const { data: vinculoPublicacaoProcesso } = useQuery({
    queryKey: ["tarefa-publicacao-processo-vinculo", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_publicacoes_processos")
        .select("publicacao_processo_id")
        .eq("tarefa_id", tarefaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tarefaId,
  });

  // Buscar publicação vinculada de TERMOS
  const { data: publicacaoTermo } = useQuery({
    queryKey: ["publicacao-djen", vinculoPublicacao?.publicacao_id],
    queryFn: async () => {
      if (!vinculoPublicacao?.publicacao_id) return null;
      const { data, error } = await supabase
        .from("publicacoes_djen")
        .select(`
          *,
          monitoramento:monitoramentos_djen(tipo, termo_busca, oab, uf, coordenacao:coordenacoes(nome))
        `)
        .eq("id", vinculoPublicacao.publicacao_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!vinculoPublicacao?.publicacao_id,
  });

  // Buscar publicação vinculada de PROCESSOS
  const { data: publicacaoProcesso } = useQuery({
    queryKey: ["publicacao-djen-processo", vinculoPublicacaoProcesso?.publicacao_processo_id],
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
  });

  // Unificar publicação de qualquer origem
  const publicacao = publicacaoTermo || publicacaoProcesso;
  const tipoPublicacao = publicacaoTermo ? 'termo' : (publicacaoProcesso ? 'processo' : null);

  // Buscar todas as tarefas vinculadas a esta publicação (TERMO)
  const { data: tarefasVinculadasTermo = [] } = useQuery({
    queryKey: ["tarefas-publicacao-termo", vinculoPublicacao?.publicacao_id],
    queryFn: async () => {
      if (!vinculoPublicacao?.publicacao_id) return [];
      const { data, error } = await supabase
        .from("tarefas_publicacoes")
        .select(`
          tarefa:tarefas(
            id, titulo, status, prioridade, data_vencimento, tipo_tarefa, descricao,
            responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
          )
        `)
        .eq("publicacao_id", vinculoPublicacao.publicacao_id);

      if (error) throw error;
      return (data || []).map((d: any) => d.tarefa).filter(Boolean);
    },
    enabled: !!vinculoPublicacao?.publicacao_id,
  });

  // Buscar todas as tarefas vinculadas a esta publicação (PROCESSO)
  const { data: tarefasVinculadasProcesso = [] } = useQuery({
    queryKey: ["tarefas-publicacao-processo", vinculoPublicacaoProcesso?.publicacao_processo_id],
    queryFn: async () => {
      if (!vinculoPublicacaoProcesso?.publicacao_processo_id) return [];
      const { data, error } = await supabase
        .from("tarefas_publicacoes_processos")
        .select(`
          tarefa:tarefas(
            id, titulo, status, prioridade, data_vencimento, tipo_tarefa, descricao,
            responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
          )
        `)
        .eq("publicacao_processo_id", vinculoPublicacaoProcesso.publicacao_processo_id);

      if (error) throw error;
      return (data || []).map((d: any) => d.tarefa).filter(Boolean);
    },
    enabled: !!vinculoPublicacaoProcesso?.publicacao_processo_id,
  });

  // Unificar tarefas vinculadas
  const tarefasVinculadas = [...tarefasVinculadasTermo, ...tarefasVinculadasProcesso];

  // Buscar comentários da tarefa
  const { data: comentarios = [], isLoading: loadingComentarios } = useQuery({
    queryKey: ["comentarios-tarefa", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comentarios_tarefas")
        .select(`
          id,
          conteudo,
          created_at,
          autor:profiles!comentarios_prazos_autor_id_fkey(id, nome)
        `)
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tarefaId,
    staleTime: 0,
  });

  // Buscar processo com detalhes
  const { data: processo } = useQuery({
    queryKey: ["processo-detalhe-view", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          id, numero, status, instancia, area, vara, comarca, uf, classe,
          coordenacao_id,
          cliente:clientes(id, nome),
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome)
        `)
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!processoId,
  });

  // Buscar responsáveis do processo
  const { data: responsaveisProcesso = [] } = useQuery({
    queryKey: ["responsaveis-processo-view", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_responsaveis")
        .select(`
          id,
          usuario:profiles!processos_responsaveis_usuario_id_fkey(id, nome)
        `)
        .eq("processo_id", processoId)
        .eq("ativo", true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["membros-coordenacao", processo?.coordenacao_id],
    queryFn: async () => {
      if (!processo?.coordenacao_id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `)
        .eq("coordenacao_id", processo.coordenacao_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!processo?.coordenacao_id,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  async function onSubmit(values: FormValues) {
    // Precisa ter uma publicação vinculada para criar tarefa
    const publicacaoId = vinculoPublicacao?.publicacao_id || vinculoPublicacaoProcesso?.publicacao_processo_id;
    if (!user || !publicacaoId) return;

    setLoading(true);
    try {
      const { data: novaTarefa, error } = await supabase
        .from("tarefas")
        .insert({
          processo_id: processoId,
          responsavel_id: values.responsavel_id,
          titulo: values.titulo,
          descricao: values.descricao || null,
          tipo_tarefa: values.tipo_tarefa,
          data_vencimento: values.data_vencimento,
          data_fatal: values.data_fatal || null,
          prioridade: values.prioridade,
          status: "pendente",
          criado_por: user.id,
          origem: "analise_djen",
        })
        .select()
        .single();

      if (error) throw error;

      // Vincular na tabela correta dependendo do tipo
      if (tipoPublicacao === 'termo' && vinculoPublicacao?.publicacao_id) {
        await supabase
          .from("tarefas_publicacoes")
          .insert({
            tarefa_id: novaTarefa.id,
            publicacao_id: vinculoPublicacao.publicacao_id,
          });
      } else if (tipoPublicacao === 'processo' && vinculoPublicacaoProcesso?.publicacao_processo_id) {
        await supabase
          .from("tarefas_publicacoes_processos")
          .insert({
            tarefa_id: novaTarefa.id,
            publicacao_processo_id: vinculoPublicacaoProcesso.publicacao_processo_id,
          });
      }

      toast.success("Tarefa criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-termo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-processo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      
      form.reset();
      setShowForm(false);
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  }

  // Função para concluir tarefa
  const handleConcluir = async () => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: "cumprido",
          data_cumprimento: new Date().toISOString(),
        })
        .eq("id", tarefaId);
      if (error) throw error;
      
      toast.success("Tarefa concluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tarefa-detalhe", tarefaId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
    } catch (error: any) {
      toast.error(`Erro ao concluir: ${error.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Função para reabrir tarefa
  const handleReabrir = async () => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: "pendente",
          data_cumprimento: null,
        })
        .eq("id", tarefaId);
      if (error) throw error;
      
      toast.success("Tarefa reaberta com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tarefa-detalhe", tarefaId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
    } catch (error: any) {
      toast.error(`Erro ao reabrir: ${error.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Função para enviar comentário
  const handleEnviarComentario = async () => {
    if (!comentario.trim() || !user) return;

    setSendingComment(true);
    try {
      const { error } = await supabase.from("comentarios_tarefas").insert({
        tarefa_id: tarefaId,
        autor_id: user.id,
        conteudo: comentario.trim(),
      });

      if (error) throw error;

      setComentario("");
      queryClient.invalidateQueries({ queryKey: ["comentarios-tarefa", tarefaId] });
      toast.success("Comentário adicionado!");
    } catch (error: any) {
      toast.error(`Erro ao adicionar comentário: ${error.message}`);
    } finally {
      setSendingComment(false);
    }
  };

  // Função para excluir tarefa
  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Remover vínculos primeiro
      await supabase
        .from("tarefas_publicacoes")
        .delete()
        .eq("tarefa_id", tarefaId);
      
      await supabase
        .from("tarefas_publicacoes_processos")
        .delete()
        .eq("tarefa_id", tarefaId);
      
      // Remover comentários
      await supabase
        .from("comentarios_tarefas")
        .delete()
        .eq("tarefa_id", tarefaId);

      // Remover tarefa
      const { error } = await supabase
        .from("tarefas")
        .delete()
        .eq("id", tarefaId);

      if (error) throw error;

      toast.success("Tarefa excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      onVoltar();
    } catch (error: any) {
      toast.error(`Erro ao excluir: ${error.message}`);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Calcular status de vencimento
  const getStatusInfo = () => {
    if (!tarefa || !tarefa.data_vencimento) return null;
    const hoje = startOfDay(new Date());
    const vencimento = startOfDay(new Date(tarefa.data_vencimento));
    const dias = differenceInDays(vencimento, hoje);
    const isConcluido = tarefa.status === "cumprido";
    const isAtrasado = dias < 0 && !isConcluido;

    if (isConcluido) {
      return { label: "Concluído", icon: CheckCircle2, className: "bg-emerald-500 text-white" };
    }
    if (isAtrasado) {
      return { label: `Atrasado (${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""})`, icon: AlertTriangle, className: "bg-destructive text-white" };
    }
    return { label: dias === 0 ? "Vence hoje" : `${dias} dia${dias !== 1 ? "s" : ""} restantes`, icon: Clock, className: "bg-amber-500 text-white" };
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pendente: "secondary",
      em_andamento: "outline",
      cumprido: "default",
      atrasado: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"} className="text-xs">
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const responsaveisNomes = responsaveisProcesso
    .map((r: any) => r.usuario?.nome)
    .filter(Boolean)
    .join(", ") || processo?.advogado_responsavel?.nome || "Não atribuído";

  // Verifica se está carregando o vínculo
  const isLoadingVinculo = vinculoPublicacao === undefined && vinculoPublicacaoProcesso === undefined;

  // Se está carregando
  if (isLoadingVinculo || !tarefa) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Determina se tem publicação vinculada
  const temPublicacao = publicacao !== null && publicacao !== undefined;
  const isConcluido = tarefa.status === "cumprido";
  const statusInfo = getStatusInfo();

  return (
    <div className="flex flex-col lg:flex-row gap-0 border rounded-lg bg-background overflow-hidden min-h-[400px] lg:min-h-[600px]">
      {/* === LADO ESQUERDO - PUBLICAÇÃO OU DETALHES DA TAREFA === */}
      <div className="flex-1 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{temPublicacao ? "Publicação" : "Tarefa"}</h2>
            {getStatusBadge(tarefa.status)}
            {tarefa.prioridade && (
              <Badge 
                variant="outline" 
                className={
                  tarefa.prioridade === 'urgente' ? 'bg-red-50 text-red-700 border-red-300' :
                  tarefa.prioridade === 'alta' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                  tarefa.prioridade === 'media' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                  'bg-slate-50 text-slate-700 border-slate-300'
                }
              >
                {prioridadeLabels[tarefa.prioridade] || tarefa.prioridade}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 md:p-4 space-y-3 md:space-y-4">
            {/* Detalhes da Tarefa */}
            <div className="border rounded-lg p-3 md:p-4 bg-slate-50 dark:bg-slate-900/50 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Título</p>
                <p className="font-semibold text-base md:text-lg break-words">{tarefa.titulo}</p>
              </div>

              {tarefa.tipo_tarefa && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tipo</p>
                  <Badge variant="secondary">{tarefa.tipo_tarefa}</Badge>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Vencimento</p>
                  <p className="font-medium flex items-center gap-1 text-sm md:text-base">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="break-words">{formatDate(tarefa.data_vencimento)}</span>
                  </p>
                </div>
                {tarefa.data_fatal && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Data Fatal</p>
                    <p className="font-medium text-destructive flex items-center gap-1 text-sm md:text-base">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span className="break-words">{formatDate(tarefa.data_fatal)}</span>
                    </p>
                  </div>
                )}
              </div>

              {tarefa.responsavel && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Responsável</p>
                  <p className="font-medium flex items-center gap-1 text-sm md:text-base">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span className="break-words">{tarefa.responsavel.nome}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Descrição da Tarefa */}
            {tarefa.descricao && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Descrição
                </h3>
                <div className="border rounded-lg p-3 md:p-4 bg-white dark:bg-slate-950">
                  <p className="text-xs md:text-sm whitespace-pre-wrap break-words">{tarefa.descricao}</p>
                </div>
              </div>
            )}

            {/* Conteúdo da Publicação (se existir) */}
            {temPublicacao && publicacao && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Publicação Vinculada
                  </h3>
                  
                  {/* Info do Diário */}
                  <div className="border rounded-lg p-3 md:p-4 bg-blue-50 dark:bg-blue-950/30 space-y-2">
                    <p className="font-semibold text-primary text-sm md:text-base break-words">
                      {publicacao.fonte || "Diário de Justiça Eletrônico"} - DJN
                    </p>
                    {processo?.vara && (
                      <p className="text-xs md:text-sm text-muted-foreground break-words">
                        Vara: {processo.vara} - Comarca: {processo.comarca || "Não informada"} - {processo.uf || ""}
                      </p>
                    )}
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Disponibilização: <strong>{formatDateOnlyFull(publicacao.data_disponibilizacao)}</strong> | Publicação: <strong>{formatDateOnlyFull(publicacao.data_publicacao)}</strong>
                    </p>
                    <p className="text-xs md:text-sm break-all">
                      Processo: <span className="font-mono font-medium">{publicacao.processo_numero || processo?.numero}</span>
                    </p>
                    {tipoPublicacao === 'termo' && publicacaoTermo?.monitoramento && (
                      <p className="text-xs md:text-sm break-words">
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
                  <div className="border rounded-lg p-3 md:p-4 bg-white dark:bg-slate-950">
                    <div className={cn("text-xs md:text-sm", conteudoDisplayClasses)}>
                      {formatConteudoParaExibicao(publicacao.conteudo)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* === LADO DIREITO - PROCESSO, COMENTÁRIOS E AÇÕES === */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-muted/10 order-first lg:order-last">
        {/* Header com ações */}
        <div className="p-2 md:p-3 border-b bg-background flex items-center justify-between gap-1 md:gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1 text-xs">
            <ArrowLeft className="w-3 h-3" />
            VOLTAR
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            {temPublicacao && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className="gap-1 text-xs">
                    TRATAMENTOS
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar tarefa
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Calendar className="w-4 h-4 mr-2" />
                    Adicionar prazo
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Gavel className="w-4 h-4 mr-2" />
                    Adicionar audiência
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Botão Excluir */}
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs text-destructive border-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Excluir
            </Button>
            
            {/* Botão Concluir/Reabrir */}
            {isConcluido ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs"
                onClick={handleReabrir}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 mr-1" />
                )}
                Reabrir
              </Button>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                className="text-xs bg-green-600 hover:bg-green-700"
                onClick={handleConcluir}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Check className="w-3 h-3 mr-1" />
                )}
                Concluir
              </Button>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {statusInfo && (
          <div className={`px-4 py-2 flex items-center gap-2 text-sm ${statusInfo.className}`}>
            <statusInfo.icon className="w-4 h-4" />
            <span className="font-medium">{statusInfo.label}</span>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Info do Processo */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                PROCESSO
              </h3>
              {processo && (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-primary">{processo.cliente?.nome || "Cliente não informado"}</p>
                  <div className="grid grid-cols-1 gap-1 text-muted-foreground">
                    <p>Processo: <span className="font-mono text-foreground">{processo.numero}</span></p>
                    <p>Cliente: {processo.cliente?.nome || "-"}</p>
                    <p>Status: {processo.status} | {processo.instancia || "1º Grau"}</p>
                    <p>Responsável: {responsaveisNomes}</p>
                    {processo.classe && <p>Ação: {processo.classe}</p>}
                  </div>
                  <div className="pt-2 text-xs text-muted-foreground">
                    <p className="font-mono">{processo.numero}</p>
                    <p>{processo.vara} - {processo.uf}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Seção de Comentários/Tratamentos */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                COMENTÁRIOS / TRATAMENTOS
              </h3>
              
              {/* Input de novo comentário */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar comentário..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
              </div>
              <Button 
                size="sm" 
                onClick={handleEnviarComentario}
                disabled={sendingComment || !comentario.trim()}
                className="w-full"
              >
                {sendingComment ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Comentário
              </Button>

              {/* Lista de comentários */}
              {loadingComentarios ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : comentarios.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {comentarios.map((c: any) => (
                    <div key={c.id} className="border rounded-lg p-3 bg-background">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{c.autor?.nome || "Usuário"}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.conteudo}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário ainda</p>
              )}
            </div>

            <Separator />

            {/* Formulário de Nova Tarefa - Só mostra quando há publicação vinculada */}
            {showForm && temPublicacao && (
              <>
                <div className="space-y-3 p-4 border rounded-lg bg-background">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Nova Tarefa</h3>
                    <div className="flex items-center gap-2">
                      <BotaoPreencherIA
                        conteudo={publicacao?.conteudo}
                        tipoTarefa={form.watch("tipo_tarefa")}
                        processoNumero={publicacao?.processo_numero || processo?.numero}
                        dataPublicacao={publicacao?.data_publicacao}
                        onResultado={(resultado) => {
                          if (resultado.tipo_tarefa) {
                            form.setValue("tipo_tarefa", resultado.tipo_tarefa);
                          }
                          form.setValue("titulo", resultado.titulo);
                          form.setValue("descricao", resultado.descricao);
                          form.setValue("prioridade", resultado.prioridade);
                          form.setValue("data_vencimento", resultado.data_vencimento);
                        }}
                        size="sm"
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowForm(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                      <FormField
                        control={form.control}
                        name="tipo_tarefa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Tipo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {tiposTarefa.map((tipo) => (
                                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="titulo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Título</FormLabel>
                            <FormControl>
                              <Input placeholder="Título da tarefa" className="h-9" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="descricao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Descrição</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Descrição" className="min-h-[60px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="responsavel_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Responsável</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {membros.map((m: any) => (
                                  <SelectItem key={m.usuario?.id} value={m.usuario?.id || ""}>
                                    {m.usuario?.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="data_vencimento"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Data</FormLabel>
                              <FormControl>
                                <Input type="date" className="h-9" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="prioridade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Prioridade</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="baixa">Baixa</SelectItem>
                                  <SelectItem value="media">Média</SelectItem>
                                  <SelectItem value="alta">Alta</SelectItem>
                                  <SelectItem value="urgente">Urgente</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button type="submit" disabled={loading} className="w-full h-9">
                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Criar Tarefa
                      </Button>
                    </form>
                  </Form>
                </div>
                <Separator />
              </>
            )}

            {/* Lista de Tarefas - Só mostra quando há publicação vinculada */}
            {temPublicacao && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  TAREFAS VINCULADAS À PUBLICAÇÃO
                </h3>
                {tarefasVinculadas.map((t: any) => {
                  const isSelected = t.id === tarefaId;
                  const isVencida = t.data_vencimento && new Date(t.data_vencimento) < new Date() && t.status !== 'cumprido';
                  
                  return (
                    <div key={t.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-4 rounded-full ${isSelected ? 'bg-primary' : 'bg-yellow-400'}`} />
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          TAREFA
                        </span>
                      </div>
                      <Card className={`transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : ''} ${isVencida ? 'border-destructive/50' : ''}`}>
                        <CardContent className="p-3 space-y-2">
                          <p className="text-sm font-medium">{t.titulo}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(t.data_vencimento)}
                            {t.responsavel && (
                              <>
                                <span className="mx-1">•</span>
                                <User className="w-3 h-3" />
                                {t.responsavel.nome}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(t.status)}
                            <Badge variant="outline" className="text-xs">
                              {prioridadeLabels[t.prioridade] || t.prioridade}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}

                {tarefasVinculadas.length === 0 && !showForm && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">Nenhuma tarefa vinculada</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setShowForm(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Criar tarefa
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A tarefa "{tarefa.titulo}" será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
