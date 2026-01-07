import { useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { buscarAndamentosExternos } from "@/hooks/useBuscarAndamentos";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Scale, 
  Calendar, 
  User, 
  MapPin, 
  Building2, 
  FileText, 
  RefreshCw,
  Clock,
  Users,
  Edit,
  Save,
  X,
  DollarSign,
  Briefcase,
  Info,
  FileBox,
  Bell,
  BellOff,
  AlertTriangle,
  Newspaper,
  Eye,
  EyeOff,
  Gavel,
  AlertCircle,
  Pencil,
  CheckCircle,
  XCircle,
  PlayCircle,
  ClipboardList,
  Shuffle,
  Radar,
  ListTodo,
  CalendarDays
} from "lucide-react";
import { EditarAudienciaDialog } from "@/components/audiencias/EditarAudienciaDialog";
import { AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { ProcessoAgendaTab } from "@/components/processos/ProcessoAgendaTab";
import { ProcessoDocumentosTab } from "@/components/processos/ProcessoDocumentosTab";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Database } from "@/integrations/supabase/types";

type StatusProcesso = Database["public"]["Enums"]["status_processo"];
type AreaAtuacao = Database["public"]["Enums"]["area_atuacao"];

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

const statusOptions: StatusProcesso[] = ["ativo", "pendente", "urgente", "encerrado", "arquivado"];
const areaOptions: AreaAtuacao[] = ["civil", "trabalhista", "empresarial"];

