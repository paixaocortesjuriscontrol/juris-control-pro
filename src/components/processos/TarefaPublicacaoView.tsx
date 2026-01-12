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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Edit,
  MessageSquare,
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

interface TarefaPublicacaoViewProps {
  tarefaId: string;
  processoId: string;
  onVoltar: () => void;
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
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [publicacaoExpanded, setPublicacaoExpanded] = useState(true);

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

  // Buscar vínculo tarefa-publicação
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

  // Buscar publicação vinculada
  const { data: publicacao, isLoading: loadingPublicacao } = useQuery({
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

  // Buscar membros da coordenação do processo
  const { data: processo } = useQuery({
    queryKey: ["processo-coord", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("coordenacao_id, numero, cliente:clientes(nome)")
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      return data;
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
    if (!user || !vinculoPublicacao?.publicacao_id) return;

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pendente: "secondary",
      em_andamento: "outline",
      cumprido: "default",
      atrasado: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const colors: Record<string, string> = {
      baixa: "bg-slate-100 text-slate-700",
      media: "bg-blue-100 text-blue-700",
      alta: "bg-orange-100 text-orange-700",
      urgente: "bg-red-100 text-red-700",
    };
    return (
      <Badge className={colors[prioridade] || ""}>
        {prioridadeLabels[prioridade] || prioridade}
      </Badge>
    );
  };

  // Se não há publicação vinculada
  if (vinculoPublicacao === null && tarefa) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onVoltar} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para tarefas
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5" />
              {tarefa.titulo}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Esta tarefa não está vinculada a uma publicação do DJEN.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Status:</strong>
                <span className="ml-2">{getStatusBadge(tarefa.status)}</span>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com botão voltar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onVoltar} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para tarefas
        </Button>
        <Badge variant="outline" className="text-xs">
          NÃO TRATADA
        </Badge>
      </div>

      {/* Layout Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lado Esquerdo - Publicação */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Publicação
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPublicacaoExpanded(!publicacaoExpanded)}
              >
                {publicacaoExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>

          {loadingPublicacao ? (
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : publicacao ? (
            <CardContent className="p-0">
              {/* Metadados da publicação */}
              <div className="p-4 border-b bg-muted/20 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <Gavel className="w-3 h-3 mr-1" />
                    {publicacao.fonte || "DJEN"}
                  </Badge>
                  {publicacao.monitoramento?.coordenacao?.nome && (
                    <Badge variant="secondary">
                      <Building2 className="w-3 h-3 mr-1" />
                      {publicacao.monitoramento.coordenacao.nome}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {publicacao.processo_numero && (
                    <div>
                      <p className="text-xs text-muted-foreground">Processo</p>
                      <p className="font-mono font-medium">{publicacao.processo_numero}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Data Publicação</p>
                    <p className="font-medium">{formatDateTime(publicacao.data_publicacao)}</p>
                  </div>
                </div>

                {publicacao.monitoramento && (
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground">Termo Encontrado</p>
                    <p className="font-medium text-primary">
                      {publicacao.monitoramento.tipo === 'advogado'
                        ? `OAB ${publicacao.monitoramento.oab} ${publicacao.monitoramento.uf}`
                        : publicacao.monitoramento.termo_busca
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Conteúdo da publicação */}
              {publicacaoExpanded && (
                <ScrollArea className="h-[400px]">
                  <div className="p-4">
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(publicacao.conteudo || "Sem conteúdo disponível", {
                          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'span', 'div', 'ul', 'ol', 'li'],
                        })
                      }}
                    />
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          ) : (
            <CardContent className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Publicação não encontrada</p>
            </CardContent>
          )}
        </Card>

        {/* Lado Direito - Tarefas e Info do Processo */}
        <div className="space-y-4">
          {/* Info do Processo */}
          {processo && (
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">PROCESSO</p>
                <p className="font-mono font-medium text-sm">{processo.numero}</p>
                {processo.cliente?.nome && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Cliente: {processo.cliente.nome}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Lista de Tarefas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="w-5 h-5" />
                  Tarefas ({tarefasVinculadas.length})
                </CardTitle>
                {vinculoPublicacao && !showForm && (
                  <Button size="sm" onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Nova Tarefa
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
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
                          <FormLabel>Descrição (opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Descrição adicional"
                              className="min-h-[80px]"
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

                    <div className="grid grid-cols-2 gap-4">
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

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={loading} className="flex-1">
                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Criar Tarefa
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForm(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3">
                    {tarefasVinculadas.map((t: any) => {
                      const isSelected = t.id === tarefaId;
                      const isVencida = t.data_vencimento && new Date(t.data_vencimento) < new Date() && t.status !== 'cumprido';
                      
                      return (
                        <Card 
                          key={t.id} 
                          className={`transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : ''} ${isVencida ? 'border-destructive/50' : ''}`}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {t.tipo_tarefa && (
                                    <Badge variant="outline" className="text-xs">
                                      {t.tipo_tarefa}
                                    </Badge>
                                  )}
                                  {getStatusBadge(t.status)}
                                  {getPrioridadeBadge(t.prioridade)}
                                </div>
                                <p className="font-medium text-sm">{t.titulo}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(t.data_vencimento)}
                              </div>
                              {t.responsavel && (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {t.responsavel.nome}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {tarefasVinculadas.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma tarefa vinculada</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => setShowForm(true)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Criar primeira tarefa
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
