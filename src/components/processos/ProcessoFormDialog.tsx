import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const formSchema = z.object({
  numero: z.string().min(5, "Número do processo deve ter no mínimo 5 caracteres"),
  assunto: z.string().optional(),
  area: z.enum(["civil", "trabalhista", "empresarial"]),
  status: z.enum(["ativo", "pendente", "urgente", "encerrado", "arquivado"]),
  descricao: z.string().optional(),
  tribunal: z.string().optional(),
  vara: z.string().optional(),
  comarca: z.string().optional(),
  classe: z.string().optional(),
  data_distribuicao: z.string().optional(),
  valor_causa: z.string().optional(),
  polo_ativo: z.string().optional(),
  polo_passivo: z.string().optional(),
  coordenacao_id: z.string().optional(),
  advogado_responsavel_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProcessoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo?: any;
}

// Format CNJ mask: NNNNNNN-DD.AAAA.J.TR.OOOO
const formatCNJ = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  
  if (numbers.length <= 7) {
    return numbers;
  } else if (numbers.length <= 9) {
    return `${numbers.slice(0, 7)}-${numbers.slice(7)}`;
  } else if (numbers.length <= 13) {
    return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9)}`;
  } else if (numbers.length <= 14) {
    return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13)}`;
  } else if (numbers.length <= 16) {
    return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14)}`;
  } else {
    return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14, 16)}.${numbers.slice(16, 20)}`;
  }
};

