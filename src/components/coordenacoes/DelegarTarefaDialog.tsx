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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { registrarAuditoriaTarefa } from "@/hooks/useAuditoriaTarefas";

const formSchema = z.object({
  responsavel_id: z.string().min(1, "Selecione um responsável"),
  processo_id: z.string().min(1, "Selecione um processo"),
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().optional(),
  data_vencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
});

type FormValues = z.infer<typeof formSchema>;

interface DelegarTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  membros: Array<{ id: string; usuario?: { id: string; nome: string } | null }>;
}

export function DelegarTarefaDialog({ 
  open, 
  onOpenChange, 
  coordenacaoId,
  membros 
}: DelegarTarefaDialogProps) {
  const [loading, setLoading] = useState(false);
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
      processo_id: "",
      titulo: "",
      descricao: "",
      data_vencimento: format(new Date(), "yyyy-MM-dd"),
      prioridade: "media",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const dadosEntrada = { ...values, coordenacaoId };
    
    try {
      const { data: novaTarefa, error } = await supabase
        .from("tarefas")
        .insert({
          processo_id: values.processo_id,
          responsavel_id: values.responsavel_id,
          titulo: values.titulo,
          descricao: values.descricao || null,
          data_vencimento: values.data_vencimento,
          prioridade: values.prioridade,
          status: "pendente",
        })
        .select("id")
        .single();

      if (error) throw error;

      // Registrar auditoria de sucesso
      await registrarAuditoriaTarefa({
        acao: 'criar',
        sucesso: true,
        dadosEntrada,
        dadosSaida: { tarefaId: novaTarefa.id },
        origem: 'delegar_tarefa_dialog',
        processoId: values.processo_id,
        tarefaId: novaTarefa.id,
      });

      toast({ 
        title: "Tarefa delegada!", 
        description: "A tarefa foi atribuída ao membro da equipe." 
      });
      
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      // Registrar auditoria de falha
      await registrarAuditoriaTarefa({
        acao: 'erro_criar',
        sucesso: false,
        dadosEntrada,
        erroMensagem: error.message,
        erroDetalhes: { code: error.code, hint: error.hint, details: error.details },
        origem: 'delegar_tarefa_dialog',
        processoId: values.processo_id,
      });

      toast({
        title: "Erro ao delegar tarefa",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delegar Tarefa</DialogTitle>
          <DialogDescription>
            Crie uma tarefa e atribua a um membro da equipe
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="processo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Processo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o processo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {processos?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-sm">{p.numero}</span>
                          {p.polo_ativo && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              - {p.polo_ativo.slice(0, 30)}...
                            </span>
                          )}
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
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
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

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !processos?.length || !advogadosDisponiveis.length}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delegar Tarefa
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