export default function ProcessoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [toglingMonitoramento, setToglingMonitoramento] = useState(false);
  const [toglingLida, setToglingLida] = useState<string | null>(null);
  
  // States for audiências and intimações actions
  const [selectedAudiencia, setSelectedAudiencia] = useState<AudienciaDetectada | null>(null);
  const [editingAudiencia, setEditingAudiencia] = useState<AudienciaDetectada | null>(null);
  const [selectedIntimacao, setSelectedIntimacao] = useState<any>(null);
  const [updatingAudiencia, setUpdatingAudiencia] = useState<string | null>(null);
  const [updatingIntimacao, setUpdatingIntimacao] = useState<string | null>(null);
  
  // Tab toggle state
  const [activeTab, setActiveTab] = useState<string>("");
  
  // Form state for all fields
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: processo, isLoading: loadingProcesso } = useQuery({
    queryKey: ["processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          *,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome, email),
          cliente:clientes!processos_cliente_id_fkey(id, nome, tipo, cpf_cnpj, email, telefone),
          pasta:pastas!processos_pasta_id_fkey(id, nome)
        `)
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: movimentacoes, isLoading: loadingMovimentacoes, refetch: refetchMovimentacoes } = useQuery({
    queryKey: ["movimentacoes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("processo_id", id!)
        .order("data_movimentacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: membrosCoordenacao = [] } = useQuery({
    queryKey: ["membros-coordenacao", formData.coordenacao_id || processo?.coordenacao_id],
    queryFn: async () => {
      const coordId = formData.coordenacao_id || processo?.coordenacao_id;
      if (!coordId) return [];
      
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          usuario_id,
          cargo,
          profiles:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `)
        .eq("coordenacao_id", coordId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!(formData.coordenacao_id || processo?.coordenacao_id),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, tipo")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: publicacoesDjen = [], isLoading: loadingPublicacoes, refetch: refetchPublicacoes } = useQuery({
    queryKey: ["publicacoes-djen-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publicacoes_djen_processos")
        .select("*")
        .eq("processo_id", id!)
        .order("data_encontrado", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Query para audiências do processo
  const { data: audiencias = [], isLoading: loadingAudiencias } = useQuery({
    queryKey: ["audiencias-processo", id, processo?.numero],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audiencias_detectadas")
        .select("*")
        .or(`processo_id.eq.${id},processo_numero.eq.${processo?.numero}`)
        .order("data_audiencia", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!processo?.numero,
  });

  // Query para intimações do processo
  const { data: intimacoes = [], isLoading: loadingIntimacoes } = useQuery({
    queryKey: ["intimacoes-processo", id, processo?.numero],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes_detectadas")
        .select("*")
        .or(`processo_id.eq.${id},processo_numero.eq.${processo?.numero}`)
        .order("data_intimacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!processo?.numero,
  });

  // Query para tarefas do processo
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          *,
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome),
          criador:profiles!tarefas_criado_por_fkey(id, nome)
        `)
        .eq("processo_id", id!)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Query para redistribuições encontradas do processo
  const { data: redistribuicoes = [], isLoading: loadingRedistribuicoes } = useQuery({
    queryKey: ["redistribuicoes-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribuicoes_encontradas")
        .select(`
          *,
          monitoramento:monitoramentos_distribuicao!distribuicoes_encontradas_monitoramento_id_fkey(termo_busca, tipo)
        `)
        .eq("processo_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Query para alertas de monitoramento 360 do processo
  const { data: alertas360 = [], isLoading: loadingAlertas360 } = useQuery({
    queryKey: ["alertas-360-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_monitoramento")
        .select(`
          *,
          termo:termos_monitoramento!alertas_monitoramento_termo_id_fkey(termo, categoria, prioridade),
          movimentacao:movimentacoes!alertas_monitoramento_movimentacao_id_fkey(descricao, data_movimentacao)
        `)
        .eq("processo_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Query para documentos do processo
  const { data: documentosProcesso = [], refetch: refetchDocumentos } = useQuery({
    queryKey: ["documentos-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*, uploader:profiles!documentos_uploaded_by_fkey(id, nome)")
        .eq("processo_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Query para contar eventos de agenda vinculados ao processo
  const { data: eventosAgenda = [] } = useQuery({
    queryKey: ["eventos-agenda-processo-count", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_agenda")
        .select("id")
        .eq("processo_id", id!);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });


  useEffect(() => {
    if (processo && editando) {
      setFormData({
        numero: processo.numero || "",
        assunto: processo.assunto || "",
        area: processo.area || "",
        status: processo.status || "ativo",
        classe: processo.classe || "",
        natureza: processo.natureza || "",
        materia: processo.materia || "",
        fase: processo.fase || "",
        instancia: processo.instancia || "",
        justica: processo.justica || "",
        esfera: processo.esfera || "",
        tribunal: processo.tribunal || "",
        vara: processo.vara || "",
        comarca: processo.comarca || "",
        uf: processo.uf || "",
        polo_ativo: processo.polo_ativo || "",
        polo_passivo: processo.polo_passivo || "",
        terceiro_envolvido: processo.terceiro_envolvido || "",
        funcao_parte_contraria: processo.funcao_parte_contraria || "",
        cpf_cnpj_parte_contraria: processo.cpf_cnpj_parte_contraria || "",
        data_distribuicao: processo.data_distribuicao || "",
        data_recebimento: processo.data_recebimento || "",
        data_citacao: processo.data_citacao || "",
        data_fato_gerador: processo.data_fato_gerador || "",
        data_encerramento: processo.data_encerramento || "",
        data_arquivamento: processo.data_arquivamento || "",
        valor_causa: processo.valor_causa || "",
        valor_condenacao: processo.valor_condenacao || "",
        valor_provisionado: processo.valor_provisionado || "",
        provisionamento_provavel: processo.provisionamento_provavel || "",
        provisionamento_possivel: processo.provisionamento_possivel || "",
        provisionamento_remoto: processo.provisionamento_remoto || "",
        deposito_judicial: processo.deposito_judicial || "",
        valor_pago: processo.valor_pago || "",
        valor_pagamento: processo.valor_pagamento || "",
        tipo_pagamento: processo.tipo_pagamento || "",
        forma_pagamento: processo.forma_pagamento || "",
        risco: processo.risco || "",
        probabilidade: processo.probabilidade || "",
        resultado: processo.resultado || "",
        transitado_julgado: processo.transitado_julgado || false,
        andamento_atual: processo.andamento_atual || "",
        descricao: processo.descricao || "",
        observacoes_processo: processo.observacoes_processo || "",
        pedidos: processo.pedidos || "",
        periodo_laborado: processo.periodo_laborado || "",
        coordenacao_id: processo.coordenacao_id || "",
        advogado_responsavel_id: processo.advogado_responsavel_id || "__none__",
        cliente_id: processo.cliente_id || "__none__",
        unidade_cliente: processo.unidade_cliente || "",
        sigla_unidade: processo.sigla_unidade || "",
        pasta_cliente: processo.pasta_cliente || "",
        pasta_fisica: processo.pasta_fisica || "",
        tipo_controladora: processo.tipo_controladora || "",
        identificador_projuris: processo.identificador_projuris || "",
        responsaveis_projuris: processo.responsaveis_projuris || "",
        // Campos contingenciais (Dra. Janaina)
        ativo_passivo: processo.ativo_passivo || "",
        reclamante: processo.reclamante || "",
        reclamados: processo.reclamados || "",
        data_desligamento: processo.data_desligamento || "",
        responsabilidade_tipo: processo.responsabilidade_tipo || "",
        data_consulta: processo.data_consulta || "",
        periodo_condenacao: processo.periodo_condenacao || "",
        risco_anterior: processo.risco_anterior || "",
        risco_atual: processo.risco_atual || "",
        mudanca_risco: processo.mudanca_risco || false,
        valor_perda_anterior: processo.valor_perda_anterior || "",
        valor_perda_atual: processo.valor_perda_atual || "",
        responsabilidade_antes_data: processo.responsabilidade_antes_data || "",
        responsabilidade_apos_data: processo.responsabilidade_apos_data || "",
        adicao_baixa: processo.adicao_baixa || "",
        depositos_vinculados: processo.depositos_vinculados || "",
        epoca_razao: processo.epoca_razao || "",
        setor: processo.setor || "",
        funcao: processo.funcao || "",
        advogado_externo: processo.advogado_externo || "",
        pedido_valor: processo.pedido_valor || "",
        justificativa_risco: processo.justificativa_risco || "",
        // Campos MPT
        localidade: processo.localidade || "",
        autor: processo.autor || "",
        requerido: processo.requerido || "",
        materia_mpt: processo.materia_mpt || "",
        ultimo_andamento_mpt: processo.ultimo_andamento_mpt || "",
        observacao_advogado: processo.observacao_advogado || "",
        // Campos de Pedidos
        lei_13467_2017: processo.lei_13467_2017 || "",
        responsabilidade_subsidiaria: processo.responsabilidade_subsidiaria || "",
        pedido_excesso_jornada: processo.pedido_excesso_jornada || false,
        pedido_plantoes_extras: processo.pedido_plantoes_extras || false,
        pedido_dobras: processo.pedido_dobras || false,
        pedido_intervalo_intrajornada: processo.pedido_intervalo_intrajornada || "",
        pedido_intervalo_interjornada: processo.pedido_intervalo_interjornada || false,
        pedido_descaract_jornada_12_36: processo.pedido_descaract_jornada_12_36 || false,
        pedido_domingos_feriados: processo.pedido_domingos_feriados || "",
        pedido_insalubridade_periculosidade: processo.pedido_insalubridade_periculosidade || "",
        pedido_diferencas_salariais: processo.pedido_diferencas_salariais || "",
        pedido_adicional_noturno: processo.pedido_adicional_noturno || "",
        pedido_sobrecarga_trabalho: processo.pedido_sobrecarga_trabalho || "",
        pedido_reconhecimento_vinculo: processo.pedido_reconhecimento_vinculo || "",
        pedido_danos_morais_assedio: processo.pedido_danos_morais_assedio || "",
        pedido_danos_morais_outros: processo.pedido_danos_morais_outros || "",
        pedido_acidente_doenca: processo.pedido_acidente_doenca || "",
        pedido_danos_materiais: processo.pedido_danos_materiais || false,
        pedido_pensao_vitalicia: processo.pedido_pensao_vitalicia || false,
        pedido_danos_morais_acidente: processo.pedido_danos_morais_acidente || "",
        pedido_limbo_previdenciario: processo.pedido_limbo_previdenciario || false,
        pedido_estabilidade: processo.pedido_estabilidade || "",
        pedido_indenizacao_substitutiva: processo.pedido_indenizacao_substitutiva || false,
        pedido_reversao_justa_causa: processo.pedido_reversao_justa_causa || false,
        pedido_rescisao_indireta: processo.pedido_rescisao_indireta || false,
        pedido_reversao_pedido_demissao: processo.pedido_reversao_pedido_demissao || false,
        pedido_multas_clt: processo.pedido_multas_clt || "",
        pedido_multas_ccts: processo.pedido_multas_ccts || "",
        status_pedido: processo.status_pedido || "",
        motivo_encerramento: processo.motivo_encerramento || "",
        custo_encerramento: processo.custo_encerramento || "",
        categoria_importacao: processo.categoria_importacao || "",
      });
    }
  }, [processo, editando]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleIniciarEdicao = () => {
    setEditando(true);
  };

  const handleCancelarEdicao = () => {
    setEditando(false);
    setFormData({});
  };

  const handleSalvarEdicao = async () => {
    if (!processo) return;
    
    setSalvando(true);
    try {
      const updates: Record<string, any> = {};
      
      // Compare all fields and build update object
      const fieldsToCheck = [
        "numero", "assunto", "area", "status", "classe", "natureza", "materia", "fase", 
        "instancia", "justica", "esfera", "tribunal", "vara", "comarca", "uf",
        "polo_ativo", "polo_passivo", "terceiro_envolvido", "funcao_parte_contraria", 
        "cpf_cnpj_parte_contraria", "data_distribuicao", "data_recebimento", "data_citacao",
        "data_fato_gerador", "data_encerramento", "data_arquivamento", "tipo_pagamento",
        "forma_pagamento", "risco", "probabilidade", "resultado", "andamento_atual",
        "descricao", "observacoes_processo", "pedidos", "periodo_laborado",
        "unidade_cliente", "sigla_unidade", "pasta_cliente", "pasta_fisica",
        "tipo_controladora", "identificador_projuris", "responsaveis_projuris",
        // Campos contingenciais (Dra. Janaina)
        "ativo_passivo", "reclamante", "reclamados", "data_desligamento", 
        "responsabilidade_tipo", "data_consulta", "periodo_condenacao",
        "risco_anterior", "risco_atual", "adicao_baixa", "depositos_vinculados",
        "epoca_razao", "setor", "funcao", "advogado_externo", "pedido_valor", "justificativa_risco",
        // Campos MPT
        "localidade", "autor", "requerido", "materia_mpt", "ultimo_andamento_mpt", "observacao_advogado",
        // Campos de Pedidos
        "lei_13467_2017", "responsabilidade_subsidiaria", "pedido_intervalo_intrajornada",
        "pedido_domingos_feriados", "pedido_insalubridade_periculosidade", "pedido_diferencas_salariais",
        "pedido_adicional_noturno", "pedido_sobrecarga_trabalho", "pedido_reconhecimento_vinculo",
        "pedido_danos_morais_assedio", "pedido_danos_morais_outros", "pedido_acidente_doenca",
        "pedido_danos_morais_acidente", "pedido_estabilidade", "pedido_multas_clt", "pedido_multas_ccts",
        "status_pedido", "motivo_encerramento", "categoria_importacao"
      ];
      
      const numericFields = [
        "valor_causa", "valor_condenacao", "valor_provisionado", "provisionamento_provavel",
        "provisionamento_possivel", "provisionamento_remoto", "deposito_judicial",
        "valor_pago", "valor_pagamento",
        // Campos contingenciais numéricos
        "valor_perda_anterior", "valor_perda_atual", "responsabilidade_antes_data", "responsabilidade_apos_data",
        // Campos de Pedidos numéricos
        "custo_encerramento"
      ];
      
      const booleanFields = [
        "transitado_julgado", "mudanca_risco",
        // Campos de Pedidos booleanos
        "pedido_excesso_jornada", "pedido_plantoes_extras", "pedido_dobras", 
        "pedido_intervalo_interjornada", "pedido_descaract_jornada_12_36",
        "pedido_danos_materiais", "pedido_pensao_vitalicia", "pedido_limbo_previdenciario",
        "pedido_indenizacao_substitutiva", "pedido_reversao_justa_causa", 
        "pedido_rescisao_indireta", "pedido_reversao_pedido_demissao"
      ];
      
      fieldsToCheck.forEach((field) => {
        const newValue = formData[field] || null;
        const originalValue = processo[field as keyof typeof processo] || null;
        if (newValue !== originalValue) {
          updates[field] = newValue === "" ? null : newValue;
        }
      });
      
      numericFields.forEach((field) => {
        const newValue = formData[field] ? parseFloat(formData[field]) : null;
        const originalValue = processo[field as keyof typeof processo] || null;
        if (newValue !== originalValue) {
          updates[field] = newValue;
        }
      });
      
      // Handle boolean fields
      booleanFields.forEach((field) => {
        const processoValue = processo[field as keyof typeof processo];
        if (formData[field] !== processoValue) {
          updates[field] = formData[field];
        }
      });
      
      // Handle coordenacao_id
      if (formData.coordenacao_id !== (processo.coordenacao_id || "")) {
        updates.coordenacao_id = formData.coordenacao_id || null;
      }
      
      // Handle advogado_responsavel_id
      const advogadoValue = formData.advogado_responsavel_id === "__none__" ? null : formData.advogado_responsavel_id;
      if (advogadoValue !== (processo.advogado_responsavel_id || null)) {
        updates.advogado_responsavel_id = advogadoValue;
      }
      
      // Handle cliente_id
      const clienteValue = formData.cliente_id === "__none__" ? null : formData.cliente_id;
      if (clienteValue !== (processo.cliente_id || null)) {
        updates.cliente_id = clienteValue;
      }
      
      if (Object.keys(updates).length === 0) {
        toast({ title: "Nenhuma alteração detectada" });
        setEditando(false);
        setShowConfirmDialog(false);
        return;
      }
      
      const { error } = await supabase
        .from("processos")
        .update(updates)
        .eq("id", processo.id);
      
      if (error) throw error;
      
      toast({ title: "Processo atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["processo", id] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      setEditando(false);
      setShowConfirmDialog(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleAtualizarAndamentos = async () => {
    if (!processo) return;
    
    setAtualizando(true);
    try {
      const result = await buscarAndamentosExternos(processo.id, processo.numero);
      
      if (result.success) {
        toast({
          title: "Andamentos atualizados",
          description: `${result.movimentosInseridos} novo(s) andamento(s) importado(s).`,
        });
        refetchMovimentacoes();
      } else {
        toast({
          title: "Erro ao atualizar",
          description: result.error || "Não foi possível buscar os andamentos.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAtualizando(false);
    }
  };

  const handleToggleMonitoramento = async () => {
    if (!processo) return;
    
    setToglingMonitoramento(true);
    try {
      const newValue = !processo.monitorar_andamentos;
      const { error } = await supabase
        .from("processos")
        .update({ monitorar_andamentos: newValue })
        .eq("id", processo.id);
      
      if (error) throw error;
      
      toast({
        title: newValue ? "Monitoramento habilitado" : "Monitoramento desabilitado",
        description: newValue 
          ? "Os andamentos serão buscados automaticamente pelo monitoramento." 
          : "Os andamentos não serão buscados pelo monitoramento automático.",
      });
      queryClient.invalidateQueries({ queryKey: ["processo", id] });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setToglingMonitoramento(false);
    }
  };

  const handleToggleLida = async (publicacaoId: string, lidaAtual: boolean) => {
    setToglingLida(publicacaoId);
    try {
      const { error } = await supabase
        .from("publicacoes_djen_processos")
        .update({ lida: !lidaAtual })
        .eq("id", publicacaoId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo", id] });
      
      toast({
        title: !lidaAtual ? "Marcada como lida" : "Marcada como não lida",
        description: "Status da publicação atualizado",
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da publicação",
        variant: "destructive",
      });
    } finally {
      setToglingLida(null);
    }
  };

  // Handlers for audiências
  const handleMarcarAudienciaTratado = async (audienciaId: string) => {
    setUpdatingAudiencia(audienciaId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("audiencias_detectadas")
        .update({ 
          status: 'tratado',
          tratado_por: user?.id,
          tratado_em: new Date().toISOString()
        })
        .eq("id", audienciaId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["audiencias-processo", id, processo?.numero] });
      toast({
        title: "Audiência marcada como tratada",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingAudiencia(null);
    }
  };

  const handleIgnorarAudiencia = async (audienciaId: string) => {
    setUpdatingAudiencia(audienciaId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("audiencias_detectadas")
        .update({ 
          status: 'ignorado',
          tratado_por: user?.id,
          tratado_em: new Date().toISOString()
        })
        .eq("id", audienciaId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["audiencias-processo", id, processo?.numero] });
      toast({
        title: "Audiência ignorada",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingAudiencia(null);
    }
  };

  // Handlers for intimações
  const handleMarcarIntimacaoTratado = async (intimacaoId: string) => {
    setUpdatingIntimacao(intimacaoId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("intimacoes_detectadas")
        .update({ 
          status: 'tratado',
          tratado_por: user?.id,
          tratado_em: new Date().toISOString()
        })
        .eq("id", intimacaoId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["intimacoes-processo", id, processo?.numero] });
      toast({
        title: "Intimação marcada como tratada",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingIntimacao(null);
    }
  };

  const handleMarcarIntimacaoEmAndamento = async (intimacaoId: string) => {
    setUpdatingIntimacao(intimacaoId);
    try {
      const { error } = await supabase
        .from("intimacoes_detectadas")
        .update({ status: 'em_andamento' })
        .eq("id", intimacaoId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["intimacoes-processo", id, processo?.numero] });
      toast({
        title: "Intimação marcada como em andamento",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingIntimacao(null);
    }
  };

  const handleIgnorarIntimacao = async (intimacaoId: string) => {
    setUpdatingIntimacao(intimacaoId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("intimacoes_detectadas")
        .update({ 
          status: 'ignorado',
          tratado_por: user?.id,
          tratado_em: new Date().toISOString()
        })
        .eq("id", intimacaoId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["intimacoes-processo", id, processo?.numero] });
      toast({
        title: "Intimação ignorada",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingIntimacao(null);
    }
  };

  const handleCriarTarefaIntimacao = async (intimacao: any) => {
    let coordenacaoId = "";
    if (intimacao.processo_id) {
      const { data: processoData } = await supabase
        .from("processos")
        .select("coordenacao_id")
        .eq("id", intimacao.processo_id)
        .single();
      coordenacaoId = processoData?.coordenacao_id || "";
    }

    const params = new URLSearchParams({
      tipo_tarefa: "ANÁLISE",
      titulo: "ANALISAR INTIMAÇÃO",
      ...(intimacao.processo_id && { processo: intimacao.processo_id }),
      ...(coordenacaoId && { coordenacao: coordenacaoId }),
      ...(intimacao.descricao && { descricao: intimacao.descricao }),
    });

    navigate(`/nova-tarefa?${params.toString()}`);
  };

  // Status badge helpers
  const getAudienciaStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">⏳ Pendente</Badge>;
      case 'confirmado':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">✅ Confirmado</Badge>;
      case 'reagendado':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">🔄 Reagendado</Badge>;
      case 'tratado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">✔️ Tratado</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">❌ Cancelado</Badge>;
      case 'ignorado':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">🚫 Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getIntimacaoStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">⏳ Pendente</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">🔄 Em Andamento</Badge>;
      case 'tratado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">✔️ Tratado</Badge>;
      case 'ignorado':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">🚫 Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOrigemBadge = (origem: string | null) => {
    if (!origem) return null;
    if (origem === 'Manual') {
      return <Badge variant="secondary">Manual</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Detectado</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Field display/edit component
  const FieldItem = ({ label, value, field, type = "text", options }: { 
    label: string; 
    value: any; 
    field?: string; 
    type?: "text" | "textarea" | "date" | "number" | "select" | "boolean";
    options?: { value: string; label: string }[];
  }) => {
    if (!editando) {
      let displayValue = value;
      if (type === "date" && value) {
        displayValue = formatDate(value);
      } else if (type === "number" && value !== null && value !== undefined) {
        displayValue = formatCurrency(value);
      } else if (type === "boolean") {
        displayValue = value ? "Sim" : "Não";
      } else if (type === "select" && options) {
        displayValue = options.find(o => o.value === value)?.label || value || "—";
      }
      
      return (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-medium">{displayValue || "—"}</p>
        </div>
      );
    }
    
    // Editing mode
    if (!field) return null;
    
    if (type === "textarea") {
      return (
        <div className="space-y-1">
          <Label className="text-sm">{label}</Label>
          <Textarea 
            value={formData[field] || ""} 
            onChange={(e) => handleInputChange(field, e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      );
    }
    
    if (type === "select" && options) {
      return (
        <div className="space-y-1">
          <Label className="text-sm">{label}</Label>
          <Select value={formData[field] || ""} onValueChange={(v) => handleInputChange(field, v)}>
            <SelectTrigger>
              <SelectValue placeholder={`Selecione ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    
    if (type === "boolean") {
      return (
        <div className="space-y-1">
          <Label className="text-sm">{label}</Label>
          <Select 
            value={formData[field] ? "true" : "false"} 
            onValueChange={(v) => handleInputChange(field, v === "true")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        <Label className="text-sm">{label}</Label>
        <Input 
          type={type === "date" ? "date" : type === "number" ? "number" : "text"}
          value={formData[field] || ""} 
          onChange={(e) => handleInputChange(field, e.target.value)}
          step={type === "number" ? "0.01" : undefined}
        />
      </div>
    );
  };

  if (loadingProcesso) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!processo) {
    return (
      <MainLayout title="Processo não encontrado" subtitle="">
        <div className="text-center py-12">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Processo não encontrado</h3>
          <p className="text-muted-foreground mb-4">O processo solicitado não existe ou você não tem acesso.</p>
          <Button onClick={() => navigate("/processos")}>Voltar para Processos</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Detalhes do Processo"
      subtitle=""
    >
      <div className="space-y-6">
        {/* Back Button & Quick Actions */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/processos");
              }
            }} 
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex items-center gap-3">
            {/* Monitoramento Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30">
              {processo.monitorar_andamentos ? (
                <Bell className="w-4 h-4 text-green-600" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium hidden sm:inline">
                {processo.monitorar_andamentos ? "Monitoramento ativo" : "Monitoramento inativo"}
              </span>
              <Switch
                checked={processo.monitorar_andamentos ?? true}
                onCheckedChange={handleToggleMonitoramento}
                disabled={toglingMonitoramento}
              />
            </div>

            {editando ? (
              <>
                <Button variant="outline" onClick={handleCancelarEdicao} disabled={salvando}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={() => setShowConfirmDialog(true)} disabled={salvando}>
                  <Save className="w-4 h-4 mr-2" />
                  {salvando ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </>
            ) : (
              <Button onClick={handleIniciarEdicao}>
                <Edit className="w-4 h-4 mr-2" />
                Editar Processo
              </Button>
            )}
          </div>
        </div>

        {/* Hero Card - Número do Processo e Descrição */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="py-6">
            <div className="text-center space-y-3">
              {processo.pasta?.nome && (
                <p className="text-sm text-primary font-medium uppercase tracking-wider">
                  {processo.pasta.nome}
                </p>
              )}
              <div className="flex items-center justify-center gap-3">
                <Scale className="w-6 h-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-wide">
                  {processo.numero}
                </h2>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Badge className={`badge-area-${processo.area}`}>
                  {areaLabels[processo.area] || processo.area}
                </Badge>
                <Badge className={`badge-status-${processo.status}`}>
                  {statusLabels[processo.status] || processo.status}
                </Badge>
                {processo.monitorar_andamentos === false && (
                  <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30">
                    <BellOff className="w-3 h-3 mr-1" />
                    Monitoramento desativado
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de Eventos */}
        <Tabs value={activeTab} className="w-full">
          <TabsList className="grid w-full grid-cols-9 sm:w-auto sm:inline-flex">
              <TabsTrigger 
                value="audiencias" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "audiencias" ? "" : "audiencias");
                }}
              >
                <Gavel className="w-4 h-4" />
                <span className="hidden sm:inline">Audiências</span>
                {audiencias.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{audiencias.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="intimacoes" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "intimacoes" ? "" : "intimacoes");
                }}
              >
                <AlertCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Intimações</span>
                {intimacoes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{intimacoes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="tarefas" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "tarefas" ? "" : "tarefas");
                }}
              >
                <ListTodo className="w-4 h-4" />
                <span className="hidden sm:inline">Tarefas</span>
                {tarefas.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{tarefas.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="documentos" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "documentos" ? "" : "documentos");
                }}
              >
                <FileBox className="w-4 h-4" />
                <span className="hidden sm:inline">Pasta</span>
                {documentosProcesso.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{documentosProcesso.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="publicacoes" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "publicacoes" ? "" : "publicacoes");
                }}
              >
                <Newspaper className="w-4 h-4" />
                <span className="hidden sm:inline">Pub. DJEN</span>
                {publicacoesDjen.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{publicacoesDjen.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="andamentos" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "andamentos" ? "" : "andamentos");
                }}
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Andamentos</span>
                {movimentacoes && movimentacoes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{movimentacoes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="redistribuicoes" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "redistribuicoes" ? "" : "redistribuicoes");
                }}
              >
                <Shuffle className="w-4 h-4" />
                <span className="hidden sm:inline">Redistrib.</span>
                {redistribuicoes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{redistribuicoes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="monitoramento360" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "monitoramento360" ? "" : "monitoramento360");
                }}
              >
                <Radar className="w-4 h-4" />
                <span className="hidden sm:inline">360º</span>
                {alertas360.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{alertas360.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="agenda" 
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(prev => prev === "agenda" ? "" : "agenda");
                }}
              >
                <CalendarDays className="w-4 h-4" />
                <span className="hidden sm:inline">Agenda</span>
                {eventosAgenda.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{eventosAgenda.length}</Badge>
                )}
              </TabsTrigger>
          </TabsList>
            <TabsContent value="audiencias" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Gavel className="w-5 h-5" />
                    Audiências
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingAudiencias ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
                    </div>
                  ) : audiencias.length > 0 ? (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {audiencias.map((aud) => (
                          <Card key={aud.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                {/* Left side - Info */}
                                <div className="flex-1 space-y-2">
                                  {/* Status badges */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {getAudienciaStatusBadge(aud.status)}
                                    {getOrigemBadge(aud.origem)}
                                    {aud.tipo_audiencia && (
                                      <Badge variant="secondary">{aud.tipo_audiencia}</Badge>
                                    )}
                                  </div>

                                  {/* Date highlight */}
                                  <div className="flex items-center gap-4 text-sm flex-wrap">
                                    <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
                                      <Calendar className="h-5 w-5 text-primary" />
                                      <span className="font-bold text-primary text-lg">{formatDate(aud.data_audiencia)}</span>
                                      {(aud.hora_brasilia || aud.hora) && (
                                        <span className="text-muted-foreground">às {aud.hora_brasilia || aud.hora}</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Process info */}
                                  <div className="flex items-center gap-4 text-sm flex-wrap">
                                    {aud.processo_numero && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <FileText className="h-4 w-4" />
                                        <span className="font-mono">{aud.processo_numero}</span>
                                      </div>
                                    )}
                                    {(aud.vara_camara || aud.comarca) && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span>{[aud.vara_camara, aud.comarca].filter(Boolean).join(' - ')}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Client and Polo */}
                                  <div className="flex items-center gap-4 text-sm flex-wrap">
                                    {aud.cliente && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Building2 className="h-4 w-4" />
                                        <span className="truncate max-w-[250px]">{aud.cliente}</span>
                                      </div>
                                    )}
                                    {aud.polo_ativo && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <User className="h-4 w-4" />
                                        <span className="truncate max-w-[200px]">{aud.polo_ativo}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Description */}
                                  {aud.resumo_objeto && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {aud.resumo_objeto}
                                    </p>
                                  )}

                                  {/* Lawyer */}
                                  {aud.advogado && (
                                    <p className="text-xs text-muted-foreground">
                                      Advogado: <span className="font-medium text-foreground">{aud.advogado}</span>
                                    </p>
                                  )}
                                </div>

                                {/* Right side - Actions */}
                                <div className="flex gap-2 flex-wrap">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingAudiencia(aud as AudienciaDetectada)}
                                  >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Editar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedAudiencia(aud as AudienciaDetectada)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Detalhes
                                  </Button>
                                  
                                  {aud.status === 'pendente' && (
                                    <>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleMarcarAudienciaTratado(aud.id)}
                                        disabled={updatingAudiencia === aud.id}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Tratado
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleIgnorarAudiencia(aud.id)}
                                        disabled={updatingAudiencia === aud.id}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <Gavel className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhuma audiência registrada</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Intimações Tab */}
            <TabsContent value="intimacoes" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Intimações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingIntimacoes ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
                    </div>
                  ) : intimacoes.length > 0 ? (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {intimacoes.map((int) => {
                          // Calculate days until deadline
                          const getDaysUntil = (dateStr: string | null) => {
                            if (!dateStr) return null;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const target = new Date(dateStr);
                            target.setHours(0, 0, 0, 0);
                            return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          };
                          const daysUntil = getDaysUntil(int.data_limite);
                          const getUrgencyBadge = (days: number | null) => {
                            if (days === null) return null;
                            if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
                            if (days <= 3) return <Badge variant="destructive">Vence em {days} dias</Badge>;
                            if (days <= 7) return <Badge className="bg-yellow-500/80 text-white">Vence em {days} dias</Badge>;
                            return null;
                          };

                          return (
                            <Card key={int.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                  {/* Left side - Info */}
                                  <div className="flex-1 space-y-2">
                                    {/* Status badges */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {getIntimacaoStatusBadge(int.status)}
                                      {getOrigemBadge(int.origem)}
                                      {getUrgencyBadge(daysUntil)}
                                      {int.prioridade && (
                                        <Badge variant={int.prioridade === 'alta' ? 'destructive' : 'secondary'}>
                                          {int.prioridade}
                                        </Badge>
                                      )}
                                      {int.tipo_intimacao && (
                                        <Badge variant="secondary">{int.tipo_intimacao}</Badge>
                                      )}
                                    </div>

                                    {/* Deadline and dates */}
                                    <div className="flex items-center gap-4 text-sm flex-wrap">
                                      {int.data_limite && (
                                        <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-lg">
                                          <Clock className="h-5 w-5 text-destructive" />
                                          <span className="font-bold text-destructive text-lg">Prazo: {formatDate(int.data_limite)}</span>
                                        </div>
                                      )}
                                      {int.data_intimacao && (
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <Calendar className="h-4 w-4" />
                                          <span>Intimado em: {formatDate(int.data_intimacao)}</span>
                                        </div>
                                      )}
                                      {int.prazo_dias && (
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <Clock className="h-4 w-4" />
                                          <span>{int.prazo_dias} dias</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Órgão */}
                                    {int.orgao_intimante && (
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Building2 className="h-4 w-4" />
                                        <span>{int.orgao_intimante}</span>
                                      </div>
                                    )}

                                    {/* Description */}
                                    {int.descricao && (
                                      <p className="text-sm font-medium line-clamp-2">
                                        {int.descricao}
                                      </p>
                                    )}

                                    {/* Contexto preview */}
                                    {int.contexto && !int.descricao && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {int.contexto}
                                      </p>
                                    )}
                                  </div>

                                  {/* Right side - Actions */}
                                  <div className="flex gap-2 flex-wrap">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedIntimacao(int)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Detalhes
                                    </Button>

                                    {int.processo_id && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCriarTarefaIntimacao(int)}
                                      >
                                        <ClipboardList className="h-4 w-4 mr-1" />
                                        Criar Tarefa
                                      </Button>
                                    )}
                                    
                                    {int.status === 'pendente' && (
                                      <>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => handleMarcarIntimacaoEmAndamento(int.id)}
                                          disabled={updatingIntimacao === int.id}
                                        >
                                          <PlayCircle className="h-4 w-4 mr-1" />
                                          Iniciar
                                        </Button>
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => handleMarcarIntimacaoTratado(int.id)}
                                          disabled={updatingIntimacao === int.id}
                                        >
                                          <CheckCircle className="h-4 w-4 mr-1" />
                                          Tratado
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleIgnorarIntimacao(int.id)}
                                          disabled={updatingIntimacao === int.id}
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}

                                    {int.status === 'em_andamento' && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleMarcarIntimacaoTratado(int.id)}
                                        disabled={updatingIntimacao === int.id}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Concluir
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhuma intimação registrada</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Publicações DJEN Tab */}
            <TabsContent value="publicacoes" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Newspaper className="w-5 h-5" />
                    Publicações DJEN
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPublicacoes ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
                    </div>
                  ) : publicacoesDjen.length > 0 ? (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {publicacoesDjen.map((pub) => (
                          <div 
                            key={pub.id}
                            className={`p-5 border-2 rounded-xl transition-colors ${pub.lida ? 'bg-muted/30 border-muted' : 'bg-background border-primary/20 hover:border-primary/40'}`}
                          >
                            {/* Header */}
                            <div className="flex flex-col gap-3 mb-4 pb-3 border-b">
                              <div className="flex flex-wrap items-center gap-2">
                                {pub.lida ? (
                                  <Eye className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <EyeOff className="w-5 h-5 text-primary" />
                                )}
                                <Badge variant={pub.lida ? "secondary" : "default"} className="text-sm">
                                  {pub.lida ? "Lida" : "Não lida"}
                                </Badge>
                                {pub.fonte && (
                                  <Badge variant="outline" className="text-sm">{pub.fonte}</Badge>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                  <div>
                                    <span className="text-xs uppercase tracking-wide">Diário:</span>{" "}
                                    <span className="font-medium text-foreground">
                                      {pub.data_publicacao ? formatDate(pub.data_publicacao) : "Não informado"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs uppercase tracking-wide">Capturado:</span>{" "}
                                    <span>{formatDateTime(pub.data_encontrado)}</span>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleLida(pub.id, pub.lida)}
                                  disabled={toglingLida === pub.id}
                                  className="shrink-0 w-full sm:w-auto"
                                >
                                  {toglingLida === pub.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : pub.lida ? (
                                    <>
                                      <EyeOff className="w-4 h-4 mr-1" />
                                      Marcar não lida
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-4 h-4 mr-1" />
                                      Marcar lida
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Conteúdo */}
                            <div className="bg-muted/20 rounded-lg p-3 sm:p-4 overflow-hidden">
                              {pub.conteudo ? (
                                <div 
                                  className="text-sm text-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 break-words overflow-wrap-anywhere [&_*]:max-w-full [&_table]:table-fixed [&_table]:w-full [&_td]:break-words [&_th]:break-words"
                                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                  dangerouslySetInnerHTML={{ 
                                    __html: DOMPurify.sanitize(pub.conteudo, {
                                      ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
                                      ALLOWED_ATTR: ['class', 'style', 'href', 'target']
                                    })
                                  }} 
                                />
                              ) : (
                                <p className="text-sm text-muted-foreground">Conteúdo não disponível</p>
                              )}
                            </div>

                            {/* Metadados */}
                            <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                              <span>Publicado em: {formatDateTime(pub.created_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhuma publicação DJEN encontrada</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Andamentos Tab */}
            <TabsContent value="andamentos" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Andamentos
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAtualizarAndamentos}
                      disabled={atualizando}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${atualizando ? "animate-spin" : ""}`} />
                      {atualizando ? "Atualizando..." : "Atualizar da API"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingMovimentacoes ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                    </div>
                  ) : movimentacoes && movimentacoes.length > 0 ? (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {movimentacoes.map((mov) => {
                          const parts = mov.descricao.split(' - ');
                          const nomeMovimento = parts[0];
                          const complemento = parts.length > 1 ? parts.slice(1).join(' - ') : null;
                          
                          return (
                            <div 
                              key={mov.id}
                              className="p-5 border-2 rounded-xl hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <p className="font-semibold text-foreground">{nomeMovimento}</p>
                                    {mov.tipo && mov.tipo !== nomeMovimento && (
                                      <Badge variant="secondary" className="text-xs">
                                        {mov.tipo}
                                      </Badge>
                                    )}
                                    {mov.fonte && (
                                      <Badge variant="outline" className="text-xs">
                                        {mov.fonte}
                                      </Badge>
                                    )}
                                  </div>
                                  {complemento && (
                                    <p className="text-sm text-muted-foreground break-words">
                                      {complemento}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-medium flex items-center gap-2 justify-end text-primary">
                                    <Calendar className="w-4 h-4" />
                                    {formatDate(mov.data_movimentacao)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Registrado em: {formatDateTime(mov.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-4">Nenhum andamento registrado</p>
                      <Button variant="outline" onClick={handleAtualizarAndamentos} disabled={atualizando}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${atualizando ? "animate-spin" : ""}`} />
                        Buscar andamentos da API
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tarefas Tab */}
            <TabsContent value="tarefas" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ListTodo className="w-5 h-5" />
                      Tarefas
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/nova-tarefa?processo=${id}`)}
                    >
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Nova Tarefa
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTarefas ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                    </div>
                  ) : tarefas.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {tarefas.map((tarefa) => {
                          const isVencida = tarefa.data_vencimento && new Date(tarefa.data_vencimento) < new Date() && tarefa.status !== 'cumprido';
                          const isUrgente = tarefa.data_vencimento && !isVencida && 
                            (new Date(tarefa.data_vencimento).getTime() - new Date().getTime()) / (1000*60*60*24) <= 3;
                          
                          return (
                            <Card 
                              key={tarefa.id} 
                              className={`cursor-pointer hover:shadow-md transition-shadow ${
                                isVencida ? 'border-destructive/50 bg-destructive/5' : 
                                isUrgente ? 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20' : ''
                              }`}
                              onClick={() => navigate(`/nova-tarefa?tarefa=${tarefa.id}`)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <Badge variant={
                                        tarefa.status === 'cumprido' ? 'default' : 
                                        tarefa.status === 'atrasado' ? 'destructive' : 
                                        'secondary'
                                      }>
                                        {tarefa.status === 'cumprido' ? 'Cumprido' : 
                                         tarefa.status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                                      </Badge>
                                      {tarefa.prioridade && (
                                        <Badge variant={tarefa.prioridade === 'alta' || tarefa.prioridade === 'urgente' ? 'destructive' : 'outline'}>
                                          {tarefa.prioridade}
                                        </Badge>
                                      )}
                                      {isVencida && <Badge variant="destructive">Vencida</Badge>}
                                    </div>
                                    <p className="font-medium truncate">{tarefa.titulo}</p>
                                    {tarefa.descricao && (
                                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{tarefa.descricao}</p>
                                    )}
                                    {tarefa.responsavel && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        <User className="w-3 h-3 inline mr-1" />
                                        {tarefa.responsavel.nome}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    {tarefa.data_vencimento && (
                                      <p className={`font-medium flex items-center gap-1 justify-end ${isVencida ? 'text-destructive' : isUrgente ? 'text-yellow-600' : 'text-primary'}`}>
                                        <Clock className="w-4 h-4" />
                                        {formatDate(tarefa.data_vencimento)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <ListTodo className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-4">Nenhuma tarefa vinculada</p>
                      <Button variant="outline" onClick={() => navigate(`/nova-tarefa?processo=${id}`)}>
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Criar primeira tarefa
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Redistribuições Tab */}
            <TabsContent value="redistribuicoes" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shuffle className="w-5 h-5" />
                    Redistribuições
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingRedistribuicoes ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                    </div>
                  ) : redistribuicoes.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {redistribuicoes.map((red) => (
                          <Card key={red.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={red.status === 'pendente' ? 'secondary' : red.status === 'vinculado' ? 'default' : 'outline'}>
                                      {red.status}
                                    </Badge>
                                    {red.tribunal && <Badge variant="outline">{red.tribunal}</Badge>}
                                  </div>
                                  <p className="font-mono text-sm">{red.numero_processo}</p>
                                  {red.vara && (
                                    <p className="text-sm text-muted-foreground">
                                      <MapPin className="w-3 h-3 inline mr-1" />
                                      {red.vara}
                                    </p>
                                  )}
                                  {red.polo_ativo && (
                                    <p className="text-sm text-muted-foreground truncate">
                                      <User className="w-3 h-3 inline mr-1" />
                                      {red.polo_ativo}
                                    </p>
                                  )}
                                  {red.assunto && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">{red.assunto}</p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  {red.data_distribuicao && (
                                    <p className="font-medium flex items-center gap-1 justify-end text-primary">
                                      <Calendar className="w-4 h-4" />
                                      {formatDate(red.data_distribuicao)}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Detectado: {formatDate(red.created_at)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <Shuffle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhuma redistribuição detectada</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Monitoramento 360 Tab */}
            <TabsContent value="monitoramento360" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Radar className="w-5 h-5" />
                    Alertas Monitoramento 360º
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingAlertas360 ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                    </div>
                  ) : alertas360.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {alertas360.map((alerta) => {
                          const prioridadeColors: Record<string, string> = {
                            urgente: 'border-red-500 bg-red-50 dark:bg-red-950/30',
                            alta: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
                            media: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30',
                            baixa: '',
                          };
                          
                          return (
                            <Card 
                              key={alerta.id} 
                              className={`hover:shadow-md transition-shadow ${prioridadeColors[alerta.prioridade] || ''}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant={alerta.status === 'pendente' ? 'secondary' : alerta.status === 'tratado' ? 'default' : 'outline'}>
                                        {alerta.status}
                                      </Badge>
                                      <Badge variant={
                                        alerta.prioridade === 'urgente' || alerta.prioridade === 'alta' ? 'destructive' : 
                                        alerta.prioridade === 'media' ? 'secondary' : 'outline'
                                      }>
                                        {alerta.prioridade}
                                      </Badge>
                                      {alerta.termo?.categoria && (
                                        <Badge variant="outline">{alerta.termo.categoria}</Badge>
                                      )}
                                    </div>
                                    <p className="font-medium">
                                      <AlertTriangle className="w-4 h-4 inline mr-1 text-yellow-600" />
                                      Termo encontrado: <span className="text-primary">{alerta.termo_encontrado}</span>
                                    </p>
                                    {alerta.contexto && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">{alerta.contexto}</p>
                                    )}
                                    {alerta.movimentacao && (
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        <FileText className="w-3 h-3 inline mr-1" />
                                        {alerta.movimentacao.descricao}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-medium flex items-center gap-1 justify-end text-primary">
                                      <Calendar className="w-4 h-4" />
                                      {formatDate(alerta.created_at)}
                                    </p>
                                    {alerta.tratado_em && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Tratado: {formatDate(alerta.tratado_em)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhum alerta 360º para este processo</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Agenda Tab */}
            <TabsContent value="agenda" className="mt-4">
              <ProcessoAgendaTab processoId={id!} />
            </TabsContent>

            {/* Pasta / Documentos Tab */}
            <TabsContent value="documentos" className="mt-4">
              <ProcessoDocumentosTab 
                processoId={id!} 
                documentos={documentosProcesso} 
                refetchDocumentos={refetchDocumentos}
              />
            </TabsContent>
        </Tabs>

        {/* Coordenação e Advogado Responsável - Quick Info */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Coordenação</p>
                  <p className="font-medium">
                    {coordenacoes.find(c => c.id === processo.coordenacao_id)?.nome || "Não vinculado"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Advogado Responsável</p>
                  <p className="font-medium">
                    {processo.advogado_responsavel?.nome || "Não atribuído"}
                  </p>
                </div>
              </div>
              {processo.cliente && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{processo.cliente.nome}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" defaultValue={[]} className="space-y-4">
          {/* Informações Básicas */}
          <AccordionItem value="info-basicas" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                <span className="font-semibold">Informações Básicas</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Número do Processo" value={processo.numero} field="numero" />
                <FieldItem label="Assunto" value={processo.assunto} field="assunto" />
                <FieldItem 
                  label="Área" 
                  value={processo.area} 
                  field="area" 
                  type="select"
                  options={areaOptions.map(a => ({ value: a, label: areaLabels[a] }))}
                />
                <FieldItem 
                  label="Status" 
                  value={processo.status} 
                  field="status" 
                  type="select"
                  options={statusOptions.map(s => ({ value: s, label: statusLabels[s] }))}
                />
                <FieldItem label="Classe" value={processo.classe} field="classe" />
                <FieldItem label="Natureza" value={processo.natureza} field="natureza" />
                <FieldItem label="Matéria" value={processo.materia} field="materia" />
                <FieldItem label="Fase" value={processo.fase} field="fase" />
                <FieldItem label="Instância" value={processo.instancia} field="instancia" />
                <FieldItem label="Justiça" value={processo.justica} field="justica" />
                <FieldItem label="Esfera" value={processo.esfera} field="esfera" />
                <FieldItem label="Andamento Atual" value={processo.andamento_atual} field="andamento_atual" />
              </div>
              <div className="grid grid-cols-1 gap-4 mt-4">
                <FieldItem label="Descrição" value={processo.descricao} field="descricao" type="textarea" />
                <FieldItem label="Pedidos" value={processo.pedidos} field="pedidos" type="textarea" />
                <FieldItem label="Observações" value={processo.observacoes_processo} field="observacoes_processo" type="textarea" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Localização e Tribunal */}
          <AccordionItem value="localizacao" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                <span className="font-semibold">Localização e Tribunal</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Tribunal" value={processo.tribunal} field="tribunal" />
                <FieldItem label="Vara" value={processo.vara} field="vara" />
                <FieldItem label="Comarca" value={processo.comarca} field="comarca" />
                <FieldItem label="UF" value={processo.uf} field="uf" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Partes */}
          <AccordionItem value="partes" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span className="font-semibold">Partes do Processo</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <FieldItem label="Polo Ativo" value={processo.polo_ativo} field="polo_ativo" type="textarea" />
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <FieldItem label="Polo Passivo" value={processo.polo_passivo} field="polo_passivo" type="textarea" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <FieldItem label="Terceiro Envolvido" value={processo.terceiro_envolvido} field="terceiro_envolvido" />
                <FieldItem label="Função da Parte Contrária" value={processo.funcao_parte_contraria} field="funcao_parte_contraria" />
                <FieldItem label="CPF/CNPJ Parte Contrária" value={processo.cpf_cnpj_parte_contraria} field="cpf_cnpj_parte_contraria" />
                <FieldItem label="Período Laborado" value={processo.periodo_laborado} field="periodo_laborado" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Datas */}
          <AccordionItem value="datas" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span className="font-semibold">Datas</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Data de Distribuição" value={processo.data_distribuicao} field="data_distribuicao" type="date" />
                <FieldItem label="Data de Recebimento" value={processo.data_recebimento} field="data_recebimento" type="date" />
                <FieldItem label="Data de Citação" value={processo.data_citacao} field="data_citacao" type="date" />
                <FieldItem label="Data do Fato Gerador" value={processo.data_fato_gerador} field="data_fato_gerador" />
                <FieldItem label="Data de Encerramento" value={processo.data_encerramento} field="data_encerramento" type="date" />
                <FieldItem label="Data de Arquivamento" value={processo.data_arquivamento} field="data_arquivamento" type="date" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Valores e Financeiro */}
          <AccordionItem value="valores" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                <span className="font-semibold">Valores e Financeiro</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Valor da Causa" value={processo.valor_causa} field="valor_causa" type="number" />
                <FieldItem label="Valor da Condenação" value={processo.valor_condenacao} field="valor_condenacao" type="number" />
                <FieldItem label="Valor Provisionado" value={processo.valor_provisionado} field="valor_provisionado" type="number" />
                <FieldItem label="Provisionamento Provável" value={processo.provisionamento_provavel} field="provisionamento_provavel" type="number" />
                <FieldItem label="Provisionamento Possível" value={processo.provisionamento_possivel} field="provisionamento_possivel" type="number" />
                <FieldItem label="Provisionamento Remoto" value={processo.provisionamento_remoto} field="provisionamento_remoto" type="number" />
                <FieldItem label="Depósito Judicial" value={processo.deposito_judicial} field="deposito_judicial" type="number" />
                <FieldItem label="Valor Pago" value={processo.valor_pago} field="valor_pago" type="number" />
                <FieldItem label="Valor do Pagamento" value={processo.valor_pagamento} field="valor_pagamento" type="number" />
                <FieldItem label="Tipo de Pagamento" value={processo.tipo_pagamento} field="tipo_pagamento" />
                <FieldItem label="Forma de Pagamento" value={processo.forma_pagamento} field="forma_pagamento" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Risco e Resultado */}
          <AccordionItem value="risco" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                <span className="font-semibold">Risco e Resultado</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Risco" value={processo.risco} field="risco" />
                <FieldItem label="Probabilidade" value={processo.probabilidade} field="probabilidade" />
                <FieldItem label="Resultado" value={processo.resultado} field="resultado" />
                <FieldItem label="Transitado em Julgado" value={processo.transitado_julgado} field="transitado_julgado" type="boolean" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Atribuição */}
          <AccordionItem value="atribuicao" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5" />
                <span className="font-semibold">Atribuição e Responsáveis</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {editando ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-sm">Cliente</Label>
                      <Select value={formData.cliente_id || "__none__"} onValueChange={(v) => handleInputChange("cliente_id", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum cliente</SelectItem>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome} ({cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Coordenação</Label>
                      <Select 
                        value={formData.coordenacao_id || ""} 
                        onValueChange={(v) => {
                          handleInputChange("coordenacao_id", v);
                          handleInputChange("advogado_responsavel_id", "__none__");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a coordenação" />
                        </SelectTrigger>
                        <SelectContent>
                          {coordenacoes.map((coord) => (
                            <SelectItem key={coord.id} value={coord.id}>
                              {coord.nome} ({areaLabels[coord.area] || coord.area})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Advogado Responsável</Label>
                      <Select 
                        value={formData.advogado_responsavel_id || "__none__"} 
                        onValueChange={(v) => handleInputChange("advogado_responsavel_id", v)}
                        disabled={!formData.coordenacao_id && !processo.coordenacao_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !formData.coordenacao_id && !processo.coordenacao_id 
                              ? "Selecione coordenação primeiro" 
                              : "Selecione o advogado"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Não atribuído</SelectItem>
                          {membrosCoordenacao.map((membro) => (
                            <SelectItem key={membro.usuario_id} value={membro.usuario_id}>
                              {membro.profiles?.nome || "Usuário"} {membro.cargo ? `(${membro.cargo})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <FieldItem label="Cliente" value={processo.cliente?.nome} />
                    <FieldItem 
                      label="Coordenação" 
                      value={coordenacoes.find(c => c.id === processo.coordenacao_id)?.nome} 
                    />
                    <FieldItem label="Advogado Responsável" value={processo.advogado_responsavel?.nome} />
                  </>
                )}
                <FieldItem label="Responsáveis Projuris" value={processo.responsaveis_projuris} field="responsaveis_projuris" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Dados do Cliente / Unidade */}
          <AccordionItem value="unidade" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                <span className="font-semibold">Dados da Unidade / Cliente</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Unidade do Cliente" value={processo.unidade_cliente} field="unidade_cliente" />
                <FieldItem label="Sigla da Unidade" value={processo.sigla_unidade} field="sigla_unidade" />
                <FieldItem label="Pasta do Cliente" value={processo.pasta_cliente} field="pasta_cliente" />
                <FieldItem label="Pasta Física" value={processo.pasta_fisica} field="pasta_fisica" />
                <FieldItem label="Tipo Controladora" value={processo.tipo_controladora} field="tipo_controladora" />
                <FieldItem label="Identificador Projuris" value={processo.identificador_projuris} field="identificador_projuris" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Contingencial (Dra. Janaina) */}
          <AccordionItem value="contingencial" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Contingencial</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Ativo/Passivo" value={processo.ativo_passivo} field="ativo_passivo" />
                <FieldItem label="Reclamante" value={processo.reclamante} field="reclamante" />
                <FieldItem label="Reclamados" value={processo.reclamados} field="reclamados" />
                <FieldItem label="Função" value={processo.funcao} field="funcao" />
                <FieldItem label="Setor" value={processo.setor} field="setor" />
                <FieldItem label="Data do Desligamento" value={processo.data_desligamento} field="data_desligamento" type="date" />
                <FieldItem label="Data da Consulta" value={processo.data_consulta} field="data_consulta" type="date" />
                <FieldItem label="Responsabilidade" value={processo.responsabilidade_tipo} field="responsabilidade_tipo" />
                <FieldItem label="Período da Condenação" value={processo.periodo_condenacao} field="periodo_condenacao" />
                <FieldItem label="Pedido/Valor" value={processo.pedido_valor} field="pedido_valor" />
                <FieldItem label="Advogado Externo" value={processo.advogado_externo} field="advogado_externo" />
              </div>

              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Análise de Risco</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Risco Anterior" value={processo.risco_anterior} field="risco_anterior" />
                  <FieldItem label="Risco Atual" value={processo.risco_atual} field="risco_atual" />
                  <FieldItem label="Houve Mudança" value={processo.mudanca_risco} field="mudanca_risco" type="boolean" />
                  <FieldItem label="Valor Perda Anterior" value={processo.valor_perda_anterior} field="valor_perda_anterior" type="number" />
                  <FieldItem label="Valor Perda Atual" value={processo.valor_perda_atual} field="valor_perda_atual" type="number" />
                  <FieldItem label="Valor da Condenação" value={processo.valor_condenacao} field="valor_condenacao" type="number" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <FieldItem label="Justificativa do Risco" value={processo.justificativa_risco} field="justificativa_risco" type="textarea" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Responsabilidade por Período</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldItem label="Responsabilidade até Data" value={processo.responsabilidade_antes_data} field="responsabilidade_antes_data" type="number" />
                  <FieldItem label="Responsabilidade após Data" value={processo.responsabilidade_apos_data} field="responsabilidade_apos_data" type="number" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Outros Dados</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Adição/Baixa" value={processo.adicao_baixa} field="adicao_baixa" />
                  <FieldItem label="Depósitos Vinculados" value={processo.depositos_vinculados} field="depositos_vinculados" />
                  <FieldItem label="Época / Razão" value={processo.epoca_razao} field="epoca_razao" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Ministério Público do Trabalho (MPT) */}
          <AccordionItem value="mpt" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                <span className="font-semibold">Ministério Público do Trabalho</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldItem label="Procedimento (Número)" value={processo.numero} field="numero" />
                <FieldItem 
                  label="Status" 
                  value={processo.status} 
                  field="status" 
                  type="select"
                  options={statusOptions.map(s => ({ value: s, label: statusLabels[s] }))}
                />
                <FieldItem label="UF" value={processo.uf} field="uf" />
                <FieldItem label="Localidade" value={processo.localidade} field="localidade" />
                <FieldItem label="Autor" value={processo.autor} field="autor" />
                <FieldItem label="Requerido" value={processo.requerido} field="requerido" />
                <FieldItem label="Matéria MPT" value={processo.materia_mpt} field="materia_mpt" />
              </div>
              <div className="grid grid-cols-1 gap-4 mt-4">
                <FieldItem label="Último Andamento MPT" value={processo.ultimo_andamento_mpt} field="ultimo_andamento_mpt" type="textarea" />
                <FieldItem label="Observação Advogado" value={processo.observacao_advogado} field="observacao_advogado" type="textarea" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pedidos Trabalhistas */}
          <AccordionItem value="pedidos_trabalhistas" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span className="font-semibold">Pedidos Trabalhistas</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              {/* Contrato de Trabalho */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Contrato de Trabalho</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Lei 13.467/2017" value={processo.lei_13467_2017} field="lei_13467_2017" />
                  <FieldItem label="Responsabilidade Subsidiária" value={processo.responsabilidade_subsidiaria} field="responsabilidade_subsidiaria" />
                  <FieldItem label="Categoria de Importação" value={processo.categoria_importacao} field="categoria_importacao" />
                </div>
              </div>

              {/* Horas Extras */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Horas Extras</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Excesso de Jornada" value={processo.pedido_excesso_jornada} field="pedido_excesso_jornada" type="boolean" />
                  <FieldItem label="Plantões Extras" value={processo.pedido_plantoes_extras} field="pedido_plantoes_extras" type="boolean" />
                  <FieldItem label="Dobras" value={processo.pedido_dobras} field="pedido_dobras" type="boolean" />
                  <FieldItem label="Intervalo Intrajornada" value={processo.pedido_intervalo_intrajornada} field="pedido_intervalo_intrajornada" />
                  <FieldItem label="Intervalo Interjornada" value={processo.pedido_intervalo_interjornada} field="pedido_intervalo_interjornada" type="boolean" />
                  <FieldItem label="Descaract. Jornada 12/36" value={processo.pedido_descaract_jornada_12_36} field="pedido_descaract_jornada_12_36" type="boolean" />
                  <FieldItem label="Domingos/Feriados" value={processo.pedido_domingos_feriados} field="pedido_domingos_feriados" />
                </div>
              </div>

              {/* Adicionais e Benefícios */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Adicionais e Benefícios</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Insalubridade/Periculosidade" value={processo.pedido_insalubridade_periculosidade} field="pedido_insalubridade_periculosidade" />
                  <FieldItem label="Diferenças Salariais" value={processo.pedido_diferencas_salariais} field="pedido_diferencas_salariais" />
                  <FieldItem label="Adicional Noturno" value={processo.pedido_adicional_noturno} field="pedido_adicional_noturno" />
                  <FieldItem label="Sobrecarga de Trabalho" value={processo.pedido_sobrecarga_trabalho} field="pedido_sobrecarga_trabalho" />
                  <FieldItem label="Reconhecimento de Vínculo" value={processo.pedido_reconhecimento_vinculo} field="pedido_reconhecimento_vinculo" />
                </div>
              </div>

              {/* Danos Morais */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Danos Morais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Assédio" value={processo.pedido_danos_morais_assedio} field="pedido_danos_morais_assedio" />
                  <FieldItem label="Outros Danos Morais" value={processo.pedido_danos_morais_outros} field="pedido_danos_morais_outros" />
                </div>
              </div>

              {/* Acidente de Trabalho / Doença Ocupacional */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Acidente de Trabalho / Doença Ocupacional</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Acidente/Doença" value={processo.pedido_acidente_doenca} field="pedido_acidente_doenca" />
                  <FieldItem label="Danos Materiais" value={processo.pedido_danos_materiais} field="pedido_danos_materiais" type="boolean" />
                  <FieldItem label="Pensão Vitalícia" value={processo.pedido_pensao_vitalicia} field="pedido_pensao_vitalicia" type="boolean" />
                  <FieldItem label="Danos Morais (Acidente)" value={processo.pedido_danos_morais_acidente} field="pedido_danos_morais_acidente" />
                  <FieldItem label="Limbo Previdenciário" value={processo.pedido_limbo_previdenciario} field="pedido_limbo_previdenciario" type="boolean" />
                </div>
              </div>

              {/* Estabilidade e Justa Causa */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Estabilidade e Justa Causa</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Estabilidade" value={processo.pedido_estabilidade} field="pedido_estabilidade" />
                  <FieldItem label="Indenização Substitutiva" value={processo.pedido_indenizacao_substitutiva} field="pedido_indenizacao_substitutiva" type="boolean" />
                  <FieldItem label="Reversão Justa Causa" value={processo.pedido_reversao_justa_causa} field="pedido_reversao_justa_causa" type="boolean" />
                  <FieldItem label="Rescisão Indireta" value={processo.pedido_rescisao_indireta} field="pedido_rescisao_indireta" type="boolean" />
                  <FieldItem label="Reversão Pedido Demissão" value={processo.pedido_reversao_pedido_demissao} field="pedido_reversao_pedido_demissao" type="boolean" />
                </div>
              </div>

              {/* Multas */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Multas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Multas CLT" value={processo.pedido_multas_clt} field="pedido_multas_clt" />
                  <FieldItem label="Multas CCTs" value={processo.pedido_multas_ccts} field="pedido_multas_ccts" />
                </div>
              </div>

              {/* Status e Encerramento */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Status e Encerramento</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldItem label="Status do Pedido" value={processo.status_pedido} field="status_pedido" />
                  <FieldItem label="Motivo do Encerramento" value={processo.motivo_encerramento} field="motivo_encerramento" />
                  <FieldItem label="Custo do Encerramento" value={processo.custo_encerramento} field="custo_encerramento" type="number" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Metadados */}
          <AccordionItem value="metadados" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FileBox className="w-5 h-5" />
                <span className="font-semibold">Metadados do Sistema</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">ID do Processo</p>
                  <p className="font-mono text-sm">{processo.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Criado em</p>
                  <p className="font-medium">{formatDateTime(processo.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Atualizado em</p>
                  <p className="font-medium">{formatDateTime(processo.updated_at)}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja salvar as alterações realizadas no processo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSalvarEdicao} disabled={salvando}>
              {salvando ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Editar Audiência Dialog */}
      <EditarAudienciaDialog
        audiencia={editingAudiencia}
        open={!!editingAudiencia}
        onOpenChange={(open) => !open && setEditingAudiencia(null)}
      />

      {/* Detalhes Intimação Dialog */}
      <Dialog open={!!selectedIntimacao} onOpenChange={(open) => !open && setSelectedIntimacao(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Detalhes da Intimação
            </DialogTitle>
          </DialogHeader>
          {selectedIntimacao && (
            <div className="space-y-4">
              {/* Status e Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {getIntimacaoStatusBadge(selectedIntimacao.status)}
                {getOrigemBadge(selectedIntimacao.origem)}
                {selectedIntimacao.prioridade && (
                  <Badge variant={selectedIntimacao.prioridade === 'alta' ? 'destructive' : 'secondary'}>
                    {selectedIntimacao.prioridade}
                  </Badge>
                )}
                {selectedIntimacao.tipo_intimacao && (
                  <Badge variant="secondary">{selectedIntimacao.tipo_intimacao}</Badge>
                )}
              </div>

              {/* Informações principais */}
              <div className="grid gap-4">
                {selectedIntimacao.data_limite && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                    <Clock className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data Limite</p>
                      <p className="font-bold text-destructive">{formatDate(selectedIntimacao.data_limite)}</p>
                    </div>
                  </div>
                )}

                {selectedIntimacao.processo_numero && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Processo</p>
                    <p className="font-mono">{selectedIntimacao.processo_numero}</p>
                  </div>
                )}

                {selectedIntimacao.orgao_intimante && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Órgão Intimante</p>
                    <p>{selectedIntimacao.orgao_intimante}</p>
                  </div>
                )}

                {selectedIntimacao.prazo_dias && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Prazo</p>
                    <p>{selectedIntimacao.prazo_dias} dias</p>
                  </div>
                )}

                {selectedIntimacao.data_intimacao && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Data da Intimação</p>
                    <p>{formatDate(selectedIntimacao.data_intimacao)}</p>
                  </div>
                )}

                {selectedIntimacao.descricao && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm">{selectedIntimacao.descricao}</p>
                  </div>
                )}

                {selectedIntimacao.contexto && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Contexto</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedIntimacao.contexto}</p>
                  </div>
                )}

                {selectedIntimacao.conteudo_publicacao && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Conteúdo da Publicação</p>
                    <div className="p-3 bg-muted/50 rounded-lg max-h-60 overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap">{selectedIntimacao.conteudo_publicacao}</p>
                    </div>
                  </div>
                )}

                {selectedIntimacao.observacoes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{selectedIntimacao.observacoes}</p>
                  </div>
                )}

                {selectedIntimacao.providencias_tomadas && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Providências Tomadas</p>
                    <p className="text-sm">{selectedIntimacao.providencias_tomadas}</p>
                  </div>
                )}

                {selectedIntimacao.tratado_em && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tratado em</p>
                    <p className="text-sm">{formatDateTime(selectedIntimacao.tratado_em)}</p>
                  </div>
                )}
              </div>

              {/* Metadados */}
              <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
                <p>Criado em: {formatDateTime(selectedIntimacao.created_at)}</p>
                {selectedIntimacao.updated_at && (
                  <p>Atualizado em: {formatDateTime(selectedIntimacao.updated_at)}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
