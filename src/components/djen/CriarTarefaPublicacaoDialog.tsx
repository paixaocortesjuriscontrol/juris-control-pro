import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatConteudoParaExibicao, conteudoDisplayClasses, formatDateOnlyFull } from "@/utils/formatConteudo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  Building2,
  Gavel,
  FileSearch,
  ExternalLink,
  Loader2,
  ListChecks,
  User,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { useAuth } from "@/contexts/AuthContext";
import { BotaoPreencherIA } from "@/components/tarefas/BotaoPreencherIA";

type TarefaSimples = { id: string; titulo: string; tipo_tarefa: string | null; status: string; responsavel_nome?: string; data_vencimento?: string | null; data_fatal?: string | null };

// Função helper para buscar tarefas da publicação (isolada para evitar inferência profunda)
async function fetchTarefasPublicacao(publicacaoId: string, tipoOrigem: string | undefined): Promise<TarefaSimples[]> {
  const tarefasMap = new Map<string, TarefaSimples>();
  
  // Helper para buscar detalhes das tarefas e adicionar ao map
  async function fetchAndAddTarefas(tarefaIds: string[]) {
    if (tarefaIds.length === 0) return;
    
    // @ts-ignore - evita inferência profunda do tipo
    const { data: tarefas } = await supabase
      .from("tarefas")
      .select("id, titulo, tipo_tarefa, status, responsavel_id, data_vencimento, data_fatal")
      .in("id", tarefaIds);
    
    if (!tarefas || tarefas.length === 0) return;
    
    // Buscar nomes dos responsáveis separadamente
    const responsavelIds = tarefas.map((t: any) => t.responsavel_id).filter(Boolean);
    let responsaveisMap: Record<string, string> = {};
    
    if (responsavelIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", responsavelIds);
      
      if (profiles) {
        profiles.forEach((p: any) => {
          responsaveisMap[p.id] = p.nome;
        });
      }
    }
    
    tarefas.forEach((t: any) => {
      tarefasMap.set(t.id, {
        id: t.id,
        titulo: t.titulo,
        tipo_tarefa: t.tipo_tarefa,
        status: t.status,
        responsavel_nome: t.responsavel_id ? responsaveisMap[t.responsavel_id] : undefined,
        data_vencimento: t.data_vencimento,
        data_fatal: t.data_fatal
      });
    });
  }
  
  // 1. Buscar via tabela de vínculo tarefas_publicacoes (publicações por termo)
  // Obs: buscamos sempre para garantir compatibilidade com vínculos legados/mistos.
  const { data: tarefasVinculo } = await supabase
    .from("tarefas_publicacoes")
    .select("tarefa_id")
    .eq("publicacao_id", publicacaoId);

  if (tarefasVinculo && tarefasVinculo.length > 0) {
    await fetchAndAddTarefas(tarefasVinculo.map((t: any) => t.tarefa_id));
  }

  // 2. Buscar via tabela de vínculo tarefas_publicacoes_processos (publicações originadas de processos)
  const { data: tarefasProcessoVinculo } = await supabase
    .from("tarefas_publicacoes_processos")
    .select("tarefa_id")
    .eq("publicacao_processo_id", publicacaoId);

  if (tarefasProcessoVinculo && tarefasProcessoVinculo.length > 0) {
    await fetchAndAddTarefas(tarefasProcessoVinculo.map((t: any) => t.tarefa_id));
  }

  
  return Array.from(tarefasMap.values());
}

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

interface CriarTarefaPublicacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicacao: PublicacaoUnificada | null;
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

