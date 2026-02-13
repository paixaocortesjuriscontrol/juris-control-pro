import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, Upload, FileText, Trash2, FolderOpen, Plus } from "lucide-react";
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
import { usePastas } from "@/hooks/usePastas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast as sonnerToast } from "sonner";
import { SelecionarResponsaveisProcesso } from "./SelecionarResponsaveisProcesso";


const formSchema = z.object({
  pasta_id: z.string().optional(),
  tipo_processo: z.enum(["judicial", "administrativo"]),
  numero: z.string().min(5, "Número do processo deve ter no mínimo 5 caracteres"),
  assunto: z.string().optional(),
  area: z.enum(["civil", "trabalhista", "empresarial"]),
  status: z.enum(["ativo", "pendente", "urgente", "encerrado", "arquivado"]),
  descricao: z.string().optional(),
  tribunal: z.string().optional(),
  vara: z.string().optional(),
  comarca: z.string().optional(),
  uf: z.string().optional(),
  classe: z.string().optional(),
  natureza: z.string().optional(),
  materia: z.string().optional(),
  fase: z.string().optional(),
  instancia: z.string().optional(),
  justica: z.string().optional(),
  esfera: z.string().optional(),
  data_distribuicao: z.string().optional(),
  data_recebimento: z.string().optional(),
  data_citacao: z.string().optional(),
  valor_causa: z.string().optional(),
  polo_ativo: z.string().optional(),
  polo_passivo: z.string().optional(),
  terceiro_envolvido: z.string().optional(),
  coordenacao_id: z.string().optional(),
  advogado_responsavel_id: z.string().optional(),
  cliente_id: z.string().optional(),
  // Campos contingenciais
  ativo_passivo: z.string().optional(),
  reclamante: z.string().optional(),
  reclamados: z.string().optional(),
  responsabilidade_tipo: z.string().optional(),
  risco_atual: z.string().optional(),
  valor_condenacao: z.string().optional(),
  funcao: z.string().optional(),
  advogado_externo: z.string().optional(),
  risco: z.string().optional(),
  probabilidade: z.string().optional(),
  valor_provisionado: z.string().optional(),
  pedidos: z.string().optional(),
  // Campos administrativos
  auto_infracao: z.string().optional(),
  nit_fiscalizado: z.string().optional(),
  cnpj_fiscalizado: z.string().optional(),
  valor_multa: z.string().optional(),
  data_lavratura: z.string().optional(),
  fiscal_responsavel: z.string().optional(),
  orgao_origem: z.string().optional(),
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
  const [activeTab, setActiveTab] = useState("basico");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Files state for documents tab
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newProcessoId, setNewProcessoId] = useState<string | null>(null);
  
  // State for creating new pasta
  const [criarNovaPasta, setCriarNovaPasta] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  
  // State for multiple responsible lawyers
  const [responsaveis, setResponsaveis] = useState<any[]>([]);

  const isEditing = !!processo;

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  // Evita contagens pesadas (processos/documentos por pasta) e só carrega quando o dialog abre.
  const { data: pastas = [] } = usePastas({ enabled: open });

  // Fetch clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, tipo, cpf_cnpj")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pasta_id: "",
      tipo_processo: "judicial",
      numero: "",
      assunto: "",
      area: "civil",
      status: "ativo",
      descricao: "",
      tribunal: "",
      vara: "",
      comarca: "",
      uf: "",
      classe: "",
      natureza: "",
      materia: "",
      fase: "",
      instancia: "",
      justica: "",
      esfera: "",
      data_distribuicao: "",
      data_recebimento: "",
      data_citacao: "",
      valor_causa: "",
      polo_ativo: "",
      polo_passivo: "",
      terceiro_envolvido: "",
      coordenacao_id: "",
      advogado_responsavel_id: "",
      cliente_id: "",
      ativo_passivo: "",
      reclamante: "",
      reclamados: "",
      responsabilidade_tipo: "",
      risco_atual: "",
      valor_condenacao: "",
      funcao: "",
      advogado_externo: "",
      risco: "",
      probabilidade: "",
      valor_provisionado: "",
      pedidos: "",
      // Campos administrativos
      auto_infracao: "",
      nit_fiscalizado: "",
      cnpj_fiscalizado: "",
      valor_multa: "",
      data_lavratura: "",
      fiscal_responsavel: "",
      orgao_origem: "",
    },
  });

  // Watch tipo_processo for conditional rendering
  const tipoProcesso = form.watch("tipo_processo");

  // Reset form when dialog opens or processo changes
  useEffect(() => {
    if (open) {
      setActiveTab("basico");
      setFiles([]);
      setNewProcessoId(null);
      setCriarNovaPasta(false);
      setNovaPastaNome("");
      // Só resetar responsáveis se for novo processo (não edição)
      // Para edição, o SelecionarResponsaveisProcesso carrega os dados existentes
      if (!processo) {
        setResponsaveis([]);
      }
      
      if (processo) {
        form.reset({
          pasta_id: processo.pasta_id || "",
          tipo_processo: processo.tipo_processo || "judicial",
          numero: processo.numero || "",
          assunto: processo.assunto || "",
          area: processo.area,
          status: processo.status,
          descricao: processo.descricao || "",
          tribunal: processo.tribunal || "",
          vara: processo.vara || "",
          comarca: processo.comarca || "",
          uf: processo.uf || "",
          classe: processo.classe || "",
          natureza: processo.natureza || "",
          materia: processo.materia || "",
          fase: processo.fase || "",
          instancia: processo.instancia || "",
          justica: processo.justica || "",
          esfera: processo.esfera || "",
          data_distribuicao: processo.data_distribuicao || "",
          data_recebimento: processo.data_recebimento || "",
          data_citacao: processo.data_citacao || "",
          valor_causa: processo.valor_causa?.toString() || "",
          polo_ativo: processo.polo_ativo || "",
          polo_passivo: processo.polo_passivo || "",
          terceiro_envolvido: processo.terceiro_envolvido || "",
          coordenacao_id: processo.coordenacao_id || "",
          advogado_responsavel_id: processo.advogado_responsavel_id || "",
          cliente_id: processo.cliente_id || "",
          ativo_passivo: processo.ativo_passivo || "",
          reclamante: processo.reclamante || "",
          reclamados: processo.reclamados || "",
          responsabilidade_tipo: processo.responsabilidade_tipo || "",
          risco_atual: processo.risco_atual || "",
          valor_condenacao: processo.valor_condenacao?.toString() || "",
          funcao: processo.funcao || "",
          advogado_externo: processo.advogado_externo || "",
          risco: processo.risco || "",
          probabilidade: processo.probabilidade || "",
          valor_provisionado: processo.valor_provisionado?.toString() || "",
          pedidos: processo.pedidos || "",
          // Campos administrativos
          auto_infracao: processo.auto_infracao || "",
          nit_fiscalizado: processo.nit_fiscalizado || "",
          cnpj_fiscalizado: processo.cnpj_fiscalizado || "",
          valor_multa: processo.valor_multa?.toString() || "",
          data_lavratura: processo.data_lavratura || "",
          fiscal_responsavel: processo.fiscal_responsavel || "",
          orgao_origem: processo.orgao_origem || "",
        });
      } else {
        form.reset({
          pasta_id: "",
          tipo_processo: "judicial",
          numero: "",
          assunto: "",
          area: "civil",
          status: "ativo",
          descricao: "",
          tribunal: "",
          vara: "",
          comarca: "",
          uf: "",
          classe: "",
          natureza: "",
          materia: "",
          fase: "",
          instancia: "",
          justica: "",
          esfera: "",
          data_distribuicao: "",
          data_recebimento: "",
          data_citacao: "",
          valor_causa: "",
          polo_ativo: "",
          polo_passivo: "",
          terceiro_envolvido: "",
          coordenacao_id: "",
          advogado_responsavel_id: "",
          cliente_id: "",
          ativo_passivo: "",
          reclamante: "",
          reclamados: "",
          responsabilidade_tipo: "",
          risco_atual: "",
          valor_condenacao: "",
          funcao: "",
          advogado_externo: "",
          risco: "",
          probabilidade: "",
          valor_provisionado: "",
          pedidos: "",
          // Campos administrativos
          auto_infracao: "",
          nit_fiscalizado: "",
          cnpj_fiscalizado: "",
          valor_multa: "",
          data_lavratura: "",
          fiscal_responsavel: "",
          orgao_origem: "",
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
    const tipo = form.getValues("tipo_processo");

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
      // Verificar tipo de processo para decidir qual função invocar
      if (tipo === "administrativo") {
        // Buscar no e-Processo (processos administrativos)
        const { data: apiData, error } = await supabase.functions.invoke("buscar-eprocesso", {
          body: { numeroProcesso: numero.trim() },
        });

        if (error) throw error;

        if (apiData?.found && apiData?.processo) {
          const processoApi = apiData.processo;
          let camposPreenchidos = 0;

          const toIsoDate = (value?: string) => {
            if (!value) return "";
            const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (m) return `${m[3]}-${m[2]}-${m[1]}`;
            return value;
          };

          // Preencher campos administrativos
          if (processoApi.orgaoOrigem) {
            form.setValue("orgao_origem", processoApi.orgaoOrigem);
            camposPreenchidos++;
          }
          if (processoApi.assunto) {
            form.setValue("assunto", processoApi.assunto);
            camposPreenchidos++;
          }
          if (processoApi.situacao) {
            form.setValue(
              "status",
              processoApi.situacao.toLowerCase().includes("arquivado") ? "arquivado" : "ativo"
            );
            camposPreenchidos++;
          }
          if (processoApi.interessados && processoApi.interessados.length > 0) {
            form.setValue("polo_ativo", processoApi.interessados.join(", "));
            camposPreenchidos++;
          }
          if (processoApi.dataAutuacao) {
            form.setValue("data_distribuicao", toIsoDate(processoApi.dataAutuacao));
            camposPreenchidos++;
          }

          console.log("Dados recebidos do e-Processo:", processoApi);
          console.log("Campos preenchidos:", camposPreenchidos);

          const url = (apiData as any)?.url as string | undefined;

          toast({
            title: camposPreenchidos > 0 ? "Dados carregados" : "Não foi possível preencher automaticamente",
            description:
              camposPreenchidos > 0
                ? `${camposPreenchidos} campo(s) do processo administrativo foram preenchidos.`
                : `O e-Processo retornou o processo, mas não trouxe dados estruturados para preencher os campos (provável verificação humana/JS).${url ? ` Abra: ${url}` : ""}`,
            variant: camposPreenchidos > 0 ? undefined : "destructive",
          });
        } else {
          const rawError = (apiData as any)?.error as string | undefined;
          const needsFirecrawl = !!rawError && rawError.includes("não configurada");

          toast({
            title: needsFirecrawl ? "Integração não configurada" : "Processo não encontrado",
            description:
              rawError || (apiData as any)?.message || "Não foi possível encontrar dados no e-Processo.",
            variant: "destructive",
          });
        }
      } else {
        // Buscar processo judicial (rotina existente)
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
              .filter(
                (p: any) =>
                  p.tipo === "POLO_ATIVO" ||
                  p.tipoParte === "AUTOR" ||
                  p.tipoParte === "REQUERENTE" ||
                  p.tipoParte === "RECLAMANTE"
              )
              .map((p: any) => p.nome)
              .filter(Boolean);

            const partesPassivas = processoApi.partes
              .filter(
                (p: any) =>
                  p.tipo === "POLO_PASSIVO" ||
                  p.tipoParte === "REU" ||
                  p.tipoParte === "REQUERIDO" ||
                  p.tipoParte === "RECLAMADO"
              )
              .map((p: any) => p.nome)
              .filter(Boolean);

            poloAtivo = partesAtivas.join(", ");
            poloPassivo = partesPassivas.join(", ");
          }

          // Determine area based on tribunal
          let area: "civil" | "trabalhista" | "empresarial" = "civil";
          const tribunalLower = (processoApi.tribunal || apiData.tribunal || "").toLowerCase();
          if (
            tribunalLower.includes("trt") ||
            tribunalLower.includes("tst") ||
            tribunalLower.includes("trabalho")
          ) {
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
          const rawError = (apiData as any)?.error || "";
          const requiresTribunal = (apiData as any)?.requiresTribunal;
          
          // Se o número não é válido para CNJ, sugerir mudar para Administrativo
          if (requiresTribunal || rawError.includes("identificar o tribunal") || rawError.includes("selecione o tribunal")) {
            toast({
              title: "Número não reconhecido como judicial",
              description: "Se for um processo administrativo (e-Processo/MTE), altere o Tipo de Processo para 'Administrativo' e tente novamente.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Processo não encontrado",
              description: rawError || "Não foi possível encontrar dados externos para este número.",
              variant: "destructive",
            });
          }
        }
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

  // File handling functions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const uploadDocuments = async (processoId: string) => {
    if (files.length === 0 || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = files.length;
      let uploadedCount = 0;

      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `processos/${processoId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos_processos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("documentos_processos")
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase.from("documentos").insert({
          nome: file.name,
          tipo: file.type || "application/octet-stream",
          url: urlData.publicUrl,
          tamanho_bytes: file.size,
          processo_id: processoId,
          uploaded_by: user.id,
        });

        if (insertError) throw insertError;

        uploadedCount++;
        setUploadProgress((uploadedCount / totalFiles) * 100);
      }

      sonnerToast.success(`${files.length} documento(s) enviado(s) com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    } catch (error: any) {
      sonnerToast.error("Erro ao enviar documentos: " + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      let pastaId = values.pasta_id || null;
      
      // Create new pasta if requested (when toggle is on AND has name)
      if (criarNovaPasta && novaPastaNome.trim() && user) {
        // Check if pasta with same name already exists
        const { data: existingPasta } = await supabase
          .from("pastas")
          .select("id")
          .ilike("nome", novaPastaNome.trim())
          .maybeSingle();
        
        if (existingPasta) {
          // Use existing pasta with same name
          pastaId = existingPasta.id;
        } else {
          // Create new pasta
          const { data: newPasta, error: pastaError } = await supabase
            .from("pastas")
            .insert({
              nome: novaPastaNome.trim(),
              criado_por: user.id,
            })
            .select("id")
            .single();
          
          if (pastaError) {
            toast({
              title: "Erro ao criar pasta",
              description: pastaError.message,
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          
          pastaId = newPasta.id;
          queryClient.invalidateQueries({ queryKey: ["pastas"] });
        }
      }
      
      const processData = {
        numero: values.numero.trim(),
        tipo_processo: values.tipo_processo,
        pasta_id: pastaId,
        assunto: values.assunto || null,
        area: values.area,
        status: values.status,
        descricao: values.descricao || null,
        tribunal: values.tribunal || null,
        vara: values.vara || null,
        comarca: values.comarca || null,
        uf: values.uf || null,
        classe: values.classe || null,
        natureza: values.natureza || null,
        materia: values.materia || null,
        fase: values.fase || null,
        instancia: values.instancia || null,
        justica: values.justica || null,
        esfera: values.esfera || null,
        data_distribuicao: values.data_distribuicao || null,
        data_recebimento: values.data_recebimento || null,
        data_citacao: values.data_citacao || null,
        valor_causa: values.valor_causa ? parseFloat(values.valor_causa.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        polo_ativo: values.polo_ativo || null,
        polo_passivo: values.polo_passivo || null,
        terceiro_envolvido: values.terceiro_envolvido || null,
        coordenacao_id: values.coordenacao_id || null,
        advogado_responsavel_id: values.advogado_responsavel_id || null,
        cliente_id: values.cliente_id || null,
        // Campos contingenciais
        ativo_passivo: values.ativo_passivo || null,
        reclamante: values.reclamante || null,
        reclamados: values.reclamados || null,
        responsabilidade_tipo: values.responsabilidade_tipo || null,
        risco_atual: values.risco_atual || null,
        valor_condenacao: values.valor_condenacao ? parseFloat(values.valor_condenacao.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        funcao: values.funcao || null,
        advogado_externo: values.advogado_externo || null,
        risco: values.risco || null,
        probabilidade: values.probabilidade || null,
        valor_provisionado: values.valor_provisionado ? parseFloat(values.valor_provisionado.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        pedidos: values.pedidos || null,
        // Campos administrativos
        auto_infracao: values.auto_infracao || null,
        nit_fiscalizado: values.nit_fiscalizado || null,
        cnpj_fiscalizado: values.cnpj_fiscalizado || null,
        valor_multa: values.valor_multa ? parseFloat(values.valor_multa.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        data_lavratura: values.data_lavratura || null,
        fiscal_responsavel: values.fiscal_responsavel || null,
        orgao_origem: values.orgao_origem || null,
      };

      if (isEditing && processo) {
        // Update existing process
        const { error } = await supabase
          .from("processos")
          .update(processData)
          .eq("id", processo.id);

        if (error) throw error;

        // Sync responsible lawyers
        if (responsaveis.length > 0) {
          // Delete existing and insert new
          await supabase.from("processos_responsaveis").delete().eq("processo_id", processo.id);
          await supabase.from("processos_responsaveis").insert(
            responsaveis.map((r) => ({
              processo_id: processo.id,
              usuario_id: r.usuario_id,
              coordenacao_id: r.coordenacao_id,
              papel: r.papel || "responsavel",
            }))
          );
        }

        // Upload documents if any
        if (files.length > 0) {
          await uploadDocuments(processo.id);
        }

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

        // Insert responsible lawyers
        if (responsaveis.length > 0) {
          await supabase.from("processos_responsaveis").insert(
            responsaveis.map((r) => ({
              processo_id: newProcesso.id,
              usuario_id: r.usuario_id,
              coordenacao_id: r.coordenacao_id,
              papel: r.papel || "responsavel",
            }))
          );
        }

        // Upload documents if any
        if (files.length > 0) {
          await uploadDocuments(newProcesso.id);
        }

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
        }

        toast({
          title: "Processo cadastrado",
          description: "O processo foi cadastrado com sucesso.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["processos"] });
      queryClient.invalidateQueries({ queryKey: ["processo"] });
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      form.reset();
      setFiles([]);
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="basico">Dados Básicos</TabsTrigger>
                <TabsTrigger value="tribunal">Tribunal</TabsTrigger>
                <TabsTrigger value="partes">Partes</TabsTrigger>
                <TabsTrigger value="administrativo" className={tipoProcesso === "administrativo" ? "bg-orange-100 dark:bg-orange-900/30" : ""}>
                  Administrativo
                </TabsTrigger>
                <TabsTrigger value="contingencial">Contingencial</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="space-y-4 mt-4">
                {/* Tipo de processo */}
                <FormField
                  control={form.control}
                  name="tipo_processo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Processo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="judicial">Judicial</SelectItem>
                          <SelectItem value="administrativo">Administrativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pasta field - Select existing or create new */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      Pasta
                    </FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCriarNovaPasta(!criarNovaPasta);
                        if (!criarNovaPasta) {
                          form.setValue("pasta_id", "");
                        } else {
                          setNovaPastaNome("");
                        }
                      }}
                      className="text-xs"
                    >
                      {criarNovaPasta ? (
                        <>Selecionar Existente</>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 mr-1" />
                          Criar Nova
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {criarNovaPasta ? (
                    <Input
                      placeholder="Digite o nome da nova pasta"
                      value={novaPastaNome}
                      onChange={(e) => setNovaPastaNome(e.target.value)}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="pasta_id"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a pasta" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma pasta</SelectItem>
                              {pastas.map((pasta) => (
                                <SelectItem key={pasta.id} value={pasta.id}>
                                  {pasta.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Número do Processo *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={tipoProcesso === "administrativo" ? "14152.127256/2023-39" : "0000000-00.0000.0.00.0000"}
                            value={field.value}
                            onChange={(e) => {
                              // Só aplica máscara CNJ para processos judiciais
                              if (tipoProcesso === "administrativo") {
                                field.onChange(e.target.value);
                              } else {
                                handleNumeroChange(e, field.onChange);
                              }
                            }}
                            disabled={isEditing}
                            maxLength={30}
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

                <div className="grid grid-cols-2 gap-4">
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

                  <FormField
                    control={form.control}
                    name="natureza"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Natureza</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Cível" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
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
                    name="data_recebimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Recebimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_citacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Citação</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome} {cliente.cpf_cnpj ? `(${cliente.cpf_cnpj})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Coordenação */}
                <FormField
                  control={form.control}
                  name="coordenacao_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coordenação</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val === "none" ? "" : val);
                        // Reset advogado when coordination changes
                        form.setValue("advogado_responsavel_id", "");
                      }} value={field.value || "none"}>
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

                {/* Advogado Responsável (filtrado por coordenação selecionada) */}
                <FormField
                  control={form.control}
                  name="advogado_responsavel_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Advogado Responsável</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o responsável" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {membros.map((m: any) => (
                            <SelectItem key={m.usuario?.id || m.id} value={m.usuario?.id || ""}>
                              {m.usuario?.nome || "Sem nome"} {m.cargo ? `(${m.cargo})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Responsáveis adicionais */}
                {selectedCoordenacao && (
                  <SelecionarResponsaveisProcesso
                    processoId={processo?.id}
                    coordenacaoIdPadrao={selectedCoordenacao}
                    value={responsaveis}
                    onChange={setResponsaveis}
                  />
                )}

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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tribunal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tribunal</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: TJSP, TRT-2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="justica"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justiça</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Estadual">Estadual</SelectItem>
                            <SelectItem value="Federal">Federal</SelectItem>
                            <SelectItem value="Trabalho">Trabalho</SelectItem>
                            <SelectItem value="Eleitoral">Eleitoral</SelectItem>
                            <SelectItem value="Militar">Militar</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vara"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vara / Câmara</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 1ª Vara Cível" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="instancia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instância</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1ª Instância">1ª Instância</SelectItem>
                            <SelectItem value="2ª Instância">2ª Instância</SelectItem>
                            <SelectItem value="Instância Superior">Instância Superior</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                  <FormField
                    control={form.control}
                    name="uf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: SP" maxLength={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fase Processual</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Conhecimento">Conhecimento</SelectItem>
                            <SelectItem value="Recursal">Recursal</SelectItem>
                            <SelectItem value="Execução">Execução</SelectItem>
                            <SelectItem value="Cumprimento de Sentença">Cumprimento de Sentença</SelectItem>
                            <SelectItem value="Liquidação">Liquidação</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="esfera"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Esfera</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Judicial">Judicial</SelectItem>
                            <SelectItem value="Extrajudicial">Extrajudicial</SelectItem>
                            <SelectItem value="Administrativo">Administrativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="coordenacao_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coordenação Principal</FormLabel>
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

                <div className="space-y-2">
                  <FormLabel>Responsáveis pelo Processo</FormLabel>
                  <SelecionarResponsaveisProcesso
                    processoId={processo?.id}
                    value={responsaveis}
                    onChange={setResponsaveis}
                    coordenacaoIdPadrao={selectedCoordenacao}
                  />
                  <p className="text-xs text-muted-foreground">
                    Selecione um ou mais advogados de qualquer coordenação
                  </p>
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

                <FormField
                  control={form.control}
                  name="terceiro_envolvido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terceiros Envolvidos</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Nome(s) de terceiros envolvidos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pedidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pedidos</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descreva os pedidos do processo" className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="administrativo" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Campos específicos para processos administrativos (e-Processo, MTE, Receita Federal, etc.)
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="auto_infracao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auto de Infração</FormLabel>
                        <FormControl>
                          <Input placeholder="Número do Auto de Infração" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="orgao_origem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Órgão de Origem</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MTE">MTE - Ministério do Trabalho</SelectItem>
                            <SelectItem value="Receita Federal">Receita Federal</SelectItem>
                            <SelectItem value="INSS">INSS</SelectItem>
                            <SelectItem value="CREA">CREA</SelectItem>
                            <SelectItem value="CRM">CRM</SelectItem>
                            <SelectItem value="OAB">OAB</SelectItem>
                            <SelectItem value="IBAMA">IBAMA</SelectItem>
                            <SelectItem value="ANVISA">ANVISA</SelectItem>
                            <SelectItem value="PROCON">PROCON</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cnpj_fiscalizado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ Fiscalizado</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nit_fiscalizado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIT / PIS</FormLabel>
                        <FormControl>
                          <Input placeholder="Número do NIT" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valor_multa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Multa</FormLabel>
                        <FormControl>
                          <Input placeholder="R$ 0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_lavratura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Lavratura</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fiscal_responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal Responsável</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do fiscal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="contingencial" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">Campos específicos para processos trabalhistas/contingenciais</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ativo_passivo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posição do Cliente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Ativo">Ativo</SelectItem>
                            <SelectItem value="Passivo">Passivo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="responsabilidade_tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Responsabilidade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Exclusiva">Exclusiva</SelectItem>
                            <SelectItem value="Solidária">Solidária</SelectItem>
                            <SelectItem value="Subsidiária">Subsidiária</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="risco_atual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Risco Atual</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Remoto">Remoto</SelectItem>
                            <SelectItem value="Possível">Possível</SelectItem>
                            <SelectItem value="Provável">Provável</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="probabilidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probabilidade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Remota">Remota</SelectItem>
                            <SelectItem value="Possível">Possível</SelectItem>
                            <SelectItem value="Provável">Provável</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valor_condenacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Condenação</FormLabel>
                        <FormControl>
                          <Input placeholder="R$ 0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_provisionado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Provisionado</FormLabel>
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
                  name="funcao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função/Cargo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Técnico de Enfermagem" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="advogado_externo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Advogado Externo</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do advogado externo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reclamante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reclamante</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do reclamante" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reclamados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reclamados</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Nome(s) dos reclamados" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="documentos" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Anexe documentos relacionados ao processo. Os arquivos serão enviados ao salvar.
                  </p>

                  {/* File upload area */}
                  <div 
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => document.getElementById("file-upload-input")?.click()}
                  >
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Clique para selecionar arquivos</p>
                    <p className="text-xs text-muted-foreground mt-1">ou arraste e solte aqui</p>
                    <input
                      id="file-upload-input"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  {/* Selected files list */}
                  {files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Arquivos selecionados ({files.length}):</p>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(index);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload progress */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Enviando documentos...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || isUploading}>
                {(loading || isUploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Cadastrar Processo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
