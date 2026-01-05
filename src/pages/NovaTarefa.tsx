import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HelpCircle, ArrowLeft, Upload, FileText, Trash2, Sparkles, CheckCircle2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

type AnexoComAnalise = {
  file: File;
  analise?: {
    categoria: string;
    tipo_documento: string | null;
    descricao: string;
    tags: string[];
    confianca: string;
  };
  analisando?: boolean;
  erro?: string;
};

const formSchema = z.object({
  tipo_vinculo: z.enum(["processo", "sem_vinculo"]),
  coordenacao_id: z.string().min(1, "Coordenação é obrigatória"),
  processo_id: z.string().optional(),
  tipo_tarefa: z.string().min(1, "Tipo de tarefa é obrigatório"),
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().optional(),
  responsavel_id: z.string().min(1, "Responsável é obrigatório"),
  data_base: z.string().optional(),
  data_vencimento: z.string().min(1, "Data prevista é obrigatória"),
  hora_prevista: z.string().optional(),
  data_fatal: z.string().optional(),
  hora_fatal: z.string().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  local: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const tiposTarefa = [
  "VERIFICAÇÃO",
  "DEFESA",
  "RECURSO",
  "CONTRARRAZÕES",
  "PETIÇÃO",
  "DILIGÊNCIA",
  "AUDIÊNCIA",
  "PROTOCOLO",
  "ANÁLISE",
  "ELABORAÇÃO",
  "SOLICITAÇÃO DE DOCS",
  "OUTROS"
];

export default function NovaTarefa() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processoIdParam = searchParams.get("processo");
  
  const [loading, setLoading] = useState(false);
  const [searchProcesso, setSearchProcesso] = useState("");
  const [anexos, setAnexos] = useState<AnexoComAnalise[]>([]);
  const [uploadingAnexos, setUploadingAnexos] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_vinculo: processoIdParam ? "processo" : "processo",
      coordenacao_id: "",
      processo_id: processoIdParam || "",
      tipo_tarefa: "",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      data_base: format(new Date(), "yyyy-MM-dd"),
      data_vencimento: "",
      hora_prevista: "",
      data_fatal: "",
      hora_fatal: "",
      prioridade: "media",
      local: "",
    },
  });

  const tipoVinculo = form.watch("tipo_vinculo");
  const coordenacaoId = form.watch("coordenacao_id");

  // Fetch coordenações
  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-nova-tarefa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch membros based on coordination
  const { data: membros } = useQuery({
    queryKey: ["membros-nova-tarefa", coordenacaoId],
    queryFn: async () => {
      if (!coordenacaoId) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `)
        .eq("coordenacao_id", coordenacaoId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!coordenacaoId,
  });

  // Fetch processos based on coordination and search
  const { data: processos, isLoading: loadingProcessos } = useQuery({
    queryKey: ["processos-nova-tarefa", coordenacaoId, searchProcesso],
    queryFn: async () => {
      if (!coordenacaoId && searchProcesso.length < 3) return [];

      let query = supabase
        .from("processos")
        .select(`
          id,
          numero,
          polo_ativo,
          cliente:clientes!processos_cliente_id_fkey(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (coordenacaoId) {
        query = query.eq("coordenacao_id", coordenacaoId);
      }

      if (searchProcesso.length >= 3) {
        query = query.or(`numero.ilike.%${searchProcesso}%,polo_ativo.ilike.%${searchProcesso}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: tipoVinculo === "processo" && (!!coordenacaoId || searchProcesso.length >= 3),
  });

  const analisarDocumentoComIA = async (file: File): Promise<AnexoComAnalise['analise']> => {
    try {
      let content = "";
      if (file.type === "text/plain" || file.name.endsWith('.txt')) {
        content = await file.text();
      } else {
        content = `[Arquivo binário: ${file.name}]`;
      }

      const { data, error } = await supabase.functions.invoke("analisar-documento", {
        body: {
          fileName: file.name,
          fileContent: content,
          mimeType: file.type,
        },
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Erro ao analisar documento:", err);
      return undefined;
    }
  };

  const handleAddAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const novosAnexos: AnexoComAnalise[] = Array.from(files).map(file => ({
        file,
        analisando: true,
      }));
      
      setAnexos(prev => [...prev, ...novosAnexos]);
      e.target.value = '';

      for (let i = 0; i < novosAnexos.length; i++) {
        const anexo = novosAnexos[i];
        try {
          const analise = await analisarDocumentoComIA(anexo.file);
          setAnexos(prev => prev.map(a => 
            a.file === anexo.file 
              ? { ...a, analise, analisando: false }
              : a
          ));
        } catch (err) {
          setAnexos(prev => prev.map(a => 
            a.file === anexo.file 
              ? { ...a, analisando: false, erro: "Falha na análise" }
              : a
          ));
        }
      }
    }
  };

  const handleRemoveAnexo = (index: number) => {
    setAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoriaLabel = (value: string) => {
    const categorias: Record<string, string> = {
      modelo: "Modelo",
      peca_processual: "Peça Processual",
      jurisprudencia: "Jurisprudência",
      legislacao: "Legislação",
      parecer: "Parecer",
      contrato: "Contrato",
      procuracao: "Procuração",
      outros: "Outros",
    };
    return categorias[value] || value;
  };

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const { data: novaTarefa, error } = await supabase.from("prazos").insert({
        processo_id: values.tipo_vinculo === "processo" ? values.processo_id : null,
        responsavel_id: values.responsavel_id,
        titulo: values.titulo,
        descricao: values.descricao || null,
        tipo_tarefa: values.tipo_tarefa,
        data_base: values.data_base || null,
        data_vencimento: values.data_vencimento,
        data_fatal: values.data_fatal || null,
        prioridade: values.prioridade,
        status: "pendente",
      }).select("id").single();

      if (error) throw error;

      if (anexos.length > 0 && novaTarefa?.id) {
        setUploadingAnexos(true);
        const folder = values.processo_id || `tarefas/${novaTarefa.id}`;
        
        for (const anexo of anexos) {
          const fileName = `${folder}/${Date.now()}_${anexo.file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('documentos_processos')
            .upload(fileName, anexo.file);

          if (uploadError) {
            console.error("Erro ao fazer upload:", uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('documentos_processos')
            .getPublicUrl(fileName);

          await supabase.from('documentos').insert({
            nome: anexo.file.name,
            tipo: anexo.analise?.categoria || anexo.file.type,
            url: publicUrl,
            tamanho_bytes: anexo.file.size,
            processo_id: values.processo_id || null,
            prazo_id: novaTarefa.id,
          });
        }
        setUploadingAnexos(false);
      }

      const { data: responsavel } = await supabase
        .from("profiles")
        .select("nome, telefone")
        .eq("id", values.responsavel_id)
        .single();

      if (responsavel?.telefone) {
        const dataFormatada = format(new Date(values.data_vencimento), "dd/MM/yyyy");
        const prioridadeLabel = {
          baixa: "Baixa",
          media: "Média", 
          alta: "Alta",
          urgente: "🚨 URGENTE"
        }[values.prioridade] || values.prioridade;

        let mensagem = `📋 *NOVA TAREFA DELEGADA*\n\n`;
        mensagem += `Olá ${responsavel.nome?.split(" ")[0] || ""}!\n`;
        mensagem += `Você recebeu uma nova tarefa:\n\n`;
        mensagem += `📌 *${values.titulo}*\n`;
        mensagem += `📁 Tipo: ${values.tipo_tarefa}\n`;
        mensagem += `📆 Prazo: ${dataFormatada}\n`;
        mensagem += `⚡ Prioridade: ${prioridadeLabel}\n`;
        if (values.descricao) {
          mensagem += `\n📝 *Descrição:*\n${values.descricao}\n`;
        }
        if (anexos.length > 0) {
          mensagem += `\n📎 ${anexos.length} documento(s) anexado(s)\n`;
        }
        mensagem += `\n_JurisControl - Sistema de Gestão Jurídica_`;

        supabase.functions.invoke("enviar-whatsapp-zapi", {
          body: {
            telefones: [responsavel.telefone],
            mensagem,
            tipo: "evento",
          },
        }).then(({ data, error: whatsappError }) => {
          if (whatsappError) {
            console.error("Erro ao enviar WhatsApp:", whatsappError);
          } else if (data?.enviados > 0) {
            toast({
              title: "WhatsApp enviado",
              description: `Notificação enviada para ${responsavel.nome}`,
            });
          }
        });
      }

      toast({
        title: "Tarefa criada!",
        description: anexos.length > 0 
          ? `Tarefa criada com ${anexos.length} documento(s) anexado(s).`
          : "A tarefa foi criada e delegada com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ["prazos"] });
      queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-tarefa"] });
      
      navigate("/central-delegacao");
    } catch (error: any) {
      toast({
        title: "Erro ao criar tarefa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploadingAnexos(false);
    }
  }

  const advogadosDisponiveis = membros
    ?.filter((m) => m.usuario?.id)
    .map((m) => ({ id: m.usuario!.id, nome: m.usuario!.nome })) || [];

  return (
    <MainLayout title="Nova Tarefa" subtitle="Crie e delegue uma nova tarefa para sua equipe">
      <div className="space-y-6">

        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Tarefa</CardTitle>
            <CardDescription>Preencha os campos abaixo para criar uma nova tarefa</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Tipo de Vínculo e Coordenação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_vinculo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Tipo de vínculo
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Vincule a um processo ou crie uma tarefa avulsa</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="processo">Processo</SelectItem>
                            <SelectItem value="sem_vinculo">Sem vínculo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="coordenacao_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordenação *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a coordenação" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {coordenacoes?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome} - {c.area}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Processo (if tipo_vinculo === "processo") */}
                {tipoVinculo === "processo" && (
                  <FormField
                    control={form.control}
                    name="processo_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Processo vinculado</FormLabel>
                        <FormDescription>
                          {!coordenacaoId && "Selecione uma coordenação ou digite pelo menos 3 caracteres"}
                        </FormDescription>
                        <div className="space-y-2">
                          <Input
                            placeholder="Buscar por número ou parte..."
                            value={searchProcesso}
                            onChange={(e) => setSearchProcesso(e.target.value)}
                          />
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o processo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingProcessos ? (
                                <div className="p-2 text-center text-muted-foreground">
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                </div>
                              ) : processos?.length === 0 ? (
                                <div className="p-2 text-center text-muted-foreground text-sm">
                                  Nenhum processo encontrado
                                </div>
                              ) : (
                                processos?.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <span className="font-mono text-xs">{p.numero}</span>
                                    {p.cliente?.nome && (
                                      <span className="text-muted-foreground ml-2">
                                        - {p.cliente.nome}
                                      </span>
                                    )}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Tipo de Tarefa e Título */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_tarefa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de tarefa *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposTarefa.map((tipo) => (
                              <SelectItem key={tipo} value={tipo}>
                                {tipo}
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
                        <FormLabel>Título *</FormLabel>
                        <FormControl>
                          <Input placeholder="Título da tarefa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Responsável */}
                <FormField
                  control={form.control}
                  name="responsavel_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!coordenacaoId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={coordenacaoId ? "Selecione o responsável" : "Selecione uma coordenação primeiro"} />
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

                {/* Data base */}
                <FormField
                  control={form.control}
                  name="data_base"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data base</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Datas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data prevista *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hora_prevista"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora prevista</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_fatal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fatal</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hora_fatal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Fatal</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Prioridade e Local */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="local"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local/Link</FormLabel>
                        <FormControl>
                          <Input placeholder="Local ou link da tarefa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Descrição */}
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes adicionais sobre a tarefa..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Anexos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Documentos para Análise
                      <Tooltip>
                        <TooltipTrigger>
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>A IA categoriza automaticamente os documentos anexados</p>
                        </TooltipContent>
                      </Tooltip>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        id="anexos-upload"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleAddAnexo}
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                      />
                      <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                        <Upload className="w-3 h-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                  
                  {anexos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                      Nenhum documento anexado. Clique em "Adicionar" para incluir arquivos.
                      <br />
                      <span className="text-amber-600">A IA irá categorizar automaticamente.</span>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {anexos.map((anexo, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText className="w-4 h-4 text-primary shrink-0" />
                              <span className="truncate font-medium">{anexo.file.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">
                                ({formatFileSize(anexo.file.size)})
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRemoveAnexo(index)}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs">
                            {anexo.analisando ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                                <span className="text-muted-foreground">Analisando com IA...</span>
                              </>
                            ) : anexo.analise ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                <Badge variant="secondary" className="text-xs">
                                  {getCategoriaLabel(anexo.analise.categoria)}
                                </Badge>
                                {anexo.analise.descricao && (
                                  <span className="text-muted-foreground truncate">
                                    {anexo.analise.descricao}
                                  </span>
                                )}
                              </>
                            ) : anexo.erro ? (
                              <span className="text-destructive">{anexo.erro}</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading || uploadingAnexos} className="w-full sm:w-auto">
                    {(loading || uploadingAnexos) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {uploadingAnexos ? "Enviando anexos..." : loading ? "Salvando..." : "Salvar Tarefa"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
