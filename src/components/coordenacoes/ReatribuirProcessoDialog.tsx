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
import { ArrowRight, CheckSquare, Loader2, Search, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const formSchema = z.object({
  novo_advogado_id: z.string().min(1, "Selecione o novo responsável"),
  processos: z.array(z.string()).min(1, "Selecione pelo menos um processo"),
});

type FormValues = z.infer<typeof formSchema>;

interface ReatribuirProcessoDialogProps {
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

export function ReatribuirProcessoDialog({
  open, 
  onOpenChange, 
  coordenacaoId,
  membros 
}: ReatribuirProcessoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedAdvogado, setSelectedAdvogado] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: processosAtribuidos } = useQuery({
    queryKey: ["processos-atribuidos", coordenacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          id, 
          numero, 
          polo_ativo,
          area,
          advogado_responsavel_id,
          cliente_id,
          advogado:profiles!processos_advogado_responsavel_id_fkey(id, nome),
          cliente:clientes(id, nome)
        `)
        .eq("coordenacao_id", coordenacaoId)
        .not("advogado_responsavel_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const clientesUnicos = useMemo(() => {
    if (!processosAtribuidos) return [];
    const map = new Map<string, string>();
    processosAtribuidos.forEach((p) => {
      if (p.cliente?.id && p.cliente?.nome) {
        map.set(p.cliente.id, p.cliente.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [processosAtribuidos]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      novo_advogado_id: "",
      processos: [],
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({ advogado_responsavel_id: values.novo_advogado_id })
        .in("id", values.processos);

      if (error) throw error;

      toast({ 
        title: "Processos reatribuídos!", 
        description: `${values.processos.length} processo(s) transferido(s) com sucesso.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      queryClient.invalidateQueries({ queryKey: ["processos-atribuidos"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      onOpenChange(false);
      form.reset();
      setSelectedAdvogado("");
    } catch (error: any) {
      toast({
        title: "Erro ao reatribuir processos",
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

  // Filter processes by selected source lawyer, area, client, and search query
  const processosFiltrados = useMemo(() => {
    let filtered = processosAtribuidos || [];
    
    if (selectedAdvogado && selectedAdvogado !== "all") {
      filtered = filtered.filter(p => p.advogado_responsavel_id === selectedAdvogado);
    }
    
    if (areaFilter && areaFilter !== "all") {
      filtered = filtered.filter(p => p.area === areaFilter);
    }

    if (clienteFilter && clienteFilter !== "all") {
      filtered = filtered.filter(p => p.cliente_id === clienteFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.numero.toLowerCase().includes(query) ||
        p.polo_ativo?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [processosAtribuidos, selectedAdvogado, areaFilter, clienteFilter, searchQuery]);

  const getInitials = (name: string) => {
    return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "ND";
  };

  const handleSelectAll = () => {
    const allIds = processosFiltrados.map(p => p.id);
    const currentSelected = form.getValues("processos");
    const allSelected = allIds.every(id => currentSelected.includes(id));
    
    if (allSelected) {
      form.setValue("processos", currentSelected.filter(id => !allIds.includes(id)));
    } else {
      const newSelection = [...new Set([...currentSelected, ...allIds])];
      form.setValue("processos", newSelection);
    }
  };

  const allFilteredSelected = processosFiltrados.length > 0 && 
    processosFiltrados.every(p => form.watch("processos").includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Reatribuir Processos</DialogTitle>
          <DialogDescription>
            Transfira processos de um advogado para outro
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Advogado selection row */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Filtrar por Advogado</label>
                <Select value={selectedAdvogado} onValueChange={setSelectedAdvogado}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os advogados</SelectItem>
                    {advogadosDisponiveis.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ArrowRight className="hidden sm:block w-5 h-5 text-muted-foreground mb-2" />

              <FormField
                control={form.control}
                name="novo_advogado_id"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Novo Responsável</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {advogadosDisponiveis
                          .filter(a => a.id !== selectedAdvogado || selectedAdvogado === "all")
                          .map((a) => (
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
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número ou parte..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={areaFilter || "all"} onValueChange={setAreaFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas áreas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas áreas</SelectItem>
                    <SelectItem value="civil">Civil</SelectItem>
                    <SelectItem value="trabalhista">Trabalhista</SelectItem>
                    <SelectItem value="empresarial">Empresarial</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={clienteFilter} onValueChange={setClienteFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos clientes" />
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

            <FormField
              control={form.control}
              name="processos"
              render={() => (
                <FormItem className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between">
                    <FormLabel>Processos ({processosFiltrados?.length || 0})</FormLabel>
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
                  {processosFiltrados && processosFiltrados.length > 0 ? (
                    <ScrollArea className="h-[250px] border rounded-md">
                      <div className="space-y-3 p-3">
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
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-mono">{processo.numero}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {areaLabels[processo.area] || processo.area}
                                    </Badge>
                                    {processo.advogado && (
                                      <div className="flex items-center gap-1.5">
                                        <Avatar className="w-5 h-5">
                                          <AvatarFallback className="text-[10px] bg-secondary">
                                            {getInitials(processo.advogado.nome)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-muted-foreground">
                                          {processo.advogado.nome}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {processo.polo_ativo || "Sem descrição"}
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
                      <p className="text-sm text-muted-foreground">
                        {searchQuery || areaFilter
                          ? "Nenhum processo encontrado com os filtros aplicados"
                          : selectedAdvogado && selectedAdvogado !== "all"
                            ? "Este advogado não possui processos atribuídos"
                            : "Nenhum processo atribuído nesta coordenação"
                        }
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
                disabled={loading || !processosFiltrados?.length}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reatribuir
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
