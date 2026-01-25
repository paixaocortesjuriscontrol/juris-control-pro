import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  responsavel_id: z.string().min(1, "Selecione um responsável"),
  processos_ids: z.array(z.string()).min(1, "Selecione ao menos um processo"),
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().optional(),
  data_vencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
});

type FormValues = z.infer<typeof formSchema>;

interface DelegarTarefaLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  membros: Array<{ id: string; usuario?: { id: string; nome: string } | null }>;
}

export function DelegarTarefaLoteDialog({ 
  open, 
  onOpenChange, 
  coordenacaoId,
  membros 
}: DelegarTarefaLoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: processos } = useQuery({
    queryKey: ["processos-coordenacao", coordenacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, polo_ativo, advogado_responsavel_id")
        .eq("coordenacao_id", coordenacaoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      responsavel_id: "",
      processos_ids: [],
      titulo: "",
      descricao: "",
      data_vencimento: format(new Date(), "yyyy-MM-dd"),
      prioridade: "media",
    },
  });

  const selectedProcessos = form.watch("processos_ids");

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      // Cria uma tarefa para cada processo selecionado
      const tasks = values.processos_ids.map(processo_id => ({
        processo_id,
        responsavel_id: values.responsavel_id,
        titulo: values.titulo,
        descricao: values.descricao || null,
        data_vencimento: values.data_vencimento,
        prioridade: values.prioridade,
        status: "pendente" as const,
      }));

      const { data: createdTasks, error } = await supabase
        .from("tarefas")
        .insert(tasks)
        .select("id, titulo, data_vencimento, prioridade, processo_id, responsavel_id");

      if (error) throw error;

      // Disparar notificação para cada tarefa criada (fire and forget)
      createdTasks?.forEach((tarefa) => {
        supabase.functions.invoke("notificar-tarefa-criada", {
          body: {
            tarefa_id: tarefa.id,
            titulo: tarefa.titulo,
            descricao: values.descricao,
            data_vencimento: tarefa.data_vencimento,
            prioridade: tarefa.prioridade,
            processo_id: tarefa.processo_id,
            responsavel_id: tarefa.responsavel_id,
          },
        }).catch((err) => console.log("Erro ao notificar tarefa (ignorado):", err));
      });

      toast({ 
        title: "Tarefas delegadas!", 
        description: `${values.processos_ids.length} tarefa(s) criada(s) com sucesso.`
      });
      
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      onOpenChange(false);
      form.reset();
      setSearchQuery("");
    } catch (error: any) {
      toast({
        title: "Erro ao delegar tarefas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const advogadosDisponiveis = membros
    .filter(m => m.usuario?.id)
    .map(m => ({ id: m.usuario!.id, nome: m.usuario!.nome }));

  const prioridadeLabels = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    urgente: "Urgente",
  };

  const filteredProcessos = processos?.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return p.numero.toLowerCase().includes(query) || 
           p.polo_ativo?.toLowerCase().includes(query);
  }) || [];

  const handleSelectAll = () => {
    const allIds = filteredProcessos.map(p => p.id);
    const currentSelected = form.getValues("processos_ids");
    const allSelected = allIds.every(id => currentSelected.includes(id));
    
    if (allSelected) {
      form.setValue("processos_ids", currentSelected.filter(id => !allIds.includes(id)));
    } else {
      const newSelection = [...new Set([...currentSelected, ...allIds])];
      form.setValue("processos_ids", newSelection);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Delegar Tarefa em Lote</DialogTitle>
          <DialogDescription>
            Selecione múltiplos processos para criar a mesma tarefa
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da Tarefa</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Elaborar petição inicial" {...field} />
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
                      placeholder="Detalhes adicionais sobre a tarefa..." 
                      className="resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_vencimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Vencimento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="processos_ids"
              render={() => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>
                      Processos ({selectedProcessos.length} selecionado{selectedProcessos.length !== 1 ? "s" : ""})
                    </FormLabel>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {filteredProcessos.every(p => selectedProcessos.includes(p.id)) 
                        ? "Desmarcar todos" 
                        : "Selecionar todos"}
                    </Button>
                  </div>
                  
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar processos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <ScrollArea className="h-48 rounded-md border p-3">
                    <div className="space-y-2">
                      {filteredProcessos.map((processo) => (
                        <FormField
                          key={processo.id}
                          control={form.control}
                          name="processos_ids"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(processo.id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, processo.id]);
                                    } else {
                                      field.onChange(current.filter(id => id !== processo.id));
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="flex-1 leading-none">
                                <span className="font-mono text-sm">{processo.numero}</span>
                                {processo.polo_ativo && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {processo.polo_ativo.slice(0, 50)}{processo.polo_ativo.length > 50 ? "..." : ""}
                                  </p>
                                )}
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                      {filteredProcessos.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum processo encontrado
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedProcessos.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedProcessos.slice(0, 5).map(id => {
                  const p = processos?.find(proc => proc.id === id);
                  return p ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {p.numero}
                    </Badge>
                  ) : null;
                })}
                {selectedProcessos.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedProcessos.length - 5} mais
                  </Badge>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || selectedProcessos.length === 0 || !advogadosDisponiveis.length}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delegar {selectedProcessos.length} Tarefa{selectedProcessos.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
