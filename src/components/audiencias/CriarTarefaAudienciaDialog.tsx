import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { toast } from "sonner";
import {
  Calendar,
  FileText,
  Loader2,
  ListChecks,
  User,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  tipo_tarefa: z.string().min(1, "Tipo é obrigatório"),
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().optional(),
  responsavel_id: z.string().min(1, "Responsável é obrigatório"),
  data_vencimento: z.string().min(1, "Data prevista é obrigatória"),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
});

type FormValues = z.infer<typeof formSchema>;

interface CriarTarefaAudienciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audiencia: AudienciaDetectada | null;
}

const tiposTarefa = [
  "PRAZO",
  "TAREFA EQUIPE",
  "AUDIÊNCIA",
  "PREPARAÇÃO AUDIÊNCIA",
  "DILIGÊNCIA",
  "ANÁLISE",
  "PROVIDÊNCIA",
  "OUTROS"
];

export function CriarTarefaAudienciaDialog({
  open,
  onOpenChange,
  audiencia,
}: CriarTarefaAudienciaDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_tarefa: "AUDIÊNCIA",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      data_vencimento: format(new Date(), "yyyy-MM-dd"),
      prioridade: "alta",
    },
  });

  // Buscar coordenação do processo
  const { data: processoData } = useQuery({
    queryKey: ["processo-audiencia", audiencia?.processo_id],
    queryFn: async () => {
      if (!audiencia?.processo_id) return null;
      const { data, error } = await supabase
        .from("processos")
        .select("id, coordenacao_id")
        .eq("id", audiencia.processo_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!audiencia?.processo_id,
  });

  // Fetch membros da coordenação
  const { data: membros } = useQuery({
    queryKey: ["membros-tarefa-audiencia", processoData?.coordenacao_id],
    queryFn: async () => {
      if (!processoData?.coordenacao_id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `)
        .eq("coordenacao_id", processoData.coordenacao_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!processoData?.coordenacao_id,
  });

  // Fetch responsáveis do processo
  const { data: responsaveisProcesso } = useQuery({
    queryKey: ["responsaveis-processo-audiencia", audiencia?.processo_id],
    queryFn: async () => {
      if (!audiencia?.processo_id) return [];
      const { data, error } = await supabase
        .from("processos_responsaveis")
        .select(`
          id,
          advogado:profiles!processos_responsaveis_advogado_id_fkey(id, nome)
        `)
        .eq("processo_id", audiencia.processo_id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!audiencia?.processo_id,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && audiencia) {
      const dataAudiencia = audiencia.data_audiencia 
        ? format(new Date(audiencia.data_audiencia), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");
      
      form.reset({
        tipo_tarefa: "AUDIÊNCIA",
        titulo: `AUDIÊNCIA - ${audiencia.tipo_audiencia || "A DEFINIR"}`,
        descricao: `Audiência ${audiencia.tipo_audiencia || ""} - Processo: ${audiencia.processo_numero || "N/A"}\n${audiencia.vara_camara ? `Vara: ${audiencia.vara_camara}` : ""}\n${audiencia.comarca ? `Comarca: ${audiencia.comarca}` : ""}`.trim(),
        responsavel_id: (responsaveisProcesso as any)?.[0]?.advogado?.id || "",
        data_vencimento: dataAudiencia,
        prioridade: "alta",
      });
    }
  }, [open, audiencia, responsaveisProcesso, form]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  async function onSubmit(values: FormValues) {
    if (!audiencia || !user) return;

    setLoading(true);
    try {
      const { data: tarefa, error } = await supabase
        .from("tarefas")
        .insert({
          processo_id: audiencia.processo_id,
          responsavel_id: values.responsavel_id,
          titulo: values.titulo,
          descricao: values.descricao || null,
          tipo_tarefa: values.tipo_tarefa,
          data_vencimento: values.data_vencimento,
          prioridade: values.prioridade,
          status: "pendente",
          criado_por: user.id,
          origem: "painel_audiencias",
        })
        .select()
        .single();

      if (error) throw error;

      // Vincular tarefa à audiência
      if (tarefa?.id) {
        await supabase
          .from("audiencias_detectadas")
          .update({ tarefa_id: tarefa.id })
          .eq("id", audiencia.id);
      }

      toast.success("Tarefa criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["audiencias-detectadas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  }

  if (!audiencia) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-5 h-5" />
            Criar Tarefa - Audiência
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Lado Esquerdo - Detalhes da Audiência */}
          <div className="hidden lg:flex flex-1 border-r overflow-hidden flex-col">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                  {audiencia.tipo_audiencia || "Audiência"}
                </Badge>
                {audiencia.origem === 'manual' ? (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Manual</Badge>
                ) : (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600">Detectado</Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <strong>Data:</strong>
                  <span>{formatDate(audiencia.data_audiencia)}</span>
                  {audiencia.hora && <span className="text-muted-foreground">às {audiencia.hora}</span>}
                </div>

                {audiencia.processo_numero && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <strong>Processo:</strong>
                    <span className="font-mono">{audiencia.processo_numero}</span>
                  </div>
                )}

                {(audiencia.vara_camara || audiencia.comarca) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{[audiencia.vara_camara, audiencia.comarca].filter(Boolean).join(' - ')}</span>
                  </div>
                )}

                {audiencia.cliente && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <strong>Cliente:</strong>
                    <span>{audiencia.cliente}</span>
                  </div>
                )}
              </div>
            </div>

            {audiencia.conteudo_publicacao && (
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  <strong className="text-sm">Conteúdo da Publicação:</strong>
                  <div className={cn("text-sm p-3 bg-muted/50 rounded-lg", conteudoDisplayClasses)}>
                    {formatConteudoParaExibicao(audiencia.conteudo_publicacao)}
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Lado Direito - Formulário */}
          <div className="w-full lg:w-[400px] flex flex-col bg-muted/10 min-h-0">
            <div className="p-4 border-b bg-primary/5 shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                NOVA TAREFA
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Crie uma tarefa a partir desta audiência
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
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
                          <Input {...field} placeholder="Título da tarefa" />
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
                            {...field}
                            placeholder="Descrição da tarefa"
                            className="min-h-[100px] resize-none"
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
                            {responsaveisProcesso?.map((r: any) => (
                              <SelectItem key={r.advogado?.id} value={r.advogado?.id || ""}>
                                {r.advogado?.nome} (Responsável)
                              </SelectItem>
                            ))}
                            {membros?.filter((m: any) => 
                              !responsaveisProcesso?.some((r: any) => r.advogado?.id === m.usuario?.id)
                            ).map((m: any) => (
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

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Criar Tarefa
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
