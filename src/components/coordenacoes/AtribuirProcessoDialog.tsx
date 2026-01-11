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
import { CheckSquare, Loader2, Scale, Search, Square, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SelecionarResponsaveisProcesso } from "@/components/processos/SelecionarResponsaveisProcesso";

const formSchema = z.object({
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
  administrativo: "Administrativo",
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
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [coordenacaoFilter, setCoordenacaoFilter] = useState<string>(coordenacaoId);
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all coordinations
  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-atribuir"],
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

  // Fetch all processes without responsible lawyer (optionally filtered by coordination)
  const { data: processosNaoAtribuidos } = useQuery({
    queryKey: ["processos-nao-atribuidos-all", coordenacaoFilter],
    queryFn: async () => {
      let query = supabase
        .from("processos")
        .select(`
          id, 
          numero, 
          assunto, 
          polo_ativo, 
          area, 
          advogado_responsavel_id, 
          cliente_id, 
          coordenacao_id,
          cliente:clientes(id, nome),
          coordenacao:coordenacoes(id, nome)
        `)
        .is("advogado_responsavel_id", null)
        .order("created_at", { ascending: false });

      if (coordenacaoFilter && coordenacaoFilter !== "all") {
        query = query.eq("coordenacao_id", coordenacaoFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const clientesUnicos = useMemo(() => {
    if (!processosNaoAtribuidos) return [];
    const map = new Map<string, string>();
    processosNaoAtribuidos.forEach((p) => {
      if (p.cliente?.id && p.cliente?.nome) {
        map.set(p.cliente.id, p.cliente.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [processosNaoAtribuidos]);

  const processosFiltrados = useMemo(() => {
    if (!processosNaoAtribuidos) return [];
    
    return processosNaoAtribuidos.filter((p) => {
      const matchesSearch = searchQuery === "" || 
        p.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.polo_ativo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.assunto?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesArea = areaFilter === "all" || p.area === areaFilter;
      const matchesCliente = clienteFilter === "all" || p.cliente_id === clienteFilter;
      
      return matchesSearch && matchesArea && matchesCliente;
    });
  }, [processosNaoAtribuidos, searchQuery, areaFilter, clienteFilter]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      processos: [],
    },
  });

  async function onSubmit(values: FormValues) {
    if (responsaveis.length === 0) {
      toast({
        title: "Selecione responsáveis",
        description: "Selecione pelo menos um advogado responsável.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // For each process, insert the responsible lawyers
      for (const processoId of values.processos) {
        // First, set the primary responsible in the legacy field (first one)
        await supabase
          .from("processos")
          .update({ advogado_responsavel_id: responsaveis[0].usuario_id })
          .eq("id", processoId);

        // Then, upsert into processos_responsaveis
        for (const resp of responsaveis) {
          await supabase
            .from("processos_responsaveis")
            .upsert({
              processo_id: processoId,
              usuario_id: resp.usuario_id,
              coordenacao_id: resp.coordenacao_id,
              papel: resp.papel || "responsavel",
            }, { onConflict: "processo_id,usuario_id" });
        }
      }

      toast({ 
        title: "Processos atribuídos!", 
        description: `${values.processos.length} processo(s) atribuído(s) a ${responsaveis.length} responsável(is).` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      queryClient.invalidateQueries({ queryKey: ["processos-nao-atribuidos-all"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      queryClient.invalidateQueries({ queryKey: ["processos-responsaveis"] });
      onOpenChange(false);
      form.reset();
      setResponsaveis([]);
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

  const handleSelectAll = () => {
    const allIds = processosFiltrados.map((p) => p.id);
    const currentSelected = form.getValues("processos");
    const allSelected = allIds.every((id) => currentSelected.includes(id));

    if (allSelected) {
      form.setValue("processos", currentSelected.filter((id) => !allIds.includes(id)));
    } else {
      const newSelection = [...new Set([...currentSelected, ...allIds])];
      form.setValue("processos", newSelection);
    }
  };

  const allFilteredSelected =
    processosFiltrados.length > 0 &&
    processosFiltrados.every((p) => form.watch("processos").includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Atribuir Processos</DialogTitle>
          <DialogDescription>
            Selecione os responsáveis e os processos que deseja atribuir
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Responsáveis
              </FormLabel>
              <SelecionarResponsaveisProcesso
                value={responsaveis}
                onChange={setResponsaveis}
                coordenacaoIdPadrao={coordenacaoId}
              />
            </div>

            <FormField
              control={form.control}
              name="processos"
              render={() => (
                <FormItem className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between">
                    <FormLabel>Processos sem Responsável ({processosFiltrados?.length || 0})</FormLabel>
                    {processosFiltrados.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        className="h-7 text-xs"
                      >
                        {allFilteredSelected ? (
                          <>
                            <Square className="w-3.5 h-3.5 mr-1" />
                            Desmarcar todos
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 mr-1" />
                            Selecionar todos
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por número..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Coordenação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas Coordenações</SelectItem>
                          {coordenacoes?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={areaFilter} onValueChange={setAreaFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Área" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as áreas</SelectItem>
                          <SelectItem value="civil">Civil</SelectItem>
                          <SelectItem value="trabalhista">Trabalhista</SelectItem>
                          <SelectItem value="empresarial">Empresarial</SelectItem>
                          <SelectItem value="administrativo">Administrativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={clienteFilter} onValueChange={setClienteFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os clientes</SelectItem>
                          {clientesUnicos.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {processosFiltrados.length > 0 ? (
                    <ScrollArea className="h-[250px] border rounded-md p-3">
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
                                <div className="space-y-1 leading-none flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-mono">{processo.numero}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {areaLabels[processo.area] || processo.area}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {processo.cliente?.nome || processo.polo_ativo || processo.assunto || "Sem descrição"}
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
                        Todos os processos já foram atribuídos
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
                disabled={loading || !form.watch("processos").length || responsaveis.length === 0}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Atribuir {responsaveis.length > 0 && `a ${responsaveis.length} responsável(is)`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
