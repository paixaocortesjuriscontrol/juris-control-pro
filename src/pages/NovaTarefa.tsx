import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AGENDA_INFINITE_QUERY_KEY } from "@/hooks/useAgendaUnificada";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrlOrEmpty } from "@/utils/signedUrl";
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
import { registrarAuditoriaTarefa } from "@/hooks/useAuditoriaTarefas";
import { Loader2, HelpCircle, ArrowLeft, Upload, FileText, Trash2, Sparkles, CheckCircle2, Link2, X, Download, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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

import { TIPOS_TAREFA } from "@/constants/tiposTarefa";

const tiposTarefa = [...TIPOS_TAREFA];

export default function NovaTarefa() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processoIdParam = searchParams.get("processo");
  const editarId = searchParams.get("editar");
  const relacionadaId = searchParams.get("relacionada");
  
  // Parâmetros para pré-preenchimento (ex: vindo do Painel de Intimações)
  const tipoTarefaParam = searchParams.get("tipo_tarefa");
  const tituloParam = searchParams.get("titulo");
  const coordenacaoIdParam = searchParams.get("coordenacao");
  const descricaoParam = searchParams.get("descricao");
  
  const [loading, setLoading] = useState(false);
  const [searchProcesso, setSearchProcesso] = useState("");
  const [anexos, setAnexos] = useState<AnexoComAnalise[]>([]);
  const [uploadingAnexos, setUploadingAnexos] = useState(false);
  const [tarefaRelacionadaId, setTarefaRelacionadaId] = useState<string>(relacionadaId || "");
  const [searchTarefa, setSearchTarefa] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isEditMode = !!editarId;
  
  // Buscar dados da tarefa para edição
  const { data: tarefaParaEditar, isLoading: loadingTarefa } = useQuery({
    queryKey: ["tarefa-editar", editarId],
    queryFn: async () => {
      if (!editarId) return null;
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          *,
          processo:processos!tarefas_processo_id_fkey(id, numero, coordenacao_id),
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `)
        .eq("id", editarId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!editarId,
  });

  // Buscar tarefas relacionadas existentes (modo edição)
  const { data: tarefasRelacionadasExistentes } = useQuery({
    queryKey: ["tarefas-relacionadas-existentes", editarId],
    queryFn: async () => {
      if (!editarId) return [];
      
      // Buscar onde a tarefa atual é origem ou relacionada
      const { data: relacoes, error } = await supabase
        .from("tarefas_relacionadas")
        .select(`
          id,
          tarefa_origem_id,
          tarefa_relacionada_id,
          tarefa_origem:tarefas!tarefas_relacionadas_tarefa_origem_id_fkey(id, titulo, tipo_tarefa, data_vencimento, processo:processos!tarefas_processo_id_fkey(numero)),
          tarefa_relacionada:tarefas!tarefas_relacionadas_tarefa_relacionada_id_fkey(id, titulo, tipo_tarefa, data_vencimento, processo:processos!tarefas_processo_id_fkey(numero))
        `)
        .or(`tarefa_origem_id.eq.${editarId},tarefa_relacionada_id.eq.${editarId}`);
      
      if (error) throw error;
      
      // Mapear para retornar as tarefas que NÃO são a tarefa atual
      return (relacoes || []).map((rel: any) => {
        if (rel.tarefa_origem_id === editarId) {
          return rel.tarefa_relacionada;
        } else {
          return rel.tarefa_origem;
        }
      }).filter(Boolean);
    },
    enabled: !!editarId,
  });

  // Buscar documentos existentes (modo edição)
  const { data: documentosExistentes, refetch: refetchDocumentos } = useQuery({
    queryKey: ["documentos-tarefa-edicao", editarId],
    queryFn: async () => {
      if (!editarId) return [];
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("tarefa_id", editarId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!editarId,
  });

  const handleDeleteDocumento = async (docId: string, url: string) => {
    try {
      // Extrair path do storage
      const urlParts = url.split('/documentos_processos/');
      if (urlParts.length > 1) {
        const path = urlParts[1];
        await supabase.storage.from('documentos_processos').remove([path]);
      }
      
      await supabase.from('documentos').delete().eq('id', docId);
      refetchDocumentos();
      toast({
        title: "Documento excluído",
        description: "O documento foi removido com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o documento.",
        variant: "destructive",
      });
    }
  };
  
  // Buscar usuário atual para salvar criado_por
  const { data: userData } = useQuery({
    queryKey: ["current-user-nova-tarefa"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Buscar coordenação do usuário logado
  const { data: userCoordenacao } = useQuery({
    queryKey: ["user-coordenacao", userData?.id],
    queryFn: async () => {
      if (!userData?.id) return null;
      // Primeiro verificar se é coordenador de alguma coordenação
      const { data: coordenador } = await supabase
        .from("coordenacoes")
        .select("id")
        .eq("coordenador_id", userData.id)
        .limit(1)
        .maybeSingle();
      
      if (coordenador) return coordenador.id;
      
      // Senão, buscar a primeira coordenação onde é membro
      const { data: membro } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", userData.id)
        .limit(1)
        .maybeSingle();
      
      return membro?.coordenacao_id || null;
    },
    enabled: !!userData?.id && !coordenacaoIdParam && !isEditMode,
  });

  // Data de hoje para pré-preenchimento
  const hoje = format(new Date(), "yyyy-MM-dd");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_vinculo: processoIdParam ? "processo" : "processo",
      coordenacao_id: coordenacaoIdParam || "",
      processo_id: processoIdParam || "",
      tipo_tarefa: tipoTarefaParam || "",
      titulo: tituloParam || "",
      descricao: descricaoParam || "",
      responsavel_id: "",
      data_base: hoje,
      data_vencimento: processoIdParam && tipoTarefaParam ? hoje : "",
      hora_prevista: "",
      data_fatal: processoIdParam && tipoTarefaParam ? hoje : "",
      hora_fatal: "",
      prioridade: "media",
      local: "",
    },
  });

  // Pré-selecionar coordenação do usuário logado
  useEffect(() => {
    if (userCoordenacao && !coordenacaoIdParam && !isEditMode) {
      const currentValue = form.getValues("coordenacao_id");
      if (!currentValue) {
        form.setValue("coordenacao_id", userCoordenacao);
      }
    }
  }, [userCoordenacao, coordenacaoIdParam, isEditMode, form]);

  // Preencher form quando carregar tarefa para edição
  useEffect(() => {
    if (tarefaParaEditar) {
      form.reset({
        tipo_vinculo: tarefaParaEditar.processo_id ? "processo" : "sem_vinculo",
        coordenacao_id: tarefaParaEditar.processo?.coordenacao_id || "",
        processo_id: tarefaParaEditar.processo_id || "",
        tipo_tarefa: tarefaParaEditar.tipo_tarefa || "",
        titulo: tarefaParaEditar.titulo || "",
        descricao: tarefaParaEditar.descricao || "",
        responsavel_id: tarefaParaEditar.responsavel_id || "",
        data_base: tarefaParaEditar.data_base || format(new Date(), "yyyy-MM-dd"),
        data_vencimento: tarefaParaEditar.data_vencimento || "",
        hora_prevista: "",
        data_fatal: tarefaParaEditar.data_fatal || "",
        hora_fatal: "",
        prioridade: tarefaParaEditar.prioridade || "media",
        local: "",
      });
    }
  }, [tarefaParaEditar, form]);

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

  // Fetch processo pré-selecionado (quando vem via URL)
  const { data: processoPreSelecionado } = useQuery({
    queryKey: ["processo-pre-selecionado", processoIdParam],
    queryFn: async () => {
      if (!processoIdParam) return null;
      const { data, error } = await supabase
        .from("processos")
        .select(`
          id,
          numero,
          polo_ativo,
          cliente:clientes!processos_cliente_id_fkey(nome)
        `)
        .eq("id", processoIdParam)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!processoIdParam,
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

  // Combinar processos da busca com o pré-selecionado (para garantir que apareça na lista)
  const processosDisponiveis = useMemo(() => {
    const lista = processos || [];
    if (processoPreSelecionado && !lista.find(p => p.id === processoPreSelecionado.id)) {
      return [processoPreSelecionado, ...lista];
    }
    return lista;
  }, [processos, processoPreSelecionado]);

  // Fetch tarefas para vincular (quando sem vínculo de processo)
  const { data: tarefasParaVincular, isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas-vincular", searchTarefa],
    queryFn: async () => {
      if (searchTarefa.length < 3) return [];

      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          tipo_tarefa,
          data_vencimento,
          processo:processos!tarefas_processo_id_fkey(numero)
        `)
        .or(`titulo.ilike.%${searchTarefa}%,tipo_tarefa.ilike.%${searchTarefa}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data || [];
    },
    enabled: tipoVinculo === "sem_vinculo" && searchTarefa.length >= 3,
  });

  // Fetch tarefa selecionada para exibir
  const { data: tarefaSelecionada } = useQuery({
    queryKey: ["tarefa-selecionada", tarefaRelacionadaId],
    queryFn: async () => {
      if (!tarefaRelacionadaId) return null;
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          tipo_tarefa,
          data_vencimento,
          processo:processos!tarefas_processo_id_fkey(numero)
        `)
        .eq("id", tarefaRelacionadaId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!tarefaRelacionadaId,
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
    const dadosEntrada = { 
      ...values, 
      isEditMode, 
      editarId,
      anexosCount: anexos.length,
      tarefaRelacionadaId 
    };
    
    try {
      let tarefaId: string;
      
      if (isEditMode && editarId) {
        // Modo edição - atualizar tarefa existente
        const { error } = await supabase.from("tarefas").update({
          processo_id: values.tipo_vinculo === "processo" && values.processo_id ? values.processo_id : null,
          responsavel_id: values.responsavel_id,
          titulo: values.titulo,
          descricao: values.descricao || null,
          tipo_tarefa: values.tipo_tarefa,
          data_base: values.data_base || null,
          data_vencimento: values.data_vencimento,
          data_fatal: values.data_fatal || null,
          prioridade: values.prioridade,
        } as any).eq("id", editarId);

        if (error) throw error;
        tarefaId = editarId;

        // Registrar auditoria de atualização
        await registrarAuditoriaTarefa({
          acao: 'atualizar',
          sucesso: true,
          dadosEntrada,
          dadosSaida: { tarefaId },
          origem: 'nova_tarefa_page',
          processoId: values.processo_id,
          tarefaId,
        });
      } else {
        // Modo criação - inserir nova tarefa
        const { data: novaTarefa, error } = await supabase.from("tarefas").insert({
          processo_id: values.tipo_vinculo === "processo" && values.processo_id ? values.processo_id : null,
          responsavel_id: values.responsavel_id,
          titulo: values.titulo,
          descricao: values.descricao || null,
          tipo_tarefa: values.tipo_tarefa,
          data_base: values.data_base || null,
          data_vencimento: values.data_vencimento,
          data_fatal: values.data_fatal || null,
          prioridade: values.prioridade,
          status: "pendente",
          criado_por: userData?.id || null,
        } as any).select("id").single();

        if (error) throw error;
        tarefaId = novaTarefa.id;

        // Registrar auditoria de criação
        await registrarAuditoriaTarefa({
          acao: 'criar',
          sucesso: true,
          dadosEntrada,
          dadosSaida: { tarefaId },
          origem: 'nova_tarefa_page',
          processoId: values.processo_id,
          tarefaId,
        });

        // Se tiver tarefa relacionada, criar o vínculo (apenas na criação)
        if (tarefaId && tarefaRelacionadaId && userData?.id) {
          await supabase.from("tarefas_relacionadas").insert({
            tarefa_origem_id: tarefaRelacionadaId,
            tarefa_relacionada_id: tarefaId,
            criado_por: userData.id,
          });
        }
      }

      let uploadedCount = 0;
      let failedUploads: string[] = [];
      
      if (anexos.length > 0 && tarefaId) {
        setUploadingAnexos(true);
        const folder = values.processo_id || `tarefas/${tarefaId}`;
        
        for (const anexo of anexos) {
          // Sanitizar nome do arquivo - remover caracteres especiais
          const sanitizedName = anexo.file.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-zA-Z0-9._-]/g, '_'); // Substitui caracteres especiais por _
          const fileName = `${folder}/${Date.now()}_${sanitizedName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('documentos_processos')
            .upload(fileName, anexo.file);

          if (uploadError) {
            console.error("Erro ao fazer upload:", uploadError);
            failedUploads.push(anexo.file.name);
            continue;
          }

          const signedUrl = await getSignedUrlOrEmpty("documentos_processos", fileName);

          const { error: insertError } = await supabase.from('documentos').insert({
            nome: anexo.file.name,
            tipo: anexo.analise?.categoria || anexo.file.type,
            url: signedUrl,
            tamanho_bytes: anexo.file.size,
            processo_id: values.processo_id || null,
            tarefa_id: tarefaId,
          });
          
          if (!insertError) {
            uploadedCount++;
          } else {
            console.error("Erro ao salvar documento:", insertError);
            failedUploads.push(anexo.file.name);
          }
        }
        setUploadingAnexos(false);
      }

      // Enviar notificação (email + whatsapp) apenas para novas tarefas (não edição)
      if (!isEditMode && tarefaId && values.responsavel_id) {
        supabase.functions.invoke("notificar-tarefa-criada", {
          body: {
            tarefa_id: tarefaId,
            titulo: values.titulo,
            descricao: values.descricao,
            data_vencimento: values.data_vencimento,
            prioridade: values.prioridade,
            processo_id: values.processo_id || undefined,
            responsavel_id: values.responsavel_id,
          },
        }).then(({ data, error: notifyError }) => {
          if (notifyError) {
            console.error("Erro ao notificar tarefa:", notifyError);
          } else if (data?.enviados > 0) {
            toast({
              title: "Notificação enviada",
              description: `Email e/ou WhatsApp enviado para o responsável`,
            });
          }
        }).catch((err) => console.log("Erro ao notificar tarefa (ignorado):", err));
      }

      // Mostrar resultado do upload com detalhes
      const actionLabel = isEditMode ? "atualizada" : "criada";
      if (failedUploads.length > 0) {
        toast({
          title: `Tarefa ${actionLabel} com avisos`,
          description: `${uploadedCount} documento(s) enviado(s). ${failedUploads.length} falhou: ${failedUploads.join(", ")}`,
          variant: "destructive",
        });
      } else if (anexos.length > 0) {
        toast({
          title: `Tarefa ${actionLabel}!`,
          description: `Tarefa ${actionLabel} com ${uploadedCount} documento(s) anexado(s).`,
        });
      } else {
        toast({
          title: `Tarefa ${actionLabel}!`,
          description: isEditMode 
            ? "As alterações foram salvas com sucesso."
            : "A tarefa foi criada e delegada com sucesso.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["prazos"] });
      queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-tarefa"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      
      // Aguardar 2s para a usuária ver o toast de confirmação antes de navegar
      setTimeout(() => navigate("/central-delegacao"), 2000);
    } catch (error: any) {
      // Registrar auditoria de falha
      await registrarAuditoriaTarefa({
        acao: isEditMode ? 'erro_atualizar' : 'erro_criar',
        sucesso: false,
        dadosEntrada,
        erroMensagem: error.message,
        erroDetalhes: { code: error.code, hint: error.hint, details: error.details },
        origem: 'nova_tarefa_page',
        processoId: values.processo_id,
        tarefaId: editarId,
      });

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

  if (loadingTarefa && isEditMode) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title={isEditMode ? "Editar Tarefa" : "Nova Tarefa"} 
      subtitle={isEditMode ? "Altere os dados da tarefa conforme necessário" : "Crie e delegue uma nova tarefa para sua equipe"}
    >
      <div className="space-y-6">

        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Tarefa</CardTitle>
            <CardDescription>
              {isEditMode ? "Edite os campos abaixo para atualizar a tarefa" : "Preencha os campos abaixo para criar uma nova tarefa"}
            </CardDescription>
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
                              ) : processosDisponiveis.length === 0 ? (
                                <div className="p-2 text-center text-muted-foreground text-sm">
                                  Nenhum processo encontrado
                                </div>
                              ) : (
                                processosDisponiveis.map((p) => (
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

                {/* Vincular a tarefa existente (sem_vinculo) */}
                {tipoVinculo === "sem_vinculo" && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-1">
                      <Link2 className="w-4 h-4" />
                      Vincular a tarefa existente (opcional)
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Vincule esta tarefa a outra já existente como relacionada</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>

                    {tarefaSelecionada ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{tarefaSelecionada.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {tarefaSelecionada.tipo_tarefa}
                            {tarefaSelecionada.processo?.numero && ` • ${tarefaSelecionada.processo.numero}`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setTarefaRelacionadaId("")}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Digite 3+ caracteres para buscar tarefa..."
                          value={searchTarefa}
                          onChange={(e) => setSearchTarefa(e.target.value)}
                        />
                        {loadingTarefas ? (
                          <div className="flex items-center gap-2 p-3 border rounded-md">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Buscando tarefas...</span>
                          </div>
                        ) : tarefasParaVincular && tarefasParaVincular.length > 0 ? (
                          <div className="border rounded-md max-h-48 overflow-y-auto">
                            {tarefasParaVincular.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0"
                                onClick={() => {
                                  setTarefaRelacionadaId(t.id);
                                  setSearchTarefa("");
                                }}
                              >
                                <p className="font-medium text-sm">{t.titulo}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t.tipo_tarefa}
                                  {t.processo?.numero && ` • ${t.processo.numero}`}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : searchTarefa.length >= 3 ? (
                          <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                            Nenhuma tarefa encontrada
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
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

                {/* Tarefas Relacionadas Existentes (modo edição) */}
                {isEditMode && tarefasRelacionadasExistentes && tarefasRelacionadasExistentes.length > 0 && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      Tarefas Vinculadas
                    </Label>
                    <div className="border rounded-md divide-y">
                      {tarefasRelacionadasExistentes.map((tarefa: any) => (
                        <div key={tarefa.id} className="p-3 flex items-center gap-3 hover:bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{tarefa.titulo}</p>
                            <p className="text-xs text-muted-foreground">
                              {tarefa.tipo_tarefa}
                              {tarefa.processo?.numero && ` • ${tarefa.processo.numero}`}
                              {tarefa.data_vencimento && ` • ${format(new Date(tarefa.data_vencimento), "dd/MM/yyyy")}`}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/nova-tarefa?editar=${tarefa.id}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documentos Existentes (modo edição) */}
                {isEditMode && documentosExistentes && documentosExistentes.length > 0 && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Documentos Anexados
                    </Label>
                    <div className="border rounded-md divide-y">
                      {documentosExistentes.map((doc: any) => (
                        <div key={doc.id} className="p-3 flex items-center gap-3">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doc.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.tipo && <Badge variant="secondary" className="text-xs mr-2">{doc.tipo}</Badge>}
                              {doc.tamanho_bytes && formatFileSize(doc.tamanho_bytes)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(doc.url, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteDocumento(doc.id, doc.url)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anexos (novos) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      {isEditMode ? "Adicionar Novos Documentos" : "Documentos para Análise"}
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
                      {isEditMode ? "Clique em \"Adicionar\" para incluir novos arquivos." : "Nenhum documento anexado. Clique em \"Adicionar\" para incluir arquivos."}
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
                    {uploadingAnexos ? "Enviando anexos..." : loading ? "Salvando..." : isEditMode ? "Salvar Alterações" : "Salvar Tarefa"}
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
