import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { useAuth } from "@/contexts/AuthContext";

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

  // Fetch membros da coordenação do processo
  const { data: membros } = useQuery({
    queryKey: ["membros-tarefa-publicacao", publicacao?.coordenacao_id],
    queryFn: async () => {
      if (!publicacao?.coordenacao_id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `)
        .eq("coordenacao_id", publicacao.coordenacao_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!publicacao?.coordenacao_id,
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
      queryClient.invalidateQueries({ queryKey: ["publicacoes-djen"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-termo"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-processo"] });
      queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
      
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
      <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" />
            Publicação
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row h-[calc(90vh-80px)]">
          {/* Lado Esquerdo - Conteúdo da Publicação */}
          <div className="flex-1 border-r overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex flex-wrap gap-2 mb-3">
                {publicacao.tipo_origem === 'termo' ? (
                  <Badge className="bg-purple-100 text-purple-700">
                    <FileSearch className="w-3 h-3 mr-1" />
                    {publicacao.monitoramento_tipo === 'advogado'
                      ? `OAB ${publicacao.monitoramento_oab} ${publicacao.monitoramento_uf}`
                      : publicacao.monitoramento_termo
                    }
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-700">
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
                {!publicacao.lida && (
                  <Badge className="bg-amber-500">Nova</Badge>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Disponibilização:</strong>
                    <p className="text-muted-foreground">{formatDate(publicacao.data_disponibilizacao)}</p>
                  </div>
                  <div>
                    <strong>Publicação:</strong>
                    <p className="text-muted-foreground">{formatDate(publicacao.data_publicacao)}</p>
                  </div>
                  {publicacao.tribunal && (
                    <div>
                      <strong>Tribunal:</strong>
                      <p className="text-muted-foreground">{publicacao.tribunal}</p>
                    </div>
                  )}
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
          <div className="w-full lg:w-[400px] flex flex-col bg-muted/10">
            <div className="p-4 border-b bg-primary/5">
              <h3 className="font-semibold flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                TAREFA
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Crie uma tarefa a partir desta publicação
              </p>
            </div>

            <ScrollArea className="flex-1 p-4">
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
                            className="min-h-[80px] resize-none"
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
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                      Criar Tarefa
                    </Button>
                  </div>
                </form>
              </Form>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
