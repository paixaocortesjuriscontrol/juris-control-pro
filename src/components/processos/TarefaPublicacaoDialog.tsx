import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  Building2,
  Gavel,
  Loader2,
  ListChecks,
  User,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
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

interface TarefaPublicacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefaId: string | null;
  processoId: string;
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

export function TarefaPublicacaoDialog({
  open,
  onOpenChange,
  tarefaId,
  processoId,
}: TarefaPublicacaoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
      if (!tarefaId) return null;
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
    enabled: !!tarefaId && open,
  });

  // Buscar vínculo tarefa-publicação
  const { data: vinculoPublicacao } = useQuery({
    queryKey: ["tarefa-publicacao-vinculo", tarefaId],
    queryFn: async () => {
      if (!tarefaId) return null;
      const { data, error } = await supabase
        .from("tarefas_publicacoes")
        .select("publicacao_id")
        .eq("tarefa_id", tarefaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tarefaId && open,
  });

  // Buscar publicação vinculada
  const { data: publicacao } = useQuery({
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

  // Buscar todas as tarefas vinculadas a esta publicação
  const { data: tarefasVinculadas = [] } = useQuery({
    queryKey: ["tarefas-publicacao", vinculoPublicacao?.publicacao_id],
    queryFn: async () => {
      if (!vinculoPublicacao?.publicacao_id) return [];
      const { data, error } = await supabase
        .from("tarefas_publicacoes")
        .select(`
          tarefa:tarefas(
            id, titulo, status, prioridade, data_vencimento,
            responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
          )
        `)
        .eq("publicacao_id", vinculoPublicacao.publicacao_id);

      if (error) throw error;
      return (data || []).map((d: any) => d.tarefa).filter(Boolean);
    },
    enabled: !!vinculoPublicacao?.publicacao_id,
  });

  // Buscar membros da coordenação do processo
  const { data: processo } = useQuery({
    queryKey: ["processo-coord", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("coordenacao_id")
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!processoId && open,
  });

  const { data: membros } = useQuery({
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

  // Buscar responsáveis do processo
  const { data: responsaveisProcesso } = useQuery({
    queryKey: ["responsaveis-processo", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_responsaveis")
        .select(`
          id,
          advogado:profiles!processos_responsaveis_advogado_id_fkey(id, nome)
        `)
        .eq("processo_id", processoId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId && open,
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
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  async function onSubmit(values: FormValues) {
    if (!user || !vinculoPublicacao?.publicacao_id) return;

    setLoading(true);
    try {
      // Criar tarefa
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

      // Vincular à publicação
      await supabase
        .from("tarefas_publicacoes")
        .insert({
          tarefa_id: novaTarefa.id,
          publicacao_id: vinculoPublicacao.publicacao_id,
        });

      toast.success("Tarefa criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao"] });
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'cumprido':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'atrasado':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Se não há publicação vinculada, mostrar mensagem simples
  if (!vinculoPublicacao && tarefa) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5" />
              {tarefa.titulo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Esta tarefa não está vinculada a uma publicação do DJEN.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Status:</strong>
                <Badge className="ml-2" variant={tarefa.status === 'cumprido' ? 'default' : 'secondary'}>
                  {tarefa.status}
                </Badge>
              </div>
              <div>
                <strong>Vencimento:</strong>
                <span className="ml-2">{formatDate(tarefa.data_vencimento)}</span>
              </div>
              {tarefa.responsavel && (
                <div className="col-span-2">
                  <strong>Responsável:</strong>
                  <span className="ml-2">{tarefa.responsavel.nome}</span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" />
            Publicação e Tarefas
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row h-[calc(90vh-80px)]">
          {/* Lado Esquerdo - Conteúdo da Publicação */}
          <div className="flex-1 border-r overflow-hidden flex flex-col">
            {publicacao ? (
              <>
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className="bg-purple-100 text-purple-700">
                      <Gavel className="w-3 h-3 mr-1" />
                      {publicacao.monitoramento?.tipo === 'advogado'
                        ? `OAB ${publicacao.monitoramento?.oab} ${publicacao.monitoramento?.uf}`
                        : publicacao.monitoramento?.termo_busca
                      }
                    </Badge>
                    {publicacao.monitoramento?.coordenacao?.nome && (
                      <Badge variant="outline">
                        <Building2 className="w-3 h-3 mr-1" />
                        {publicacao.monitoramento.coordenacao.nome}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {publicacao.processo_numero && (
                      <div className="flex items-center gap-2">
                        <strong>Processo:</strong>
                        <span className="font-mono">{publicacao.processo_numero}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Data Publicação:</strong>
                        <p className="text-muted-foreground">{formatDateTime(publicacao.data_publicacao)}</p>
                      </div>
                      {publicacao.fonte && (
                        <div>
                          <strong>Tribunal:</strong>
                          <p className="text-muted-foreground">{publicacao.fonte}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(publicacao.conteudo || "Sem conteúdo", {
                          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'span', 'div'],
                        })
                      }}
                    />
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando publicação...
              </div>
            )}
          </div>

          {/* Lado Direito - Tarefas */}
          <div className="w-full lg:w-[400px] flex flex-col bg-muted/10">
            <div className="p-4 border-b bg-primary/5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  TAREFAS ({tarefasVinculadas.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Tarefas vinculadas a esta publicação
                </p>
              </div>
              {vinculoPublicacao && !showForm && (
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Nova
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 p-4">
              {showForm ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                              className="min-h-[60px] resize-none"
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
                              {(responsaveisProcesso as any)?.map((r: any) => (
                                <SelectItem key={r.advogado?.id} value={r.advogado?.id}>
                                  <div className="flex items-center gap-2">
                                    <User className="w-3 h-3 text-primary" />
                                    {r.advogado?.nome}
                                  </div>
                                </SelectItem>
                              ))}
                              <Separator className="my-1" />
                              {(membros as any)?.map((m: any) => {
                                if ((responsaveisProcesso as any)?.some((r: any) => r.advogado?.id === m.usuario?.id)) {
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
                        onClick={() => setShowForm(false)}
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
              ) : (
                <div className="space-y-3">
                  {tarefasVinculadas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma tarefa vinculada</p>
                    </div>
                  ) : (
                    tarefasVinculadas.map((t: any) => (
                      <Card 
                        key={t.id} 
                        className={`cursor-pointer hover:shadow-md transition-shadow ${
                          t.id === tarefaId ? 'ring-2 ring-primary' : ''
                        }`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(t.status)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant={
                                  t.status === 'cumprido' ? 'default' : 
                                  t.status === 'atrasado' ? 'destructive' : 'secondary'
                                } className="text-xs">
                                  {t.status}
                                </Badge>
                                {t.prioridade && (
                                  <Badge variant="outline" className="text-xs">
                                    {prioridadeLabels[t.prioridade] || t.prioridade}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium text-sm truncate">{t.titulo}</p>
                              {t.responsavel && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <User className="w-3 h-3" />
                                  {t.responsavel.nome}
                                </p>
                              )}
                              {t.data_vencimento && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(t.data_vencimento)}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
