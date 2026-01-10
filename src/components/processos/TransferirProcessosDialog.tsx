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
  coordenacao_destino_id: z.string().min(1, "Selecione a coordenação de destino"),
  novo_advogado_id: z.string().optional(),
  processos: z.array(z.string()).min(1, "Selecione pelo menos um processo"),
});

type FormValues = z.infer<typeof formSchema>;

interface TransferirProcessosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const areaLabels: Record<string, string> = {
  civil: "Civil",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
  administrativo: "Administrativo",
};

export function TransferirProcessosDialog({
  open,
  onOpenChange,
}: TransferirProcessosDialogProps) {
  const [loading, setLoading] = useState(false);
  const [coordenacaoOrigemFilter, setCoordenacaoOrigemFilter] = useState<string>("all");
  const [advogadoOrigemFilter, setAdvogadoOrigemFilter] = useState<string>("all");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all coordinations
  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-transferencia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area, coordenador:profiles!coordenacoes_coordenador_id_fkey(id, nome)")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch all processes with coordination
  const { data: processos } = useQuery({
    queryKey: ["processos-para-transferencia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          id, 
          numero, 
          polo_ativo,
          area,
          advogado_responsavel_id,
          coordenacao_id,
          cliente_id,
          advogado:profiles!processos_advogado_responsavel_id_fkey(id, nome),
          cliente:clientes(id, nome),
          coordenacao:coordenacoes(id, nome)
        `)
        .not("coordenacao_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch members of destination coordination
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      coordenacao_destino_id: "",
      novo_advogado_id: "",
      processos: [],
    },
  });

  const coordenacaoDestinoId = form.watch("coordenacao_destino_id");

  const { data: membrosDestino } = useQuery({
    queryKey: ["membros-coordenacao-destino", coordenacaoDestinoId],
    queryFn: async () => {
      if (!coordenacaoDestinoId) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("id, usuario_id, usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)")
        .eq("coordenacao_id", coordenacaoDestinoId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!coordenacaoDestinoId,
  });

  // Unique clients from processes
  const clientesUnicos = useMemo(() => {
    if (!processos) return [];
    const map = new Map<string, string>();
    processos.forEach((p) => {
      if (p.cliente?.id && p.cliente?.nome) {
        map.set(p.cliente.id, p.cliente.nome);
      }
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [processos]);

  // Unique lawyers from filtered processes
  const advogadosUnicos = useMemo(() => {
    if (!processos) return [];
    let filtered = processos;
    if (coordenacaoOrigemFilter && coordenacaoOrigemFilter !== "all") {
      filtered = filtered.filter((p) => p.coordenacao_id === coordenacaoOrigemFilter);
    }
    const map = new Map<string, string>();
    filtered.forEach((p) => {
      if (p.advogado?.id && p.advogado?.nome) {
        map.set(p.advogado.id, p.advogado.nome);
      }
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [processos, coordenacaoOrigemFilter]);

  // Filter processes
  const processosFiltrados = useMemo(() => {
    let filtered = processos || [];

    if (coordenacaoOrigemFilter && coordenacaoOrigemFilter !== "all") {
      filtered = filtered.filter((p) => p.coordenacao_id === coordenacaoOrigemFilter);
    }

    if (advogadoOrigemFilter && advogadoOrigemFilter !== "all") {
      filtered = filtered.filter((p) => p.advogado_responsavel_id === advogadoOrigemFilter);
    }

    if (clienteFilter && clienteFilter !== "all") {
      filtered = filtered.filter((p) => p.cliente_id === clienteFilter);
    }

    if (areaFilter && areaFilter !== "all") {
      filtered = filtered.filter((p) => p.area === areaFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.numero.toLowerCase().includes(query) ||
          p.polo_ativo?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [processos, coordenacaoOrigemFilter, advogadoOrigemFilter, clienteFilter, areaFilter, searchQuery]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const updateData: { coordenacao_id: string; advogado_responsavel_id?: string | null } = {
        coordenacao_id: values.coordenacao_destino_id,
      };

      // If a new lawyer is selected, update it; otherwise set to null
      if (values.novo_advogado_id && values.novo_advogado_id !== "__keep__") {
        updateData.advogado_responsavel_id = values.novo_advogado_id;
      } else if (values.novo_advogado_id !== "__keep__") {
        updateData.advogado_responsavel_id = null;
      }

      const { error } = await supabase
        .from("processos")
        .update(updateData)
        .in("id", values.processos);

      if (error) throw error;

      const destino = coordenacoes?.find((c) => c.id === values.coordenacao_destino_id);
      toast({
        title: "Processos transferidos!",
        description: `${values.processos.length} processo(s) transferido(s) para ${destino?.nome || "a coordenação selecionada"}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      queryClient.invalidateQueries({ queryKey: ["processos-para-transferencia"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-dashboard"] });
      onOpenChange(false);
      form.reset();
      setCoordenacaoOrigemFilter("all");
      setAdvogadoOrigemFilter("all");
      setClienteFilter("all");
      setAreaFilter("all");
      setSearchQuery("");
    } catch (error: any) {
      toast({
        title: "Erro ao transferir processos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const getInitials = (name: string) => {
    return name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "ND";
  };

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

  const advogadosDestino = membrosDestino
    ?.filter((m) => m.usuario?.id)
    .map((m) => ({ id: m.usuario!.id, nome: m.usuario!.nome })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transferir Processos entre Coordenações</DialogTitle>
          <DialogDescription>
            Transfira processos de uma coordenação para outra, opcionalmente definindo um novo responsável.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Source filters */}
            <div className="space-y-3 border-b pb-4">
              <p className="text-sm font-medium text-muted-foreground">Filtros de Origem</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select value={coordenacaoOrigemFilter} onValueChange={(v) => {
                  setCoordenacaoOrigemFilter(v);
                  setAdvogadoOrigemFilter("all");
                }}>
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

                <Select value={advogadoOrigemFilter} onValueChange={setAdvogadoOrigemFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Advogado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Advogados</SelectItem>
                    {advogadosUnicos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={clienteFilter} onValueChange={setClienteFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Clientes</SelectItem>
                    {clientesUnicos.map((c) => (
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
                    <SelectItem value="all">Todas Áreas</SelectItem>
                    <SelectItem value="civil">Civil</SelectItem>
                    <SelectItem value="trabalhista">Trabalhista</SelectItem>
                    <SelectItem value="empresarial">Empresarial</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número ou parte..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Destination selection */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Coord. Origem (filtro)</label>
                <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 text-sm">
                  {coordenacaoOrigemFilter === "all"
                    ? "Todas"
                    : coordenacoes?.find((c) => c.id === coordenacaoOrigemFilter)?.nome || "-"}
                </div>
              </div>

              <ArrowRight className="hidden sm:block w-5 h-5 text-muted-foreground mb-2" />

              <FormField
                control={form.control}
                name="coordenacao_destino_id"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel>Coordenação Destino *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a coordenação" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {coordenacoes
                          ?.filter((c) => c.id !== coordenacaoOrigemFilter || coordenacaoOrigemFilter === "all")
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome} ({areaLabels[c.area] || c.area})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* New responsible lawyer (optional) */}
            {coordenacaoDestinoId && (
              <FormField
                control={form.control}
                name="novo_advogado_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo Advogado Responsável (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Manter sem atribuição ou selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__clear__">Sem advogado responsável</SelectItem>
                        {advogadosDestino.map((a) => (
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
            )}

            {/* Process list */}
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
                    <ScrollArea className="h-[200px] border rounded-md">
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
                                        : field.onChange(field.value?.filter((v) => v !== processo.id));
                                    }}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-mono">{processo.numero}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {areaLabels[processo.area] || processo.area}
                                    </Badge>
                                    {processo.coordenacao && (
                                      <Badge variant="secondary" className="text-xs">
                                        {processo.coordenacao.nome}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {processo.advogado && (
                                      <div className="flex items-center gap-1">
                                        <Avatar className="w-4 h-4">
                                          <AvatarFallback className="text-[8px] bg-secondary">
                                            {getInitials(processo.advogado.nome)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-muted-foreground">
                                          {processo.advogado.nome}
                                        </span>
                                      </div>
                                    )}
                                    {processo.cliente && (
                                      <span className="text-xs text-muted-foreground">
                                        • {processo.cliente.nome}
                                      </span>
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
                        {searchQuery || areaFilter !== "all" || clienteFilter !== "all" || advogadoOrigemFilter !== "all"
                          ? "Nenhum processo encontrado com os filtros aplicados"
                          : coordenacaoOrigemFilter !== "all"
                          ? "Nenhum processo encontrado nesta coordenação"
                          : "Nenhum processo com coordenação atribuída"}
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("processos").length > 0 && (
              <Badge variant="secondary">{form.watch("processos").length} processo(s) selecionado(s)</Badge>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !form.watch("processos").length}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Transferir
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
