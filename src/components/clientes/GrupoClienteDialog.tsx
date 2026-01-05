import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
  cor: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface GrupoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grupo?: {
    id: string;
    nome: string;
    descricao: string | null;
    cor: string | null;
  } | null;
}

const CORES = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#f97316", // orange
  "#ec4899", // pink
  "#06b6d4", // cyan
];

export function GrupoClienteDialog({ open, onOpenChange, grupo }: GrupoClienteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      cor: "#3b82f6",
    },
  });

  useEffect(() => {
    if (open) {
      if (grupo) {
        form.reset({
          nome: grupo.nome,
          descricao: grupo.descricao || "",
          cor: grupo.cor || "#3b82f6",
        });
      } else {
        form.reset({
          nome: "",
          descricao: "",
          cor: "#3b82f6",
        });
      }
    }
  }, [open, grupo, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (grupo) {
        const { error } = await supabase
          .from("grupos_clientes")
          .update({
            nome: values.nome,
            descricao: values.descricao || null,
            cor: values.cor || "#3b82f6",
          })
          .eq("id", grupo.id);

        if (error) throw error;

        toast({
          title: "Grupo atualizado",
          description: "O grupo foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase.from("grupos_clientes").insert({
          nome: values.nome,
          descricao: values.descricao || null,
          cor: values.cor || "#3b82f6",
        });

        if (error) throw error;

        toast({
          title: "Grupo criado",
          description: "O grupo foi criado com sucesso.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["grupos_clientes"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving grupo:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o grupo.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{grupo ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Grupo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Clientes VIP" {...field} />
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
                      placeholder="Descrição opcional do grupo..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <div className="flex gap-2 flex-wrap">
                      {CORES.map((cor) => (
                        <button
                          key={cor}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            field.value === cor
                              ? "border-foreground scale-110"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: cor }}
                          onClick={() => field.onChange(cor)}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {grupo ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
