import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Scale, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  advogado_id: z.string().min(1, "Selecione um advogado"),
  processos: z.array(z.string()).min(1, "Selecione pelo menos um processo"),
});

type FormValues = z.infer<typeof formSchema>;

interface AtribuirProcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  membros: Array<{ id: string; usuario?: { id: string; nome: string } | null }>;
}

const areaLabels: Record<string, string> = {
  civil: "Civil",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

export function AtribuirProcessoDialog({ 
  open, 
  onOpenChange, 
  coordenacaoId,
  membros 
}: AtribuirProcessoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: processosNaoAtribuidos } = useQuery({
    queryKey: ["processos-nao-atribuidos", coordenacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, assunto, polo_ativo, area, advogado_responsavel_id")
        .eq("coordenacao_id", coordenacaoId)
        .is("advogado_responsavel_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const processosFiltrados = useMemo(() => {
    if (!processosNaoAtribuidos) return [];
    
    return processosNaoAtribuidos.filter((p) => {
      const matchesSearch = searchQuery === "" || 
        p.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.polo_ativo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.assunto?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesArea = areaFilter === "all" || p.area === areaFilter;
      
      return matchesSearch && matchesArea;
    });
  }, [processosNaoAtribuidos, searchQuery, areaFilter]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      advogado_id: "",
      processos: [],
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({ advogado_responsavel_id: values.advogado_id })
        .in("id", values.processos);

      if (error) throw error;

      toast({ 
        title: "Processos atribuídos!", 
        description: `${values.processos.length} processo(s) atribuído(s) com sucesso.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      queryClient.invalidateQueries({ queryKey: ["processos-nao-atribuidos"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir processos",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atribuir Processos</DialogTitle>
          <DialogDescription>
            Selecione um advogado e os processos que deseja atribuir
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="advogado_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Advogado Responsável</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o advogado" />
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
              name="processos"
              render={() => (
                <FormItem>
                  <FormLabel>Processos sem Responsável ({processosNaoAtribuidos?.length || 0})</FormLabel>
                  
                  {/* Filters */}
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por número..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="civil">Civil</SelectItem>
                        <SelectItem value="trabalhista">Trabalhista</SelectItem>
                        <SelectItem value="empresarial">Empresarial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {processosFiltrados.length > 0 ? (
                    <ScrollArea className="h-[200px] border rounded-md p-3">
                      <div className="space-y-3">
                        {processosFiltrados.map((processo) => (
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
                                      {areaLabels[processo.area] || processo.area}
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
                  ) : processosNaoAtribuidos && processosNaoAtribuidos.length > 0 ? (
                    <div className="text-center py-6 border rounded-md">
                      <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum processo encontrado com os filtros aplicados
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 border rounded-md">
                      <Scale className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Todos os processos desta coordenação já foram atribuídos
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
                disabled={loading || !processosNaoAtribuidos?.length}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Atribuir
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