export function ProcessoFormDialog({ open, onOpenChange, processo }: ProcessoFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingFromApi, setFetchingFromApi] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!processo;

  const { data: coordenacoes = [] } = useCoordenacoesFull();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numero: "",
      assunto: "",
      area: "civil",
      status: "ativo",
      descricao: "",
      tribunal: "",
      vara: "",
      comarca: "",
      classe: "",
      data_distribuicao: "",
      valor_causa: "",
      polo_ativo: "",
      polo_passivo: "",
      coordenacao_id: "",
      advogado_responsavel_id: "",
    },
  });

  // Reset form when dialog opens or processo changes
  useEffect(() => {
    if (open) {
      if (processo) {
        form.reset({
          numero: processo.numero || "",
          assunto: processo.assunto || "",
          area: processo.area,
          status: processo.status,
          descricao: processo.descricao || "",
          tribunal: processo.tribunal || "",
          vara: processo.vara || "",
          comarca: processo.comarca || "",
          classe: processo.classe || "",
          data_distribuicao: processo.data_distribuicao || "",
          valor_causa: processo.valor_causa?.toString() || "",
          polo_ativo: processo.polo_ativo || "",
          polo_passivo: processo.polo_passivo || "",
          coordenacao_id: processo.coordenacao_id || "",
          advogado_responsavel_id: processo.advogado_responsavel_id || "",
        });
      } else {
        form.reset({
          numero: "",
          assunto: "",
          area: "civil",
          status: "ativo",
          descricao: "",
          tribunal: "",
          vara: "",
          comarca: "",
          classe: "",
          data_distribuicao: "",
          valor_causa: "",
          polo_ativo: "",
          polo_passivo: "",
          coordenacao_id: "",
          advogado_responsavel_id: "",
        });
      }
    }
  }, [open, processo, form]);

  const selectedCoordenacao = form.watch("coordenacao_id");
  const membros = coordenacoes.find((c) => c.id === selectedCoordenacao)?.membros || [];

  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const formatted = formatCNJ(e.target.value);
    onChange(formatted);
  };

  const handleFetchFromApi = async () => {
    const numero = form.getValues("numero");
    if (!numero || numero.length < 5) {
      toast({
        title: "Número inválido",
        description: "Digite um número de processo válido para buscar.",
        variant: "destructive",
      });
      return;
    }

    setFetchingFromApi(true);
    try {
      const { data: apiData, error } = await supabase.functions.invoke("consultar-processo", {
        body: { numeroProcesso: numero.trim() },
      });

      if (error) throw error;

      if (apiData?.found && apiData?.processo) {
        const processoApi = apiData.processo;

        // Extract parties
        let poloAtivo = "";
        let poloPassivo = "";
        
        if (processoApi.partes && processoApi.partes.length > 0) {
          const partesAtivas = processoApi.partes
            .filter((p: any) => p.tipo === "POLO_ATIVO" || p.tipoParte === "AUTOR" || p.tipoParte === "REQUERENTE" || p.tipoParte === "RECLAMANTE")
            .map((p: any) => p.nome)
            .filter(Boolean);
            
          const partesPassivas = processoApi.partes
            .filter((p: any) => p.tipo === "POLO_PASSIVO" || p.tipoParte === "REU" || p.tipoParte === "REQUERIDO" || p.tipoParte === "RECLAMADO")
            .map((p: any) => p.nome)
            .filter(Boolean);
            
          poloAtivo = partesAtivas.join(", ");
          poloPassivo = partesPassivas.join(", ");
        }

        // Determine area based on tribunal
        let area: "civil" | "trabalhista" | "empresarial" = "civil";
        const tribunalLower = (processoApi.tribunal || apiData.tribunal || "").toLowerCase();
        if (tribunalLower.includes("trt") || tribunalLower.includes("tst") || tribunalLower.includes("trabalho")) {
          area = "trabalhista";
        }

        // Update form values
        form.setValue("tribunal", processoApi.tribunal || apiData.tribunal || "");
        form.setValue("vara", processoApi.orgaoJulgador || "");
        form.setValue("classe", processoApi.classe || "");
        form.setValue("assunto", processoApi.assunto || "");
        form.setValue("polo_ativo", poloAtivo);
        form.setValue("polo_passivo", poloPassivo);
        form.setValue("area", area);
        
        if (processoApi.dataAjuizamento) {
          const dateStr = processoApi.dataAjuizamento.replace(/(\d{4})(\d{2})(\d{2}).*/, "$1-$2-$3");
          form.setValue("data_distribuicao", dateStr);
        }

        toast({
          title: "Dados carregados",
          description: "Informações do processo foram preenchidas automaticamente.",
        });
      } else {
        toast({
          title: "Processo não encontrado",
          description: "Não foi possível encontrar dados externos para este número.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching from API:", error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar dados do processo.",
        variant: "destructive",
      });
    } finally {
      setFetchingFromApi(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const processData = {
        numero: values.numero.trim(),
        assunto: values.assunto || null,
        area: values.area,
        status: values.status,
        descricao: values.descricao || null,
        tribunal: values.tribunal || null,
        vara: values.vara || null,
        comarca: values.comarca || null,
        classe: values.classe || null,
        data_distribuicao: values.data_distribuicao || null,
        valor_causa: values.valor_causa ? parseFloat(values.valor_causa.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        polo_ativo: values.polo_ativo || null,
        polo_passivo: values.polo_passivo || null,
        coordenacao_id: values.coordenacao_id || null,
        advogado_responsavel_id: values.advogado_responsavel_id || null,
      };

      if (isEditing && processo) {
        // Update existing process
        const { error } = await supabase
          .from("processos")
          .update(processData)
          .eq("id", processo.id);

        if (error) throw error;

        toast({
          title: "Processo atualizado",
          description: "O processo foi atualizado com sucesso.",
        });
      } else {
        // Check if process already exists
        const { data: existing } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", values.numero.trim())
          .maybeSingle();

        if (existing) {
          toast({
            title: "Processo já existe",
            description: "Um processo com este número já está cadastrado.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Insert process
        const { data: newProcesso, error } = await supabase.from("processos").insert(processData).select("id").single();

        if (error) throw error;

        // Fetch and insert movements from API
        try {
          const { data: apiData } = await supabase.functions.invoke("consultar-processo", {
            body: { numeroProcesso: values.numero.trim() },
          });

          if (apiData?.movimentos && apiData.movimentos.length > 0) {
            const movimentosToInsert = apiData.movimentos.map((mov: any) => ({
              processo_id: newProcesso.id,
              descricao: mov.nome || "Sem descrição",
              data_movimentacao: mov.data ? new Date(mov.data).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
              tipo: "API Externa",
              fonte: "DataJud/CNJ",
            }));

            await supabase.from("movimentacoes").insert(movimentosToInsert);
          }
        } catch (apiError) {
          console.error("Error fetching movements:", apiError);
          // Continue even if API fails
        }

        toast({
          title: "Processo cadastrado",
          description: "O processo foi cadastrado com sucesso.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["processos"] });
      queryClient.invalidateQueries({ queryKey: ["processo"] });
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving process:", error);
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: error.message || "Não foi possível salvar o processo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing && <Pencil className="w-5 h-5" />}
            {isEditing ? "Editar Processo" : "Novo Processo"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Atualize as informações do processo conforme necessário."
              : "Preencha as informações do processo ou busque automaticamente pelo número CNJ."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basico" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basico">Dados Básicos</TabsTrigger>
                <TabsTrigger value="tribunal">Tribunal</TabsTrigger>
                <TabsTrigger value="partes">Partes</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Número do Processo *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="0000000-00.0000.0.00.0000" 
                            value={field.value}
                            onChange={(e) => handleNumeroChange(e, field.onChange)}
                            disabled={isEditing}
                            maxLength={25}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-8"
                    onClick={handleFetchFromApi}
                    disabled={fetchingFromApi}
                  >
                    {fetchingFromApi ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Buscar Dados"
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Área *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Situação *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a situação" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                            <SelectItem value="encerrado">Encerrado</SelectItem>
                            <SelectItem value="arquivado">Arquivado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="assunto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assunto</FormLabel>
                      <FormControl>
                        <Input placeholder="Assunto do processo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="classe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe CNJ</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Ação de Cobrança" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_distribuicao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Distribuição</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_causa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Causa</FormLabel>
                        <FormControl>
                          <Input placeholder="R$ 0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descrição adicional do processo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="tribunal" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="tribunal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Órgão (Comarca / Tribunal)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: TJSP, TRT-2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vara"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Órgão Julgador (Vara / Câmara)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 1ª Vara Cível" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comarca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade/Comarca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="coordenacao_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordenação</FormLabel>
                        <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a coordenação" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {coordenacoes.map((coord) => (
                              <SelectItem key={coord.id} value={coord.id}>
                                {coord.nome}
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
                    name="advogado_responsavel_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Advogado Responsável</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? "" : val)} 
                          value={field.value || "none"}
                          disabled={!selectedCoordenacao || selectedCoordenacao === "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedCoordenacao && selectedCoordenacao !== "none" ? "Selecione o advogado" : "Selecione coordenação primeiro"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {membros.map((membro) => (
                              <SelectItem key={membro.usuario.id} value={membro.usuario.id}>
                                {membro.usuario.nome || "Sem nome"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="partes" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="polo_ativo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parte Ativa (Autor / Requerente)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Nome(s) da parte ativa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="polo_passivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parte Passiva (Réu / Requerido)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Nome(s) da parte passiva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Cadastrar Processo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
