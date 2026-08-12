import { useState, useEffect } from "react";
import { usePodeCancelarItens } from "@/hooks/usePodeCancelarItens";
import { usePodeAlterarDatas } from "@/hooks/usePodeAlterarDatas";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Save,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENDA_INFINITE_QUERY_KEY } from "@/hooks/useAgendaUnificada";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { useCoordenadoresDaCoordenacao } from "@/hooks/useCoordenadoresDaCoordenacao";

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
  autoEdit?: boolean;
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
  autoEdit,
}: TarefaAgendaPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [comentario, setComentario] = useState("");
  const { podeCancelar } = usePodeCancelarItens();
  const { datasBloqueadas, motivoBloqueio } = usePodeAlterarDatas();
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
  
  // Modo de edição inline
  const [isEditing, setIsEditing] = useState(!!autoEdit);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    titulo: "",
    descricao: "",
    tipo_tarefa: "",
    data_vencimento: "",
    data_fatal: "",
    prioridade: "",
    local: "",
    responsavel_id: "",
    // campos de evento
    tipo: "",
    data_inicio: "",
    data_fim: "",
  });
  // Multi-select de pessoas (responsáveis + envolvidos) — aplica a tarefas
  const [editResponsaveisIds, setEditResponsaveisIds] = useState<string[]>([]);
  const [editEnvolvidosIds, setEditEnvolvidosIds] = useState<string[]>([]);
  const [editMostrarEnvolvidos, setEditMostrarEnvolvidos] = useState(false);

  // Responsáveis fixos da coordenação e do tipo do item recebem o cadeado
  const { data: itemCoordenacaoId } = useQuery({
    queryKey: ["item-coordenacao-id", tarefa.origem, tarefa.id],
    queryFn: async () => {
      const tabela = tarefa.origem === "tarefa" ? "tarefas" : "eventos_agenda";
      const { data } = await supabase
        .from(tabela as any)
        .select("coordenacao_id")
        .eq("id", tarefa.id)
        .maybeSingle();
      return ((data as any)?.coordenacao_id as string | null) ?? null;
    },
  });
  const { data: coordenadoresIds = [] } = useCoordenadoresDaCoordenacao(
    itemCoordenacaoId || null,
    tarefa.origem === "tarefa" ? (editForm.tipo_tarefa || tarefa.tipo_tarefa || "TAREFA EQUIPE") : "OUTROS",
  );
  useEffect(() => {
    if (!isEditing || coordenadoresIds.length === 0) return;
    setEditResponsaveisIds((prev) => {
      const faltando = coordenadoresIds.filter((id) => !prev.includes(id));
      return faltando.length > 0 ? [...prev, ...faltando] : prev;
    });
  }, [isEditing, JSON.stringify(coordenadoresIds)]);

  // Usar statusOverride se disponível, senão usar status original
  const statusAtual = statusOverride ?? tarefa.status;

  const isParcelamento = tarefa.tipo === "parcelamento" || tarefa.tipo === "prazo_parcela";

  // Buscar membros para o select de responsável (edição inline)
  const { data: membrosEdicao = [] } = useQuery({
    queryKey: ["membros-edicao-panel", tarefa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: isEditing,
  });

  // Preencher formulário ao abrir edição
  useEffect(() => {
    if (isEditing) {
      if (tarefa.origem === "tarefa") {
        setEditForm({
          titulo: tarefa.titulo || "",
          descricao: tarefa.descricao || "",
          tipo_tarefa: tarefa.tipo_tarefa || "",
          data_vencimento: tarefa.data_vencimento?.substring(0, 10) || tarefa.data_inicio?.substring(0, 10) || "",
          data_fatal: tarefa.data_fatal?.substring(0, 10) || "",
          prioridade: tarefa.prioridade || "media",
          local: tarefa.local || "",
          responsavel_id: tarefa.responsavel_id || "",
          tipo: "",
          data_inicio: "",
          data_fim: "",
        });
        // Carregar responsáveis/envolvidos existentes
        (async () => {
          const [{ data: resps }, { data: envs }] = await Promise.all([
            supabase
              .from("tarefa_responsaveis")
              .select("usuario_id, created_at")
              .eq("tarefa_id", tarefa.id)
              .order("created_at", { ascending: true }),
            supabase.from("tarefa_envolvidos").select("usuario_id").eq("tarefa_id", tarefa.id),
          ]);
          const respIdsRaw = (resps || []).map((r: any) => r.usuario_id);
          // Preserva o responsável principal na primeira posição
          const respIds = tarefa.responsavel_id && respIdsRaw.includes(tarefa.responsavel_id)
            ? [tarefa.responsavel_id, ...respIdsRaw.filter((id: string) => id !== tarefa.responsavel_id)]
            : respIdsRaw;
          const envIds = (envs || []).map((e: any) => e.usuario_id);
          setEditResponsaveisIds(
            respIds.length > 0 ? respIds : tarefa.responsavel_id ? [tarefa.responsavel_id] : [],
          );
          setEditEnvolvidosIds(envIds);
          setEditMostrarEnvolvidos(envIds.length > 0);
        })();
      } else {
        setEditForm({
          titulo: tarefa.titulo || "",
          descricao: tarefa.descricao || "",
          tipo_tarefa: "",
          data_vencimento: "",
          data_fatal: "",
          prioridade: "",
          local: tarefa.local || "",
          responsavel_id: "",
          tipo: tarefa.tipo || "evento",
          data_inicio: tarefa.data_inicio?.substring(0, 16) || "",
          data_fim: tarefa.data_fim?.substring(0, 16) || "",
        });
        // Carregar participantes do evento
        (async () => {
          const { data: parts } = await supabase
            .from("participantes_evento")
            .select("usuario_id")
            .eq("evento_id", tarefa.id);
          setEditEnvolvidosIds((parts || []).map((p: any) => p.usuario_id));
          setEditMostrarEnvolvidos(true);
          setEditResponsaveisIds([]);
        })();
      }
    }
  }, [isEditing]);



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
    if (statusAtual === "cancelado") {
      return {
        label: "Cancelada",
        icon: X,
        className: "bg-zinc-500 text-white",
      };
    }
    if (statusAtual === "concluido" || statusAtual === "cumprido") {
      return {
        label: "Concluída",
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

  // A conclusão deixou de ser uma ação rápida: agora é apenas uma situação
  // ("Concluído com sucesso" / "Concluído sem sucesso") escolhida no formulário.

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
    return _handleEnviarComentario();
  };

  const handleCancelar = async () => {
    setUpdatingStatus(true);
    try {
      const updatedAt = new Date().toISOString();
      const table = tarefa.origem === "tarefa" ? "tarefas" : "eventos_agenda";
      const { error } = await supabase
        .from(table)
        .update({ status: "cancelado", updated_at: updatedAt } as any)
        .eq("id", tarefa.id);
      if (error) throw error;
      setStatusOverride("cancelado");
      patchAgendaCacheStatus("cancelado", null);
      toast({ title: "Cancelada!" });
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const _handleEnviarComentario = async () => {
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
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      if (tarefa.origem === "tarefa") {
        if (editResponsaveisIds.length === 0) {
          toast({
            title: "Selecione ao menos um responsável",
            variant: "destructive",
          });
          setSavingEdit(false);
          return;
        }
        const updateData: Record<string, any> = {
          titulo: editForm.titulo.trim(),
          descricao: editForm.descricao || null,
          data_vencimento: editForm.data_vencimento || null,
          data_fatal: editForm.data_fatal || null,
          prioridade: editForm.prioridade || "media",
          updated_at: new Date().toISOString(),
          responsavel_id:
            tarefa.responsavel_id && editResponsaveisIds.includes(tarefa.responsavel_id)
              ? tarefa.responsavel_id
              : (editResponsaveisIds.find((id) => !coordenadoresIds.includes(id)) || editResponsaveisIds[0]),
        };
        const { error } = await supabase
          .from("tarefas")
          .update(updateData)
          .eq("id", tarefa.id);
        if (error) throw error;
        // Sincronizar responsáveis e envolvidos
        await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", tarefa.id);
        if (editResponsaveisIds.length > 0) {
          await supabase.from("tarefa_responsaveis").insert(
            editResponsaveisIds.map((uid) => ({ tarefa_id: tarefa.id, usuario_id: uid })),
          );
        }
        await supabase.from("tarefa_envolvidos").delete().eq("tarefa_id", tarefa.id);
        if (editEnvolvidosIds.length > 0) {
          await supabase.from("tarefa_envolvidos").insert(
            editEnvolvidosIds.map((uid) => ({ tarefa_id: tarefa.id, usuario_id: uid })),
          );
        }
      } else {
        const updateData: Record<string, any> = {
          titulo: editForm.titulo.trim(),
          descricao: editForm.descricao || null,
          tipo: editForm.tipo || tarefa.tipo,
          local: editForm.local || null,
          updated_at: new Date().toISOString(),
        };
        if (editForm.data_inicio) {
          updateData.data_inicio = new Date(editForm.data_inicio).toISOString();
        }
        if (editForm.data_fim) {
          updateData.data_fim = new Date(editForm.data_fim).toISOString();
        }
        const { error } = await supabase
          .from("eventos_agenda")
          .update(updateData)
          .eq("id", tarefa.id);
        if (error) throw error;
        // Sincronizar participantes
        await supabase.from("participantes_evento").delete().eq("evento_id", tarefa.id);
        if (editEnvolvidosIds.length > 0) {
          await supabase.from("participantes_evento").insert(
            editEnvolvidosIds.map((uid) => ({ evento_id: tarefa.id, usuario_id: uid })),
          );
        }
      }
      toast({ title: "Salvo com sucesso!" });
      await queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["lista-atividades"] });
      await queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      await queryClient.invalidateQueries({ queryKey: ["tarefas-paginated"] });
      await queryClient.invalidateQueries({ queryKey: ["tarefas-stats"] });
      onUpdate();
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
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

  const canEdit = tarefa.criado_por === user?.id || !tarefa.criado_por || tarefa.responsavel_id === user?.id;
  const isConcluido = tarefa.status === "concluido" || tarefa.status === "cumprido";

  return (
    <Card className="h-full flex flex-col border-0 shadow-none">
      <CardHeader className="pb-3 space-y-3 shrink-0 sticky top-0 z-10 bg-card border-b">
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
          {isConcluido && (
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

          {podeCancelar && statusAtual !== "cancelado" && !isConcluido && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelar}
              disabled={updatingStatus}
              className="text-destructive border-destructive/40 hover:bg-red-50 hover:text-red-700"
            >
              <X className="w-3 h-3 mr-1" />
              Cancelar
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

          {canEdit && (
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

      {/* ===== MODO EDIÇÃO INLINE ===== */}
      {isEditing ? (
        <ScrollArea className="flex-1">
          <CardContent className="py-4">
            {/* Header da edição */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Edit className="w-4 h-4 text-primary" />
                Editar {tarefa.origem === "tarefa" ? "Tarefa" : "Evento"}
              </h4>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <ArrowLeft className="w-3 h-3 mr-1" />
                Cancelar
              </Button>
            </div>

            <div className="space-y-4">
              {/* Título — ocupa linha inteira */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Título *</Label>
                <Input
                  value={editForm.titulo}
                  onChange={(e) => setEditForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Título da tarefa"
                />
              </div>

              {/* Descrição — auto-resize, nunca corta */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Textarea
                  value={editForm.descricao}
                  onChange={(e) => {
                    setEditForm(f => ({ ...f, descricao: e.target.value }));
                    // Auto-resize
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  onFocus={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  placeholder="Descrição..."
                  className="resize-none overflow-hidden min-h-[80px]"
                  style={{ height: "auto" }}
                />
              </div>

              {/* Campos específicos de TAREFA */}
              {tarefa.origem === "tarefa" && (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Prioridade</Label>
                      <Select
                        value={editForm.prioridade}
                        onValueChange={(v) => setEditForm(f => ({ ...f, prioridade: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Prioridade" />
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

                  {/* Linha 2: Data Prevista + Data Fatal */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data Prevista</Label>
                      <Input
                        type="date"
                        value={editForm.data_vencimento}
                        onChange={(e) => setEditForm(f => ({ ...f, data_vencimento: e.target.value }))}
                        disabled={datasBloqueadas}
                        title={datasBloqueadas ? motivoBloqueio : undefined}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data Fatal</Label>
                      <Input
                        type="date"
                        value={editForm.data_fatal}
                        onChange={(e) => setEditForm(f => ({ ...f, data_fatal: e.target.value }))}
                        disabled={datasBloqueadas}
                        title={datasBloqueadas ? motivoBloqueio : undefined}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Linha 3: Responsável */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Responsáveis<span className="text-destructive">*</span>
                    </Label>
                    <PeoplePicker
                      selectedIds={editResponsaveisIds}
                      onChange={setEditResponsaveisIds}
                      placeholder="Adicionar responsável"
                      emptyLabel="Nenhum responsável selecionado"
                      lockedIds={coordenadoresIds}
                    />
                    {coordenadoresIds.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Responsáveis fixos configurados para este tipo não podem ser removidos.
                      </p>
                    )}
                    {!editMostrarEnvolvidos && (
                      <button
                        type="button"
                        onClick={() => setEditMostrarEnvolvidos(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        + Envolver mais pessoas
                      </button>
                    )}
                  </div>
                  {editMostrarEnvolvidos && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Envolvidos (acompanham)</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMostrarEnvolvidos(false);
                            setEditEnvolvidosIds([]);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Ocultar
                        </button>
                      </div>
                      <PeoplePicker
                        selectedIds={editEnvolvidosIds}
                        onChange={setEditEnvolvidosIds}
                        placeholder="Adicionar envolvido"
                        emptyLabel="Apenas para acompanhamento"
                        icon="users"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Campos específicos de EVENTO */}
              {tarefa.origem === "evento" && (
                <>
                  {/* Linha 1: Tipo + Local */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <Select
                        value={editForm.tipo}
                        onValueChange={(v) => setEditForm(f => ({ ...f, tipo: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Tipo do evento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="evento">Evento</SelectItem>
                          <SelectItem value="tarefa">Tarefa</SelectItem>
                          <SelectItem value="prazo">Prazo</SelectItem>
                          <SelectItem value="audiencia">Audiência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Local</Label>
                      <Input
                        value={editForm.local}
                        onChange={(e) => setEditForm(f => ({ ...f, local: e.target.value }))}
                        placeholder="Local..."
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Linha 2: Data/Hora Início + Fim */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data/Hora Início</Label>
                      <Input
                        type="datetime-local"
                        value={editForm.data_inicio}
                        onChange={(e) => setEditForm(f => ({ ...f, data_inicio: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data/Hora Fim</Label>
                      <Input
                        type="datetime-local"
                        value={editForm.data_fim}
                        onChange={(e) => setEditForm(f => ({ ...f, data_fim: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Envolvidos / Participantes do evento */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Envolvidos / Participantes</Label>
                    <PeoplePicker
                      selectedIds={editEnvolvidosIds}
                      onChange={setEditEnvolvidosIds}
                      placeholder="Adicionar participante"
                      emptyLabel="Nenhum participante"
                      icon="users"
                    />
                  </div>
                </>
              )}

              {/* Botões de ação */}
              <div className="flex gap-2 pt-2 sticky bottom-0 bg-card border-t -mx-6 px-6 pb-2 z-10">
                <Button
                  className="flex-1"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editForm.titulo.trim()}
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar alterações
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} disabled={savingEdit}>
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1">
          <CardContent className="space-y-4">
            {/* Info grid (estilo Em Lista) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Vencimento:</span>
                <span className="font-medium">
                  {format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span
                  className={cn(
                    "font-medium",
                    isAtrasado && "text-destructive",
                    !isAtrasado && !isConcluido && dias <= 3 && dias >= 0 && "text-amber-600",
                  )}
                >
                  {isConcluido && tarefa.concluido_em
                    ? `Concluído em ${format(parseISO(tarefa.concluido_em), "dd/MM/yyyy", { locale: ptBR })}`
                    : isAtrasado
                      ? `${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""} de atraso`
                      : dias === 0
                        ? "Vence hoje"
                        : `${dias} dia${dias !== 1 ? "s" : ""} restantes`}
                </span>
              </div>
              {tarefa.responsavel && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Responsável:</span>
                  <span className="font-medium truncate">{tarefa.responsavel.nome}</span>
                </div>
              )}
              {(tarefa.processo?.numero || processoCompleto?.numero) && (
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Processo:</span>
                  <span className="font-mono text-xs truncate">
                    {tarefa.processo?.numero || processoCompleto?.numero}
                  </span>
                  {processoCompleto?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                      <a href={`/processos/${processoCompleto.id}`} title="Abrir processo">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {tarefa.descricao && (
              <div>
                <h4 className="text-sm font-medium mb-1">Descrição</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {tarefa.descricao}
                </p>
              </div>
            )}

            {tarefa.local && (
              <div>
                <h4 className="text-sm font-medium mb-1">Local</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tarefa.local}</p>
              </div>
            )}

            <Separator />

            {/* Comentários inline (sem collapsible) */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comentários e Conversas ({comentarios?.length || 0})
              </h4>

              <div className="space-y-2">
                <MentionInput
                  placeholder="Digite seu comentário..."
                  value={comentario}
                  onChange={setComentario}
                  rows={2}
                  maxLength={2000}
                />
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

              {loadingComentarios ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : comentarios?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda. Inicie a conversa!
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
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
                      <p className="text-sm pl-8 whitespace-pre-wrap">{c.conteudo}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </ScrollArea>
      )}

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
