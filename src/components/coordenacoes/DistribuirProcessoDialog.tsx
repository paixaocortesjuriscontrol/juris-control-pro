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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  coordenacao_id: z.string().min(1, "Selecione uma coordenação"),
  processos: z.array(z.string()).min(1, "Selecione pelo menos um processo"),
});

type FormValues = z.infer<typeof formSchema>;

interface DistribuirProcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DistribuirProcessoDialog({ open, onOpenChange }: DistribuirProcessoDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-simples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: processosSemCoordenacao } = useQuery({
    queryKey: ["processos-sem-coordenacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, assunto, polo_ativo, area")
        .is("coordenacao_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      coordenacao_id: "",
      processos: [],
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({ coordenacao_id: values.coordenacao_id })
        .in("id", values.processos);

      if (error) throw error;

      toast({ 
        title: "Processos distribuídos!", 
        description: `${values.processos.length} processo(s) distribuído(s) para a coordenação.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      queryClient.invalidateQueries({ queryKey: ["processos-sem-coordenacao"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Erro ao distribuir processos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const areaLabels: Record<string, string> = {
    civil: "Cível",
    trabalhista: "Trabalhista",
    empresarial: "Empresarial",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Distribuir Processos</DialogTitle>
          <DialogDescription>
            Atribua processos sem coordenação para uma equipe
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="coordenacao_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coordenação</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a coordenação" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {coordenacoes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({areaLabels[c.area]})
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
              name="processos"
              render={() => (
                <FormItem>
                  <FormLabel>Processos sem Coordenação ({processosSemCoordenacao?.length || 0})</FormLabel>
                  {processosSemCoordenacao && processosSemCoordenacao.length > 0 ? (
                    <ScrollArea className="h-[200px] border rounded-md p-3">
                      <div className="space-y-3">
                        {processosSemCoordenacao.map((processo) => (
                          <FormField
                            key={processo.id}
                            control={form.control}
                            name="processos"
                            render={({ field }) => (
                              <FormItem className="flex items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(processo.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, processo.id])
                                        : field.onChange(
                                            field.value?.filter((v) => v !== processo.id)
                                          );
                                    }}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-mono">{processo.numero}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {areaLabels[processo.area]}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {processo.polo_ativo || processo.assunto || "Sem descrição"}
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-6 border rounded-md">
                      <Scale className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Todos os processos já estão distribuídos para coordenações
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("processos").length > 0 && (
              <Badge variant="secondary">
                {form.watch("processos").length} processo(s) selecionado(s)
              </Badge>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !processosSemCoordenacao?.length}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Distribuir
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
