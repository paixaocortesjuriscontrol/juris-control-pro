import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

const formSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  area: z.enum(["civil", "trabalhista", "empresarial"]),
  descricao: z.string().optional(),
  coordenador_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CoordenacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacao?: {
    id: string;
    nome: string;
    area: string;
    descricao: string | null;
    coordenador?: { id: string } | null;
  } | null;
}

export function CoordenacaoDialog({ open, onOpenChange, coordenacao }: CoordenacaoDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: coordenadores } = useQuery({
    queryKey: ["todos-usuarios-escritorio"],
    queryFn: async () => {
      // Buscar todos os usuários do escritório para poderem ser coordenadores
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");

      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      area: "civil",
      descricao: "",
      coordenador_id: "",
    },
  });

  // Reset form when coordenacao changes (for edit mode)
  useEffect(() => {
    if (open) {
      form.reset({
        nome: coordenacao?.nome || "",
        area: (coordenacao?.area as "civil" | "trabalhista" | "empresarial") || "civil",
        descricao: coordenacao?.descricao || "",
        coordenador_id: coordenacao?.coordenador?.id || "",
      });
    }
  }, [open, coordenacao, form]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const payload = {
        nome: values.nome,
        area: values.area,
        descricao: values.descricao || null,
        coordenador_id: values.coordenador_id || null,
      };

      if (coordenacao) {
        const { error } = await supabase
          .from("coordenacoes")
          .update(payload)
          .eq("id", coordenacao.id);

        if (error) throw error;
        toast({ title: "Coordenação atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("coordenacoes")
          .insert(payload);

        if (error) throw error;
        toast({ title: "Coordenação criada com sucesso!" });
      }

      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {coordenacao ? "Editar Coordenação" : "Nova Coordenação"}
          </DialogTitle>
          <DialogDescription>
            {coordenacao ? "Atualize os dados da coordenação" : "Crie uma nova coordenação para organizar a equipe"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Coordenação</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Coordenação Trabalhista" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Área de Atuação</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a área" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="civil">Cível</SelectItem>
                      <SelectItem value="trabalhista">Trabalhista</SelectItem>
                      <SelectItem value="empresarial">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coordenador_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coordenador</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o coordenador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {coordenadores?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
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
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição da coordenação..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {coordenacao ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
