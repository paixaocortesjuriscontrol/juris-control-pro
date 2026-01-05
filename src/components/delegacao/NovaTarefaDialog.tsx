import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FormDescription,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HelpCircle, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formSchema = z.object({
  tipo_vinculo: z.enum(["processo", "sem_vinculo"]),
  coordenacao_id: z.string().optional(),
  processo_id: z.string().optional(),
  tipo_tarefa: z.string().min(1, "Tipo de tarefa é obrigatório"),
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().optional(),
  responsavel_id: z.string().min(1, "Responsável é obrigatório"),
  data_base: z.string().optional(),
  data_vencimento: z.string().min(1, "Data prevista é obrigatória"),
  hora_prevista: z.string().optional(),
  data_fatal: z.string().optional(),
  hora_fatal: z.string().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  local: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NovaTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacoes: Array<{ id: string; nome: string; area: string }>;
  onSuccess?: () => void;
  processoPreSelecionado?: { id: string; numero: string } | null;
}

const tiposTarefa = [
  "VERIFICAÇÃO",
  "DEFESA",
  "RECURSO",
  "CONTRARRAZÕES",
  "PETIÇÃO",
  "DILIGÊNCIA",
  "AUDIÊNCIA",
  "PROTOCOLO",
  "ANÁLISE",
  "ELABORAÇÃO",
  "SOLICITAÇÃO DE DOCS",
  "OUTROS"
];

export function NovaTarefaDialog({
  open,
  onOpenChange,
  coordenacoes,
  onSuccess,
  processoPreSelecionado,
}: NovaTarefaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [searchProcesso, setSearchProcesso] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_vinculo: "processo",
      coordenacao_id: "",
      processo_id: processoPreSelecionado?.id || "",
      tipo_tarefa: "",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      data_base: format(new Date(), "yyyy-MM-dd"),
      data_vencimento: "",
      hora_prevista: "",
      data_fatal: "",
      hora_fatal: "",
      prioridade: "media",
      local: "",
    },
  });

  const tipoVinculo = form.watch("tipo_vinculo");
  const coordenacaoId = form.watch("coordenacao_id");

  // Fetch membros based on coordination
  const { data: membros } = useQuery({
    queryKey: ["membros-nova-tarefa", coordenacaoId],
    queryFn: async () => {
      if (!coordenacaoId) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `)
        .eq("coordenacao_id", coordenacaoId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!coordenacaoId,
  });

  // Fetch processos based on coordination and search
  const { data: processos, isLoading: loadingProcessos } = useQuery({
    queryKey: ["processos-nova-tarefa", coordenacaoId, searchProcesso],
    queryFn: async () => {
      if (!coordenacaoId && searchProcesso.length < 3) return [];

      let query = supabase
        .from("processos")
        .select(`
          id,
          numero,
          polo_ativo,
          cliente:clientes!processos_cliente_id_fkey(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (coordenacaoId) {
        query = query.eq("coordenacao_id", coordenacaoId);
      }

      if (searchProcesso.length >= 3) {
        query = query.or(`numero.ilike.%${searchProcesso}%,polo_ativo.ilike.%${searchProcesso}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: tipoVinculo === "processo" && (!!coordenacaoId || searchProcesso.length >= 3),
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        tipo_vinculo: "processo",
        coordenacao_id: "",
        processo_id: processoPreSelecionado?.id || "",
        tipo_tarefa: "",
        titulo: "",
        descricao: "",
        responsavel_id: "",
        data_base: format(new Date(), "yyyy-MM-dd"),
        data_vencimento: "",
        hora_prevista: "",
        data_fatal: "",
        hora_fatal: "",
        prioridade: "media",
        local: "",
      });
      setSearchProcesso("");
    }
  }, [open, processoPreSelecionado, form]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const { error } = await supabase.from("prazos").insert({
        processo_id: values.tipo_vinculo === "processo" ? values.processo_id : null,
        responsavel_id: values.responsavel_id,
        titulo: values.titulo,
        descricao: values.descricao || null,
        tipo_tarefa: values.tipo_tarefa,
        data_base: values.data_base || null,
        data_vencimento: values.data_vencimento,
        data_fatal: values.data_fatal || null,
        prioridade: values.prioridade,
        status: "pendente",
      });

      if (error) throw error;

      // Buscar telefone do responsável para enviar WhatsApp
      const { data: responsavel } = await supabase
        .from("profiles")
        .select("nome, telefone")
        .eq("id", values.responsavel_id)
        .single();

      if (responsavel?.telefone) {
        // Montar mensagem de delegação
        const dataFormatada = format(new Date(values.data_vencimento), "dd/MM/yyyy");
        const prioridadeLabel = {
          baixa: "Baixa",
          media: "Média", 
          alta: "Alta",
          urgente: "🚨 URGENTE"
        }[values.prioridade] || values.prioridade;

        let mensagem = `📋 *NOVA TAREFA DELEGADA*\n\n`;
        mensagem += `Olá ${responsavel.nome?.split(" ")[0] || ""}!\n`;
        mensagem += `Você recebeu uma nova tarefa:\n\n`;
        mensagem += `📌 *${values.titulo}*\n`;
        mensagem += `📁 Tipo: ${values.tipo_tarefa}\n`;
        mensagem += `📆 Prazo: ${dataFormatada}\n`;
        mensagem += `⚡ Prioridade: ${prioridadeLabel}\n`;
        if (values.descricao) {
          mensagem += `\n📝 *Descrição:*\n${values.descricao}\n`;
        }
        mensagem += `\n_JurisControl - Sistema de Gestão Jurídica_`;

        // Enviar WhatsApp (não bloqueia a criação da tarefa)
        supabase.functions.invoke("enviar-whatsapp-zapi", {
          body: {
            telefones: [responsavel.telefone],
            mensagem,
            tipo: "evento",
          },
        }).then(({ data, error: whatsappError }) => {
          if (whatsappError) {
            console.error("Erro ao enviar WhatsApp:", whatsappError);
          } else if (data?.enviados > 0) {
            toast({
              title: "WhatsApp enviado",
              description: `Notificação enviada para ${responsavel.nome}`,
            });
          }
        });
      }

      toast({
        title: "Tarefa criada!",
        description: "A tarefa foi criada e delegada com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ["prazos"] });
      queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao criar tarefa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const advogadosDisponiveis = membros
    ?.filter((m) => m.usuario?.id)
    .map((m) => ({ id: m.usuario!.id, nome: m.usuario!.nome })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nova Tarefa
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Crie e delegue uma nova tarefa para sua equipe</p>
              </TooltipContent>
            </Tooltip>
          </DialogTitle>
          <DialogDescription>
            Preencha os campos para criar uma nova tarefa
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Tipo de Vínculo */}
              <FormField
                control={form.control}
                name="tipo_vinculo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Tipo de vínculo
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Vincule a um processo ou crie uma tarefa avulsa</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="processo">Processo</SelectItem>
                        <SelectItem value="sem_vinculo">Sem vínculo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Coordenação */}
              <FormField
                control={form.control}
                name="coordenacao_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coordenação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a coordenação" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {coordenacoes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} - {c.area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Processo (if tipo_vinculo === "processo") */}
              {tipoVinculo === "processo" && (
                <FormField
                  control={form.control}
                  name="processo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Processo vinculado</FormLabel>
                      <FormDescription>
                        {!coordenacaoId && "Selecione uma coordenação ou digite pelo menos 3 caracteres"}
                      </FormDescription>
                      <div className="space-y-2">
                        <Input
                          placeholder="Buscar por número ou parte..."
                          value={searchProcesso}
                          onChange={(e) => setSearchProcesso(e.target.value)}
                        />
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o processo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingProcessos ? (
                              <div className="p-2 text-center text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                              </div>
                            ) : processos?.length === 0 ? (
                              <div className="p-2 text-center text-muted-foreground text-sm">
                                Nenhum processo encontrado
                              </div>
                            ) : (
                              processos?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="font-mono text-xs">{p.numero}</span>
                                  {p.cliente?.nome && (
                                    <span className="text-muted-foreground ml-2">
                                      - {p.cliente.nome}
                                    </span>
                                  )}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Tipo de Tarefa e Título */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo_tarefa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de tarefa *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
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
                      <FormLabel className="flex items-center gap-1">
                        Título
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Título descritivo da tarefa</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Título da tarefa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Responsável */}
              <FormField
                control={form.control}
                name="responsavel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!coordenacaoId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={coordenacaoId ? "Selecione o responsável" : "Selecione uma coordenação primeiro"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {advogadosDisponiveis.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data base */}
              <FormField
                control={form.control}
                name="data_base"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data base</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Datas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="data_vencimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data prevista *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hora_prevista"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora prevista</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="data_fatal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fatal *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hora_fatal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora Fatal</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Prioridade */}
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

              {/* Local */}
              <FormField
                control={form.control}
                name="local"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local/Link</FormLabel>
                    <FormControl>
                      <Input placeholder="Local ou link da tarefa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descrição */}
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalhes adicionais sobre a tarefa..."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
