import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MultiUserSelect } from "@/components/shared/MultiUserSelect";

const formSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().optional(),
  data_vencimento: z.string().min(1, "Data prevista é obrigatória"),
  data_fatal: z.string().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
});

type FormValues = z.infer<typeof formSchema>;

interface CriarTarefaProcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  processoNumero?: string;
}

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export function CriarTarefaProcessoDialog({
  open,
  onOpenChange,
  processoId,
  processoNumero,
}: CriarTarefaProcessoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const openedAtRef = useRef<number>(0);

  const hoje = format(new Date(), "yyyy-MM-dd");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      data_vencimento: hoje,
      data_fatal: "",
      prioridade: "media",
    },
  });

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      form.reset({
        titulo: "",
        descricao: "",
        data_vencimento: format(new Date(), "yyyy-MM-dd"),
        data_fatal: "",
        prioridade: "media",
      });
      setResponsaveisIds([]);
      setEnvolvidosIds([]);
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    if (!user) return;
    const responsavelPrincipal = responsaveisIds[0] || null;
    setLoading(true);
    try {
      const { data: tarefa, error } = await supabase
        .from("tarefas")
        .insert({
          processo_id: processoId,
          responsavel_id: responsavelPrincipal,
          titulo: values.titulo,
          descricao: values.descricao || null,
          tipo_tarefa: "TAREFA EQUIPE",
          data_vencimento: values.data_vencimento,
          data_fatal: values.data_fatal || null,
          prioridade: values.prioridade,
          status: "pendente",
          criado_por: user.id,
          origem: "processo_detalhe",
        })
        .select()
        .single();

      if (error) throw error;

      if (tarefa?.id) {
        if (responsaveisIds.length > 0) {
          await supabase.from("tarefa_responsaveis").insert(
            responsaveisIds.map((uid) => ({ tarefa_id: tarefa.id, usuario_id: uid }))
          );
        }
        if (envolvidosIds.length > 0) {
          await supabase.from("tarefa_envolvidos").insert(
            envolvidosIds.map((uid) => ({ tarefa_id: tarefa.id, usuario_id: uid }))
          );
        }

        for (const uid of responsaveisIds) {
          supabase.functions.invoke("notificar-tarefa-criada", {
            body: {
              tarefa_id: tarefa.id,
              titulo: values.titulo,
              descricao: values.descricao,
              data_vencimento: values.data_vencimento,
              prioridade: values.prioridade,
              processo_id: processoId,
              responsavel_id: uid,
            },
          }).catch((err) => console.log("Erro ao notificar tarefa (ignorado):", err));
        }
      }

      toast.success("Tarefa criada com sucesso!");
      await queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      await queryClient.invalidateQueries({ queryKey: ["tarefas-processo", processoId] });
      await queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
      await queryClient.invalidateQueries({ queryKey: ["notificacoes-counts"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[640px] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
        onPointerDownOutside={(e) => {
          if (Date.now() - openedAtRef.current < 500) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (Date.now() - openedAtRef.current < 500) e.preventDefault();
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" />
            Nova Tarefa
          </DialogTitle>
          {processoNumero && (
            <p className="text-xs text-muted-foreground">Processo: {processoNumero}</p>
          )}
        </DialogHeader>
        <div className="overflow-y-auto px-6 pb-6 flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <MultiUserSelect
                label="Responsáveis"
                helperText="Quem irá executar a tarefa"
                selectedIds={responsaveisIds}
                onChange={setResponsaveisIds}
                height={160}
              />

              <MultiUserSelect
                label="Envolvidos (acompanham)"
                helperText="Recebem a tarefa apenas para acompanhamento"
                selectedIds={envolvidosIds}
                onChange={setEnvolvidosIds}
                height={160}
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
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
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
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar Tarefa
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}