export function CriarTarefaPublicacaoDialog({
  open,
  onOpenChange,
  publicacao,
}: CriarTarefaPublicacaoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [observacoesIA, setObservacoesIA] = useState<string | null>(null);
  const [mostrarDicaIA, setMostrarDicaIA] = useState(true);
  const [tarefaEditandoId, setTarefaEditandoId] = useState<string | null>(null);
  const openedAtRef = useRef<number>(0);

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

  // Limpar formulário quando abrir o dialog ou mudar a publicação
  useEffect(() => {
    if (open) {
      // Evita que o Radix interprete o clique que abriu como “outside click” e feche instantaneamente
      openedAtRef.current = Date.now();

      form.reset({
        tipo_tarefa: "",
        titulo: "",
        descricao: "",
        responsavel_id: "",
        data_vencimento: format(new Date(), "yyyy-MM-dd"),
        data_fatal: "",
        prioridade: "alta",
      });
      setObservacoesIA(null);
      setMostrarDicaIA(true);
      setTarefaEditandoId(null);
    }
  }, [open, publicacao?.id, form]);

  const resetParaNovaTarefa = () => {
    form.reset({
      tipo_tarefa: "",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      data_vencimento: format(new Date(), "yyyy-MM-dd"),
      data_fatal: "",
      prioridade: "alta",
    });
    setObservacoesIA(null);
    setMostrarDicaIA(true);
    setTarefaEditandoId(null);
  };

  // Fetch membros de TODAS as coordenações (permite delegar para qualquer membro)
  const { data: membros } = useQuery({
    queryKey: ["membros-tarefa-publicacao-todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          coordenacao_id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `);

      if (error) throw error;
      
      // Deduplicar por usuario.id (um membro pode estar em várias coordenações)
      const uniqueMap = new Map<string, typeof data[0]>();
      (data || []).forEach(m => {
        if (m.usuario?.id && !uniqueMap.has(m.usuario.id)) {
          uniqueMap.set(m.usuario.id, m);
        }
      });
      
      // Ordenar por nome
      return Array.from(uniqueMap.values()).sort((a, b) => 
        (a.usuario?.nome || '').localeCompare(b.usuario?.nome || '')
      );
    },
    enabled: open,
  });

  // Fetch responsáveis do processo
  const { data: responsaveisProcesso } = useQuery({
    queryKey: ["responsaveis-processo-publicacao", publicacao?.processo_id],
    queryFn: async () => {
      if (!publicacao?.processo_id) return [];
      const { data, error } = await supabase
        .from("processos_responsaveis")
        .select(`
          id,
          advogado:profiles!processos_responsaveis_advogado_id_fkey(id, nome)
        `)
        .eq("processo_id", publicacao.processo_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!publicacao?.processo_id,
  });

  // Fetch tarefas já criadas para esta publicação (busca em múltiplas fontes)
  const { data: tarefasCriadas, refetch: refetchTarefas } = useQuery({
    queryKey: ["tarefas-publicacao-dialog", publicacao?.id, publicacao?.tipo_origem],
    queryFn: () => fetchTarefasPublicacao(publicacao!.id, publicacao?.tipo_origem),
    enabled: !!publicacao?.id && open,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  async function onSubmit(values: FormValues) {
    if (!publicacao || !user) return;

    setLoading(true);
    try {
      // Se estamos editando uma tarefa existente
      if (tarefaEditandoId) {
        const { error } = await supabase
          .from("tarefas")
          .update({
            responsavel_id: values.responsavel_id,
            titulo: values.titulo,
            descricao: values.descricao || null,
            tipo_tarefa: values.tipo_tarefa,
            data_vencimento: values.data_vencimento,
            data_fatal: values.data_fatal || null,
            prioridade: values.prioridade,
          })
          .eq("id", tarefaEditandoId);

        if (error) throw error;

        toast.success("Tarefa atualizada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["tarefas"] });
        queryClient.invalidateQueries({ queryKey: ["tarefas-processo", publicacao.processo_id] });
        queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-termo"] });
        queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-processo"] });
        queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
        queryClient.invalidateQueries({ queryKey: ["notificacoes-counts"] });
        refetchTarefas();
        setTarefaEditandoId(null);
        
        // Resetar form para nova tarefa
        form.reset({
          tipo_tarefa: "",
          titulo: "",
          descricao: "",
          responsavel_id: (responsaveisProcesso as any)?.[0]?.advogado?.id || "",
          data_vencimento: format(new Date(new Date().setDate(new Date().getDate() + 5)), "yyyy-MM-dd"),
          data_fatal: "",
          prioridade: "media",
        });
        setObservacoesIA(null);
        return;
      }

      // Criar tarefa
      const { data: tarefa, error } = await supabase
        .from("tarefas")
        .insert({
          processo_id: publicacao.processo_id,
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

      // Disparar notificação para o responsável (fire and forget)
      if (tarefa?.id && values.responsavel_id) {
        supabase.functions.invoke("notificar-tarefa-criada", {
          body: {
            tarefa_id: tarefa.id,
            titulo: values.titulo,
            descricao: values.descricao,
            data_vencimento: values.data_vencimento,
            prioridade: values.prioridade,
            processo_id: publicacao.processo_id,
            responsavel_id: values.responsavel_id,
          },
        }).catch((err) => console.log("Erro ao notificar tarefa (ignorado):", err));
      }

      // Vincular tarefa à publicação na tabela N:N correspondente
      if (tarefa?.id) {
        if (publicacao.tipo_origem === 'termo') {
          await supabase
            .from("tarefas_publicacoes")
            .insert({
              tarefa_id: tarefa.id,
              publicacao_id: publicacao.id,
            });
        } else {
          // Publicação de processo
          await supabase
            .from("tarefas_publicacoes_processos")
            .insert({
              tarefa_id: tarefa.id,
              publicacao_processo_id: publicacao.id,
            });
        }
      }

      // Marcar publicação como lida
      if (publicacao.tipo_origem === 'termo') {
        await supabase
          .from("publicacoes_djen")
          .update({ lida: true })
          .eq("id", publicacao.id);
      } else {
        await supabase
          .from("publicacoes_djen_processos")
          .update({ lida: true })
          .eq("id", publicacao.id);
      }

      toast.success("Tarefa criada com sucesso!");
      // Invalidar queries de publicações
      queryClient.invalidateQueries({ queryKey: ["publicacoes-djen"] });
      queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo", publicacao.processo_id] });
      // Invalidar queries de tarefas - incluindo query específica do processo
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo", publicacao.processo_id] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-termo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-processo"] });
      queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
      // Invalidar contagens de notificações
      queryClient.invalidateQueries({ queryKey: ["notificacoes-counts"] });
      // Atualizar a lista de tarefas criadas no dialog
      refetchTarefas();
      
      form.reset();
      // Resetar formulário mas manter dialog aberto para criar mais tarefas
      form.setValue("tipo_tarefa", "");
      form.setValue("titulo", "");
      form.setValue("descricao", "");
      form.setValue("responsavel_id", (responsaveisProcesso as any)?.[0]?.advogado?.id || "");
      form.setValue("data_vencimento", format(new Date(new Date().setDate(new Date().getDate() + 5)), "yyyy-MM-dd"));
      form.setValue("data_fatal", "");
      form.setValue("prioridade", "media");
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  }

  if (!publicacao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col min-h-0"
        onPointerDownOutside={(e) => {
          if (Date.now() - openedAtRef.current < 500) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (Date.now() - openedAtRef.current < 500) e.preventDefault();
        }}
      >
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" />
            Publicação
            {!publicacao.lida && (
              <Badge className="bg-amber-500 text-white ml-1">Nova</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Lado Esquerdo - Conteúdo da Publicação (oculto no mobile para priorizar o formulário) */}
          <div className="hidden lg:flex flex-1 border-r overflow-hidden flex-col">
            <div className="p-4 border-b bg-muted/30">
              {/* Card de tarefas criadas - layout separado e mais visível */}
              {tarefasCriadas && tarefasCriadas.length > 0 && (
                <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ListChecks className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Tarefas criadas ({tarefasCriadas.length})
                      </span>
                    </div>
                    {tarefaEditandoId && (
                      <Button type="button" variant="outline" size="sm" onClick={resetParaNovaTarefa}>
                        Nova
                      </Button>
                    )}
                  </div>

                  <ScrollArea className="h-[150px] md:h-[200px] pr-3">
                    <div className="space-y-2">
                      {tarefasCriadas.map((tarefa, idx) => (
                        <button 
                          type="button"
                          key={tarefa?.id || idx} 
                          onClick={async () => {
                            if (!tarefa?.id) return;
                            // Buscar dados completos da tarefa
                            const { data } = await supabase
                              .from("tarefas")
                              .select("*")
                              .eq("id", tarefa.id)
                              .single();
                            if (data) {
                              form.reset({
                                tipo_tarefa: data.tipo_tarefa || "",
                                titulo: data.titulo || "",
                                descricao: data.descricao || "",
                                responsavel_id: data.responsavel_id || "",
                                data_vencimento: data.data_vencimento || "",
                                data_fatal: data.data_fatal || "",
                                prioridade: (data.prioridade as "baixa" | "media" | "alta" | "urgente") || "alta",
                              });
                              setTarefaEditandoId(tarefa.id);
                              setObservacoesIA(null);
                            }
                          }}
                          className={`text-xs w-full text-left rounded px-2 py-1.5 border transition-colors ${
                            tarefaEditandoId === tarefa?.id 
                              ? "bg-emerald-200 dark:bg-emerald-800 border-emerald-400 dark:border-emerald-600" 
                              : "bg-white dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                          }`}
                        >
                          <div className="font-medium text-emerald-800 dark:text-emerald-200 truncate" title={tarefa?.titulo}>
                            {tarefa?.tipo_tarefa && (
                              <Badge variant="outline" className="mr-1.5 text-[10px] px-1 py-0 font-semibold border-emerald-400 dark:border-emerald-600">
                                {tarefa.tipo_tarefa}
                              </Badge>
                            )}
                            {tarefa?.titulo || "Tarefa"}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-wrap">
                            {tarefa?.responsavel_nome && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {tarefa.responsavel_nome}
                              </span>
                            )}
                            {tarefa?.data_vencimento && (
                              <span className="flex items-center gap-1" title="Data prevista">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(tarefa.data_vencimento), "dd/MM/yy")}
                              </span>
                            )}
                            {tarefa?.data_fatal && (
                              <span className="flex items-center gap-1 text-destructive" title="Data fatal">
                                <AlertTriangle className="w-3 h-3" />
                                {format(new Date(tarefa.data_fatal), "dd/MM/yy")}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mb-3">
                {publicacao.tipo_origem === 'termo' ? (
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                    <FileSearch className="w-3 h-3 mr-1" />
                    {publicacao.monitoramento_tipo === 'advogado'
                      ? `OAB ${publicacao.monitoramento_oab} ${publicacao.monitoramento_uf}`
                      : publicacao.monitoramento_descricao || "Monitoramento por palavra-chave"
                    }
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <Gavel className="w-3 h-3 mr-1" />
                    Processo Cadastrado
                  </Badge>
                )}
                {publicacao.coordenacao_nome && (
                  <Badge variant="outline">
                    <Building2 className="w-3 h-3 mr-1" />
                    {publicacao.coordenacao_nome}
                  </Badge>
                )}
                {publicacao.tribunal && (
                  <Badge variant="secondary">
                    {publicacao.tribunal}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {publicacao.processo_numero && (
                  <div className="flex items-center gap-2">
                    <strong>Processo:</strong>
                    <span className="font-mono">{publicacao.processo_numero}</span>
                    {publicacao.processo_id && (
                      <Link 
                        to={`/processos/${publicacao.processo_id}`}
                        target="_blank"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir
                      </Link>
                    )}
                  </div>
                )}
                
                {/* Datas de disponibilização e publicação lado a lado */}
                <div className="flex gap-6 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Disp: {formatDateOnlyFull(publicacao.data_disponibilizacao)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Pub: {formatDateOnlyFull(publicacao.data_publicacao)}</span>
                  </div>
                </div>

                {publicacao.tipo_origem === 'processo' && (
                  <div className="grid grid-cols-2 gap-4">
                    {publicacao.polo_ativo && (
                      <div>
                        <strong>Polo Ativo:</strong>
                        <p className="text-muted-foreground truncate">{publicacao.polo_ativo}</p>
                      </div>
                    )}
                    {publicacao.polo_passivo && (
                      <div>
                        <strong>Polo Passivo:</strong>
                        <p className="text-muted-foreground truncate">{publicacao.polo_passivo}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className={`text-sm ${conteudoDisplayClasses}`}>
                {formatConteudoParaExibicao(publicacao.conteudo)}
              </div>
            </ScrollArea>
          </div>

          {/* Lado Direito - Formulário de Tarefa */}
          <div className="w-full lg:w-[400px] flex flex-col bg-muted/10 min-h-0">
            <div className="p-4 border-b bg-primary/5 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <ListChecks className="w-4 h-4" />
                    TAREFA
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie uma tarefa a partir desta publicação
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {tarefaEditandoId && (
                    <Button type="button" variant="outline" size="sm" onClick={resetParaNovaTarefa}>
                      Limpar
                    </Button>
                  )}
                  <BotaoPreencherIA
                    conteudo={publicacao.conteudo}
                    tipoTarefa={form.watch("tipo_tarefa")}
                    processoNumero={publicacao.processo_numero}
                    dataPublicacao={publicacao.data_publicacao}
                    onResultado={(resultado) => {
                      if (resultado.tipo_tarefa) {
                        form.setValue("tipo_tarefa", resultado.tipo_tarefa);
                      }
                      form.setValue("titulo", resultado.titulo);
                      form.setValue("descricao", resultado.descricao);
                      form.setValue("prioridade", resultado.prioridade);
                      form.setValue("data_vencimento", resultado.data_vencimento);
                      setObservacoesIA(resultado.observacoes || "Campos preenchidos automaticamente. Revise antes de salvar.");
                      setMostrarDicaIA(false);
                    }}
                    size="sm"
                  />
                </div>
              </div>
              {mostrarDicaIA && (
                <div className="mt-3 p-2.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 border border-violet-200 dark:border-violet-800 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      <span className="font-medium">Dica:</span> Use o botão "Preencher com IA" para sugerir automaticamente os campos da tarefa
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-auto shrink-0 text-violet-500 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900"
                      onClick={() => setMostrarDicaIA(false)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
              {/* Mobile: mostrar tarefas criadas acima do formulário */}
              {tarefasCriadas && tarefasCriadas.length > 0 && (
                <div className="lg:hidden mb-4 p-3 bg-muted/30 border rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ListChecks className="w-4 h-4" />
                      <span className="text-sm font-medium truncate">
                        Tarefas criadas ({tarefasCriadas.length})
                      </span>
                    </div>
                    {tarefaEditandoId && (
                      <Button type="button" variant="outline" size="sm" onClick={resetParaNovaTarefa}>
                        Nova
                      </Button>
                    )}
                  </div>

                  <ScrollArea className="h-[160px] pr-3">
                    <div className="space-y-2">
                      {tarefasCriadas.map((tarefa, idx) => (
                        <button
                          type="button"
                          key={tarefa?.id || idx}
                          onClick={async () => {
                            if (!tarefa?.id) return;
                            const { data } = await supabase
                              .from("tarefas")
                              .select("*")
                              .eq("id", tarefa.id)
                              .single();
                            if (data) {
                              form.reset({
                                tipo_tarefa: data.tipo_tarefa || "",
                                titulo: data.titulo || "",
                                descricao: data.descricao || "",
                                responsavel_id: data.responsavel_id || "",
                                data_vencimento: data.data_vencimento || "",
                                data_fatal: data.data_fatal || "",
                                prioridade: (data.prioridade as "baixa" | "media" | "alta" | "urgente") || "alta",
                              });
                              setTarefaEditandoId(tarefa.id);
                              setObservacoesIA(null);
                            }
                          }}
                          className={`text-xs w-full text-left rounded px-2 py-1.5 border transition-colors ${
                            tarefaEditandoId === tarefa?.id
                              ? "bg-muted border-ring"
                              : "bg-background border-border hover:bg-muted"
                          }`}
                        >
                          <div className="font-medium truncate" title={tarefa?.titulo}>
                            {tarefa?.tipo_tarefa && (
                              <Badge variant="outline" className="mr-1.5 text-[10px] px-1 py-0 font-semibold">
                                {tarefa.tipo_tarefa}
                              </Badge>
                            )}
                            {tarefa?.titulo || "Tarefa"}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-muted-foreground flex-wrap">
                            {tarefa?.responsavel_nome && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {tarefa.responsavel_nome}
                              </span>
                            )}
                            {tarefa?.data_vencimento && (
                              <span className="flex items-center gap-1" title="Data prevista">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(tarefa.data_vencimento), "dd/MM/yy")}
                              </span>
                            )}
                            {tarefa?.data_fatal && (
                              <span className="flex items-center gap-1 text-destructive" title="Data fatal">
                                <AlertTriangle className="w-3 h-3" />
                                {format(new Date(tarefa.data_fatal), "dd/MM/yy")}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {!publicacao.processo_id && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-700 dark:text-amber-400">Processo não cadastrado</p>
                          <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                            Esta publicação não está vinculada a um processo no sistema. A tarefa será criada sem vínculo de processo.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="tipo_tarefa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Tarefa</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposTarefa.map((tipo) => (
                              <SelectItem key={tipo} value={tipo}>
                                {tipo}
                              </SelectItem>
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
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Título da tarefa" {...field} />
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
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva a tarefa..."
                            className="min-h-[120px] resize-y"
                            {...field}
                          />
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
                        <FormLabel>Responsável</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {/* Responsáveis do processo primeiro */}
                            {responsaveisProcesso && responsaveisProcesso.length > 0 && (
                              <>
                                <SelectItem value="__header_resp__" disabled className="font-semibold text-xs text-muted-foreground">
                                  Responsáveis do Processo
                                </SelectItem>
                                {responsaveisProcesso.map((r: any) => (
                                  <SelectItem key={r.advogado?.id} value={r.advogado?.id}>
                                    <div className="flex items-center gap-2">
                                      <User className="w-3 h-3 text-primary" />
                                      {r.advogado?.nome}
                                    </div>
                                  </SelectItem>
                                ))}
                                <Separator className="my-1" />
                              </>
                            )}
                            {/* Outros membros da coordenação */}
                            {membros?.map((m: any) => {
                              // Não mostrar se já está nos responsáveis do processo
                              if (responsaveisProcesso?.some((r: any) => r.advogado?.id === m.usuario?.id)) {
                                return null;
                              }
                              return (
                                <SelectItem key={m.usuario?.id} value={m.usuario?.id}>
                                  {m.usuario?.nome}
                                </SelectItem>
                              );
                            })}
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
                          <FormLabel>Data Prevista</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_fatal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Fatal</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {observacoesIA && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-emerald-700 dark:text-emerald-400">Análise da IA</p>
                          <p className="text-emerald-600 dark:text-emerald-500 text-xs mt-1">
                            {observacoesIA}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="prioridade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(prioridadeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={loading}
                    >
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {tarefaEditandoId ? "Salvar Alterações" : "Criar Tarefa"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
