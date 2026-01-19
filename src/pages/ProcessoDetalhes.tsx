import { useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
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
  CalendarDays,
  Globe
} from "lucide-react";
import { EditarAudienciaDialog } from "@/components/audiencias/EditarAudienciaDialog";
import { AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { ProcessoAgendaTab } from "@/components/processos/ProcessoAgendaTab";
import { ProcessoDocumentosTab } from "@/components/processos/ProcessoDocumentosTab";
import { ProcessoPortalTab } from "@/components/processos/ProcessoPortalTab";
import { SelecionarResponsaveisProcesso } from "@/components/processos/SelecionarResponsaveisProcesso";
import { TarefaPublicacaoView } from "@/components/processos/TarefaPublicacaoView";
import { ProcessoResumoCard } from "@/components/processos/ProcessoResumoCard";
import { ProcessoDetalhesCompletos } from "@/components/processos/ProcessoDetalhesCompletos";
import { ProcessoEditarCompleto } from "@/components/processos/ProcessoEditarCompleto";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Database } from "@/integrations/supabase/types";

type StatusProcesso = Database["public"]["Enums"]["status_processo"];
type AreaAtuacao = Database["public"]["Enums"]["area_atuacao"];

type ViewMode = "resumo" | "detalhes" | "editar";

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
  const [toglingMonitoramentoDjen, setToglingMonitoramentoDjen] = useState(false);
  const [toglingLida, setToglingLida] = useState<string | null>(null);
  
  // View mode state - estilo Projuris
  const [viewMode, setViewMode] = useState<ViewMode>("resumo");
  
  // States for audiências and intimações actions
  const [selectedAudiencia, setSelectedAudiencia] = useState<AudienciaDetectada | null>(null);
  const [editingAudiencia, setEditingAudiencia] = useState<AudienciaDetectada | null>(null);
  const [selectedIntimacao, setSelectedIntimacao] = useState<any>(null);
  const [updatingAudiencia, setUpdatingAudiencia] = useState<string | null>(null);
  const [updatingIntimacao, setUpdatingIntimacao] = useState<string | null>(null);
  
  // State for tarefa-publicação inline view
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  
  // Tab toggle state
  const [activeTab, setActiveTab] = useState<string>("");
  
  // Form state for all fields
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const [responsaveisLoaded, setResponsaveisLoaded] = useState(false);

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

  // Audiências query
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

  // Intimações query
  const { data: intimacoes = [], isLoading: loadingIntimacoes } = useQuery({
    queryKey: ["intimacoes-processo", id, processo?.numero],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes_detectadas")
        .select("*")
        .or(`processo_id.eq.${id},processo_numero.eq.${processo?.numero}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!processo?.numero,
  });

  // Tarefas query
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          *,
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `)
        .eq("processo_id", id!)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Documentos query
  const { data: documentosProcesso = [], refetch: refetchDocumentos } = useQuery({
    queryKey: ["documentos-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("processo_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Publicações DJEN query
  const { data: publicacoesDjen = [], isLoading: loadingPublicacoes } = useQuery({
    queryKey: ["publicacoes-djen-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publicacoes_djen_processos")
        .select("*")
        .eq("processo_id", id!)
        .order("data_publicacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Movimentações query
  const { data: movimentacoes = [], isLoading: loadingMovimentacoes, refetch: refetchMovimentacoes } = useQuery({
    queryKey: ["movimentacoes-processo", id],
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

  // Redistribuições query - movimentações com redistribuição
  const { data: redistribuicoes = [], isLoading: loadingRedistribuicoes } = useQuery({
    queryKey: ["redistribuicoes-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("processo_id", id!)
        .ilike("descricao", "%redistribui%")
        .order("data_movimentacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Alertas 360 query
  const { data: alertas360 = [], isLoading: loadingAlertas360 } = useQuery({
    queryKey: ["alertas360-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_monitoramento")
        .select(`
          *,
          termo:termos_monitoramento(*),
          movimentacao:movimentacoes(*)
        `)
        .eq("processo_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Eventos Agenda query
  const { data: eventosAgenda = [] } = useQuery({
    queryKey: ["eventos-agenda-processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_agenda")
        .select("*")
        .eq("processo_id", id!)
        .order("data_inicio", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Coordenações query
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("*")
        .order("nome");

      if (error) throw error;
      return data || [];
    },
  });

  // Clientes query
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nome");

      if (error) throw error;
      return data || [];
    },
  });

  // Responsáveis do processo
  const { data: responsaveisProcesso = [] } = useQuery({
    queryKey: ["processo-responsaveis", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_responsaveis")
        .select(`
          *,
          usuario:profiles!processos_responsaveis_usuario_id_fkey(id, nome)
        `)
        .eq("processo_id", id!);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Derive responsáveis text
  const responsaveisTexto = responsaveisProcesso.length > 0
    ? responsaveisProcesso.map((r: any) => r.usuario?.nome || "").filter(Boolean).join(", ")
    : processo?.advogado_responsavel?.nome || "Não atribuído";

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
        // Campos administrativos
        auto_infracao: processo.auto_infracao || "",
        nit_fiscalizado: processo.nit_fiscalizado || "",
        cnpj_fiscalizado: processo.cnpj_fiscalizado || "",
        valor_multa: processo.valor_multa || "",
        data_lavratura: processo.data_lavratura || "",
        fiscal_responsavel: processo.fiscal_responsavel || "",
        orgao_origem: processo.orgao_origem || "",
        data_situacao: processo.data_situacao || "",
        cargo_reconhecimento_vinculo: processo.cargo_reconhecimento_vinculo || "",
        tipo_processo: processo.tipo_processo || "judicial",
      });
    }
  }, [processo, editando]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleIniciarEdicao = () => {
    setResponsaveis([]);
    setResponsaveisLoaded(false);
    setEditando(true);
  };

  const handleCancelarEdicao = () => {
    setEditando(false);
    setFormData({});
    setResponsaveis([]);
    setResponsaveisLoaded(false);
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
        "status_pedido", "motivo_encerramento", "categoria_importacao",
        // Campos administrativos
        "auto_infracao", "nit_fiscalizado", "cnpj_fiscalizado", "fiscal_responsavel",
        "orgao_origem", "data_situacao", "cargo_reconhecimento_vinculo", "tipo_processo"
      ];
      
      const numericFields = [
        "valor_causa", "valor_condenacao", "valor_provisionado", "provisionamento_provavel",
        "provisionamento_possivel", "provisionamento_remoto", "deposito_judicial",
        "valor_pago", "valor_pagamento",
        // Campos contingenciais numéricos
        "valor_perda_anterior", "valor_perda_atual", "responsabilidade_antes_data", "responsabilidade_apos_data",
        // Campos de Pedidos numéricos
        "custo_encerramento",
        // Campos administrativos numéricos
        "valor_multa"
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

      // Handle cliente_id
      const clienteValue = formData.cliente_id === "__none__" ? null : formData.cliente_id;
      if (clienteValue !== (processo.cliente_id || null)) {
        updates.cliente_id = clienteValue;
      }

      // Responsáveis (multi) + campo legado advogado_responsavel_id (primeiro responsável)
      const shouldSyncResponsaveis = responsaveisLoaded;
      if (shouldSyncResponsaveis) {
        const primaryUsuarioId =
          responsaveis.find((r) => r.papel === "responsavel")?.usuario_id ??
          responsaveis[0]?.usuario_id ??
          null;

        if (primaryUsuarioId !== (processo.advogado_responsavel_id || null)) {
          updates.advogado_responsavel_id = primaryUsuarioId;
        }
      } else {
        // fallback para o campo antigo (caso o componente ainda não tenha carregado)
        const advogadoValue =
          formData.advogado_responsavel_id === "__none__" ? null : formData.advogado_responsavel_id;
        if (advogadoValue !== (processo.advogado_responsavel_id || null)) {
          updates.advogado_responsavel_id = advogadoValue;
        }
      }

      if (Object.keys(updates).length === 0 && !shouldSyncResponsaveis) {
        toast({ title: "Nenhuma alteração detectada" });
        setEditando(false);
        setShowConfirmDialog(false);
        return;
      }
      
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("processos")
          .update(updates)
          .eq("id", processo.id);

        if (error) throw error;
      }

      if (responsaveisLoaded) {
        const { error: delError } = await supabase
          .from("processos_responsaveis")
          .delete()
          .eq("processo_id", processo.id);

        if (delError) throw delError;

        if (responsaveis.length > 0) {
          const { error: respError } = await supabase.from("processos_responsaveis").insert(
            responsaveis.map((r) => ({
              processo_id: processo.id,
              usuario_id: r.usuario_id,
              coordenacao_id: r.coordenacao_id ?? null,
              papel: r.papel || "responsavel",
            }))
          );

          if (respError) throw respError;
        }
      }

      toast({ title: "Processo atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["processo", id] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      queryClient.invalidateQueries({ queryKey: ["processo-responsaveis", id] });
      queryClient.invalidateQueries({ queryKey: ["processos-responsaveis", processo.id] });
      setEditando(false);
      setShowConfirmDialog(false);
      setViewMode("detalhes");
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
        title: newValue ? "Monitoramento de andamentos habilitado" : "Monitoramento de andamentos desabilitado",
        description: newValue 
          ? "Os andamentos serão buscados automaticamente." 
          : "Os andamentos não serão buscados automaticamente.",
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

  const handleToggleMonitoramentoDjen = async () => {
    if (!processo) return;
    
    setToglingMonitoramentoDjen(true);
    try {
      const newValue = !(processo as any).monitorar_djen;
      const { error } = await supabase
        .from("processos")
        .update({ monitorar_djen: newValue })
        .eq("id", processo.id);
      
      if (error) throw error;
      
      toast({
        title: newValue ? "Monitoramento DJEN habilitado" : "Monitoramento DJEN desabilitado",
        description: newValue 
          ? "O DJEN será monitorado automaticamente para este processo." 
          : "O DJEN não será monitorado para este processo.",
      });
      queryClient.invalidateQueries({ queryKey: ["processo", id] });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setToglingMonitoramentoDjen(false);
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

  // Componente de responsáveis para passar aos cards
  const responsaveisParaCards = responsaveisProcesso.map((r: any) => ({
    id: r.usuario?.id || r.id,
    nome: r.usuario?.nome || "Desconhecido"
  }));

  // Componente de tabs reutilizável
  const renderTabs = () => (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="grid w-full grid-cols-5 sm:w-auto sm:inline-flex gap-1 h-auto flex-wrap">
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
        <TabsTrigger 
          value="portal" 
          className="gap-1.5"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab(prev => prev === "portal" ? "" : "portal");
          }}
        >
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">Portal</span>
        </TabsTrigger>
      </TabsList>

      {/* Tab Contents - Audiências */}
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
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getAudienciaStatusBadge(aud.status)}
                              {getOrigemBadge(aud.origem)}
                              {aud.tipo_audiencia && (
                                <Badge variant="secondary">{aud.tipo_audiencia}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
                                <Calendar className="h-5 w-5 text-primary" />
                                <span className="font-bold text-primary text-lg">{formatDate(aud.data_audiencia)}</span>
                                {(aud.hora_brasilia || aud.hora) && (
                                  <span className="text-muted-foreground">às {aud.hora_brasilia || aud.hora}</span>
                                )}
                              </div>
                            </div>
                            {aud.resumo_objeto && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{aud.resumo_objeto}</p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => setEditingAudiencia(aud as AudienciaDetectada)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setSelectedAudiencia(aud as AudienciaDetectada)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Detalhes
                            </Button>
                            {aud.status === 'pendente' && (
                              <>
                                <Button variant="default" size="sm" onClick={() => handleMarcarAudienciaTratado(aud.id)} disabled={updatingAudiencia === aud.id}>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Tratado
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleIgnorarAudiencia(aud.id)} disabled={updatingAudiencia === aud.id}>
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

      {/* Tab Contents - Intimações */}
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
                  {intimacoes.map((int) => (
                    <Card key={int.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getIntimacaoStatusBadge(int.status)}
                              {getOrigemBadge(int.origem)}
                            </div>
                            {int.data_limite && (
                              <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-lg w-fit">
                                <Clock className="h-5 w-5 text-destructive" />
                                <span className="font-bold text-destructive">Prazo: {formatDate(int.data_limite)}</span>
                              </div>
                            )}
                            {int.descricao && <p className="text-sm font-medium line-clamp-2">{int.descricao}</p>}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => setSelectedIntimacao(int)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Detalhes
                            </Button>
                            {int.status === 'pendente' && (
                              <>
                                <Button variant="default" size="sm" onClick={() => handleMarcarIntimacaoTratado(int.id)} disabled={updatingIntimacao === int.id}>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Tratado
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleCriarTarefaIntimacao(int)}>
                                  <ClipboardList className="h-4 w-4 mr-1" />
                                  Criar Tarefa
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
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma intimação registrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Contents - Tarefas */}
      <TabsContent value="tarefas" className="mt-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="w-5 h-5" />
              Tarefas
            </CardTitle>
            <Button size="sm" onClick={() => navigate(`/nova-tarefa?processo_id=${id}`)}>
              + Nova Tarefa
            </Button>
          </CardHeader>
          <CardContent>
            {loadingTarefas ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : selectedTarefaId ? (
              <TarefaPublicacaoView 
                tarefaId={selectedTarefaId}
                processoId={id!}
                onVoltar={() => setSelectedTarefaId(null)}
              />
            ) : tarefas.length > 0 ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {tarefas.map((tarefa) => (
                    <Card 
                      key={tarefa.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedTarefaId(tarefa.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <p className="font-medium">{tarefa.titulo}</p>
                            {tarefa.descricao && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{tarefa.descricao}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {tarefa.data_vencimento && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(tarefa.data_vencimento)}
                                </span>
                              )}
                              {tarefa.responsavel?.nome && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {tarefa.responsavel.nome}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant={tarefa.status === 'cumprido' ? 'default' : 'secondary'}>
                            {tarefa.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <ListTodo className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma tarefa registrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Contents - Documentos */}
      <TabsContent value="documentos" className="mt-4">
        <ProcessoDocumentosTab 
          processoId={id!}
          documentos={documentosProcesso}
          refetchDocumentos={refetchDocumentos}
        />
      </TabsContent>

      {/* Tab Contents - Publicações DJEN */}
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
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
              </div>
            ) : publicacoesDjen.length > 0 ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {publicacoesDjen.map((pub: any) => (
                    <Card key={pub.id} className={`transition-all ${pub.lida ? 'opacity-70' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={pub.lida ? 'secondary' : 'default'}>
                                {pub.lida ? 'Lida' : 'Não lida'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(pub.data_publicacao)}</span>
                            </div>
                            <p className="text-sm line-clamp-3">{pub.conteudo}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleToggleLida(pub.id, pub.lida)}
                            disabled={toglingLida === pub.id}
                          >
                            {pub.lida ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma publicação DJEN</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Contents - Andamentos */}
      <TabsContent value="andamentos" className="mt-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Andamentos
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleAtualizarAndamentos} disabled={atualizando}>
              <RefreshCw className={`h-4 w-4 mr-2 ${atualizando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {loadingMovimentacoes ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : movimentacoes.length > 0 ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {movimentacoes.map((mov) => (
                    <div key={mov.id} className="border-l-2 border-primary/30 pl-4 py-2">
                      <p className="text-xs text-muted-foreground">{formatDate(mov.data_movimentacao)}</p>
                      <p className="text-sm">{mov.descricao}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum andamento registrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Contents - Redistribuições */}
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
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : redistribuicoes.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {redistribuicoes.map((red) => (
                    <div key={red.id} className="border-l-2 border-amber-500/50 pl-4 py-2">
                      <p className="text-xs text-muted-foreground">{formatDate(red.data_movimentacao)}</p>
                      <p className="text-sm">{red.descricao}</p>
                    </div>
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

      {/* Tab Contents - Monitoramento 360 */}
      <TabsContent value="monitoramento360" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Radar className="w-5 h-5" />
              Alertas 360º
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
                  {alertas360.map((alerta: any) => (
                    <Card key={alerta.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={alerta.prioridade === 'urgente' ? 'destructive' : 'secondary'}>
                                {alerta.prioridade}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(alerta.created_at)}</span>
                            </div>
                            <p className="font-medium">{alerta.termo_encontrado}</p>
                            {alerta.contexto && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{alerta.contexto}</p>
                            )}
                          </div>
                          <Badge variant={alerta.status === 'tratado' ? 'default' : 'outline'}>
                            {alerta.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum alerta 360º</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Contents - Agenda */}
      <TabsContent value="agenda" className="mt-4">
        <ProcessoAgendaTab processoId={id!} />
      </TabsContent>

      {/* Tab Contents - Portal */}
      <TabsContent value="portal" className="mt-4">
        <ProcessoPortalTab processoId={id!} processoNumero={processo.numero} tribunal={processo.tribunal} />
      </TabsContent>
    </Tabs>
  );

  // Items da navegação lateral para modo resumo
  const navItems = [
    { id: "audiencias", label: "Audiências", icon: Gavel, count: audiencias.length },
    { id: "intimacoes", label: "Intimações", icon: AlertCircle, count: intimacoes.length },
    { id: "tarefas", label: "Tarefas", icon: ListTodo, count: tarefas.length },
    { id: "documentos", label: "Pasta", icon: FileBox, count: documentosProcesso.length },
    { id: "publicacoes", label: "Pub. DJEN", icon: Newspaper, count: publicacoesDjen.length },
    { id: "andamentos", label: "Andamentos", icon: FileText, count: movimentacoes.length },
    { id: "redistribuicoes", label: "Redistrib.", icon: Shuffle, count: redistribuicoes.length },
    { id: "monitoramento360", label: "360º", icon: Radar, count: alertas360.length },
    { id: "agenda", label: "Agenda", icon: CalendarDays, count: eventosAgenda.length },
    { id: "portal", label: "Portal", icon: Globe },
  ];

  // Função para renderizar conteúdo da aba selecionada
  const renderActiveTabContent = () => {
    if (!activeTab) return null;

    switch (activeTab) {
      case "audiencias":
        return (
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
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getAudienciaStatusBadge(aud.status)}
                                {getOrigemBadge(aud.origem)}
                                {aud.tipo_audiencia && (
                                  <Badge variant="secondary">{aud.tipo_audiencia}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm flex-wrap">
                                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
                                  <Calendar className="h-5 w-5 text-primary" />
                                  <span className="font-bold text-primary text-lg">{formatDate(aud.data_audiencia)}</span>
                                  {(aud.hora_brasilia || aud.hora) && (
                                    <span className="text-muted-foreground">às {aud.hora_brasilia || aud.hora}</span>
                                  )}
                                </div>
                              </div>
                              {aud.resumo_objeto && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{aud.resumo_objeto}</p>
                              )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => setEditingAudiencia(aud as AudienciaDetectada)}>
                                <Pencil className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setSelectedAudiencia(aud as AudienciaDetectada)}>
                                <Eye className="h-4 w-4 mr-1" />
                                Detalhes
                              </Button>
                              {aud.status === 'pendente' && (
                                <>
                                  <Button variant="default" size="sm" onClick={() => handleMarcarAudienciaTratado(aud.id)} disabled={updatingAudiencia === aud.id}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Tratado
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleIgnorarAudiencia(aud.id)} disabled={updatingAudiencia === aud.id}>
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
        );

      case "intimacoes":
        return (
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
                    {intimacoes.map((int) => (
                      <Card key={int.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getIntimacaoStatusBadge(int.status)}
                                {getOrigemBadge(int.origem)}
                              </div>
                              {int.data_limite && (
                                <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-lg w-fit">
                                  <Clock className="h-5 w-5 text-destructive" />
                                  <span className="font-bold text-destructive">Prazo: {formatDate(int.data_limite)}</span>
                                </div>
                              )}
                              {int.descricao && <p className="text-sm font-medium line-clamp-2">{int.descricao}</p>}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => setSelectedIntimacao(int)}>
                                <Eye className="h-4 w-4 mr-1" />
                                Detalhes
                              </Button>
                              {int.status === 'pendente' && (
                                <>
                                  <Button variant="default" size="sm" onClick={() => handleMarcarIntimacaoTratado(int.id)} disabled={updatingIntimacao === int.id}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Tratado
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleCriarTarefaIntimacao(int)}>
                                    <ClipboardList className="h-4 w-4 mr-1" />
                                    Criar Tarefa
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
                  <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma intimação registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "tarefas":
        return (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="w-5 h-5" />
                Tarefas
              </CardTitle>
              <Button size="sm" onClick={() => navigate(`/nova-tarefa?processo_id=${id}`)}>
                + Nova Tarefa
              </Button>
            </CardHeader>
            <CardContent>
              {loadingTarefas ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
              ) : selectedTarefaId ? (
                <TarefaPublicacaoView 
                  tarefaId={selectedTarefaId}
                  processoId={id!}
                  onVoltar={() => setSelectedTarefaId(null)}
                />
              ) : tarefas.length > 0 ? (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {tarefas.map((tarefa: any) => (
                      <Card 
                        key={tarefa.id} 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedTarefaId(tarefa.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={tarefa.status === 'concluida' ? 'default' : tarefa.status === 'em_andamento' ? 'secondary' : 'outline'}>
                                  {tarefa.status === 'concluida' ? 'Concluída' : tarefa.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                                </Badge>
                                {tarefa.prioridade === 'urgente' && <Badge variant="destructive">Urgente</Badge>}
                              </div>
                              <p className="font-medium">{tarefa.titulo}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {tarefa.data_vencimento && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(tarefa.data_vencimento)}
                                  </span>
                                )}
                                {tarefa.responsavel?.nome && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {tarefa.responsavel.nome}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTarefaId(tarefa.id); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <ListTodo className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma tarefa registrada</p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate(`/nova-tarefa?processo_id=${id}`)}>
                    Criar primeira tarefa
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "documentos":
        return <ProcessoDocumentosTab processoId={id!} documentos={documentosProcesso} refetchDocumentos={refetchDocumentos} />;

      case "publicacoes":
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                Publicações DJEN
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPublicacoes ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
              ) : publicacoesDjen.length > 0 ? (
                <ScrollArea className="h-[400px] pr-4">
                  <Accordion type="single" collapsible className="space-y-2">
                    {publicacoesDjen.map((pub: any, idx: number) => (
                      <AccordionItem key={pub.id} value={pub.id} className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-4 h-4 text-primary" />
                              <span className="font-medium">{formatDate(pub.data_publicacao)}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">{pub.tribunal || 'DJEN'}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className={`text-sm ${conteudoDisplayClasses}`}>
                              {formatConteudoParaExibicao(pub.conteudo)}
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma publicação DJEN</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "andamentos":
        return (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Andamentos
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  setAtualizando(true);
                  try {
                    await buscarAndamentosExternos(id!, processo.numero);
                    refetchMovimentacoes();
                    toast({ title: "Andamentos atualizados" });
                  } catch (err) {
                    toast({ title: "Erro ao atualizar", variant: "destructive" });
                  } finally {
                    setAtualizando(false);
                  }
                }}
                disabled={atualizando}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${atualizando ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {loadingMovimentacoes ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : movimentacoes && movimentacoes.length > 0 ? (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {movimentacoes.map((mov: any, idx: number) => (
                      <div key={mov.id} className="flex gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 bg-primary rounded-full" />
                          {idx < movimentacoes.length - 1 && <div className="w-0.5 flex-1 bg-border mt-2" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">{formatDate(mov.data_movimentacao)}</span>
                            {mov.fonte && <Badge variant="outline" className="text-[10px]">{mov.fonte}</Badge>}
                          </div>
                          <p className="text-sm">{mov.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum andamento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "redistribuicoes":
        return (
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
                    {redistribuicoes.map((red: any) => (
                      <Card key={red.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground">{formatDate(red.data_movimentacao)}</span>
                              <p className="text-sm">{red.descricao}</p>
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
                  <p className="text-muted-foreground">Nenhuma redistribuição registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "monitoramento360":
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Radar className="w-5 h-5" />
                Monitoramento 360º
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
                    {alertas360.map((alerta: any) => (
                      <Card key={alerta.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={alerta.prioridade === 'urgente' ? 'destructive' : 'secondary'}>
                                  {alerta.prioridade}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatDate(alerta.created_at)}</span>
                              </div>
                              <p className="font-medium">{alerta.termo_encontrado}</p>
                              {alerta.contexto && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{alerta.contexto}</p>
                              )}
                            </div>
                            <Badge variant={alerta.status === 'tratado' ? 'default' : 'outline'}>
                              {alerta.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum alerta 360º</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "agenda":
        return <ProcessoAgendaTab processoId={id!} />;

      case "portal":
        return <ProcessoPortalTab processoId={id!} processoNumero={processo.numero} tribunal={processo.tribunal} />;

      default:
        return null;
    }
  };

  // View mode: resumo (Projuris style) - Com sidebar vertical igual ao modo detalhes
  if (viewMode === "resumo") {
    return (
      <MainLayout title="" subtitle="">
        <div className="flex flex-col min-h-screen">
          {/* Header com botão voltar */}
          <div className="px-2 sm:px-4 lg:px-6 py-2 border-b">
            <Button 
              variant="ghost" 
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/processos");
                }
              }} 
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>

          {/* Layout principal: Sidebar + Conteúdo */}
          <div className="flex flex-col sm:flex-row flex-1 min-w-0">
            {/* Sidebar Navigation - Vertical igual ao ProcessoDetalhesCompletos */}
            <aside className="w-full sm:w-36 md:w-44 border-b sm:border-b-0 sm:border-r bg-muted/20 flex-shrink-0">
              {/* Mobile: horizontal scroll */}
              <div className="sm:hidden overflow-x-auto pb-1">
                <nav className="flex gap-1 px-2 py-2 min-w-max">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(prev => prev === item.id ? "" : item.id)}
                      className={`flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-md whitespace-nowrap transition-colors ${
                        activeTab === item.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="w-3 h-3 flex-shrink-0" />
                      <span>{item.label}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <Badge variant="secondary" className="ml-1 text-[8px] h-3.5 px-1 min-w-[14px] flex items-center justify-center bg-background/80">
                          {item.count}
                        </Badge>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
              {/* Desktop: vertical sidebar */}
              <ScrollArea className="hidden sm:block h-[calc(100vh-140px)]">
                <nav className="py-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(prev => prev === item.id ? "" : item.id)}
                      className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-left transition-colors ${
                        activeTab === item.id
                          ? "bg-primary/10 text-primary border-r-2 border-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1 min-w-[16px] flex items-center justify-center">
                          {item.count}
                        </Badge>
                      )}
                    </button>
                  ))}
                </nav>
              </ScrollArea>
            </aside>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <ScrollArea className="h-[calc(100vh-140px)]">
                <div className="p-3 sm:p-4 space-y-4">
                  {/* Resumo do Processo */}
                  <ProcessoResumoCard 
                    processo={processo}
                    responsaveis={responsaveisParaCards}
                    onMaisInformacoes={() => setViewMode("detalhes")}
                    onExpandirEnvolvidos={() => setViewMode("detalhes")}
                    onAbrirProcessoExterno={() => {
                      // Monta URL do tribunal baseado no número do processo
                      const numero = processo.numero?.replace(/\D/g, "") || "";
                      if (numero.length >= 20) {
                        // Extrai segmento J.TR do CNJ para determinar tribunal
                        const tribunal = processo.tribunal?.toLowerCase() || "";
                        let url = "";
                        if (tribunal.includes("trt") || tribunal.includes("trabalho")) {
                          // PJe Trabalhista
                          url = `https://pje.trt${numero.substring(16, 18)}.jus.br/consultaprocessual/detalhe-processo/${processo.numero}`;
                        } else if (tribunal.includes("trf")) {
                          // TRF
                          url = `https://pje.trf${numero.substring(16, 18)}.jus.br/pje/ConsultaPublica/listView.seam`;
                        } else {
                          // DataJud CNJ como fallback
                          url = `https://www.cnj.jus.br/poder-judiciario/consulta-processual/`;
                        }
                        window.open(url, "_blank");
                      } else {
                        window.open(`https://www.cnj.jus.br/poder-judiciario/consulta-processual/`, "_blank");
                      }
                    }}
                  />

                  {/* Conteúdo da aba selecionada */}
                  {renderActiveTabContent()}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        {editingAudiencia && (
          <EditarAudienciaDialog 
            audiencia={editingAudiencia}
            open={!!editingAudiencia}
            onOpenChange={(open) => {
              if (!open) {
                queryClient.invalidateQueries({ queryKey: ["audiencias-processo", id, processo?.numero] });
                setEditingAudiencia(null);
              }
            }}
          />
        )}

        {/* Intimação Details Dialog */}
        <Dialog open={!!selectedIntimacao} onOpenChange={(open) => !open && setSelectedIntimacao(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Detalhes da Intimação
              </DialogTitle>
            </DialogHeader>
            {selectedIntimacao && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {getIntimacaoStatusBadge(selectedIntimacao.status)}
                  {getOrigemBadge(selectedIntimacao.origem)}
                </div>
                {selectedIntimacao.data_limite && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Prazo</p>
                    <p className="font-medium text-destructive">{formatDate(selectedIntimacao.data_limite)}</p>
                  </div>
                )}
                {selectedIntimacao.descricao && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p>{selectedIntimacao.descricao}</p>
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
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className={`text-sm ${conteudoDisplayClasses}`}>
                        {formatConteudoParaExibicao(selectedIntimacao.conteudo_publicacao)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </MainLayout>
    );
  }

  // View mode: detalhes (Projuris style - full details)
  if (viewMode === "detalhes") {
    return (
      <MainLayout title="" subtitle="">
        <ProcessoDetalhesCompletos
          processo={processo}
          responsaveis={responsaveisParaCards}
          movimentacoes={movimentacoes}
          documentos={documentosProcesso}
          tarefas={tarefas}
          audiencias={audiencias}
          intimacoes={intimacoes}
          publicacoesDjen={publicacoesDjen}
          redistribuicoes={redistribuicoes}
          alertas360={alertas360}
          eventosAgenda={eventosAgenda}
          loadingAudiencias={loadingAudiencias}
          loadingIntimacoes={loadingIntimacoes}
          loadingPublicacoes={loadingPublicacoes}
          loadingTarefas={loadingTarefas}
          selectedTarefaId={selectedTarefaId}
          onVoltar={() => setViewMode("resumo")}
          onEditar={() => {
            setEditando(true);
            setViewMode("editar");
          }}
          onEditAudiencia={(aud) => setEditingAudiencia(aud)}
          onSelectIntimacao={(int) => setSelectedIntimacao(int)}
          onSelectTarefa={(tarefaId) => setSelectedTarefaId(tarefaId)}
          onVoltarTarefa={() => setSelectedTarefaId(null)}
        />

        {/* Dialogs */}
        {editingAudiencia && (
          <EditarAudienciaDialog 
            audiencia={editingAudiencia}
            open={!!editingAudiencia}
            onOpenChange={(open) => {
              if (!open) {
                queryClient.invalidateQueries({ queryKey: ["audiencias-processo", id, processo?.numero] });
                setEditingAudiencia(null);
              }
            }}
          />
        )}

        {/* Intimação Details Dialog */}
        <Dialog open={!!selectedIntimacao} onOpenChange={(open) => !open && setSelectedIntimacao(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Detalhes da Intimação
              </DialogTitle>
            </DialogHeader>
            {selectedIntimacao && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {getIntimacaoStatusBadge(selectedIntimacao.status)}
                  {getOrigemBadge(selectedIntimacao.origem)}
                </div>
                {selectedIntimacao.data_limite && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Prazo</p>
                    <p className="font-medium text-destructive">{formatDate(selectedIntimacao.data_limite)}</p>
                  </div>
                )}
                {selectedIntimacao.descricao && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p>{selectedIntimacao.descricao}</p>
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
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap break-words">{selectedIntimacao.conteudo_publicacao}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </MainLayout>
    );
  }

  // View mode: editar - usando o novo layout organizado
  return (
    <MainLayout title="" subtitle="">
      <ProcessoEditarCompleto
        processo={processo}
        formData={formData}
        responsaveis={responsaveis}
        coordenacoes={coordenacoes}
        clientes={clientes}
        salvando={salvando}
        onInputChange={handleInputChange}
        onResponsaveisChange={(newResp) => {
          setResponsaveis(newResp);
          setResponsaveisLoaded(true);
        }}
        onSalvar={() => setShowConfirmDialog(true)}
        onCancelar={() => {
          handleCancelarEdicao();
          setViewMode("detalhes");
        }}
      />

      {/* Dialog de confirmação */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente salvar as alterações feitas neste processo?
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

      {/* Dialogs */}
      {editingAudiencia && (
        <EditarAudienciaDialog 
          audiencia={editingAudiencia}
          open={!!editingAudiencia}
          onOpenChange={(open) => {
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ["audiencias-processo", id, processo?.numero] });
              setEditingAudiencia(null);
            }
          }}
        />
      )}

      {/* Intimação Details Dialog */}
      <Dialog open={!!selectedIntimacao} onOpenChange={(open) => !open && setSelectedIntimacao(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Detalhes da Intimação
            </DialogTitle>
          </DialogHeader>
          {selectedIntimacao && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getIntimacaoStatusBadge(selectedIntimacao.status)}
                {getOrigemBadge(selectedIntimacao.origem)}
              </div>
              {selectedIntimacao.data_limite && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Prazo</p>
                  <p className="font-medium text-destructive">{formatDate(selectedIntimacao.data_limite)}</p>
                </div>
              )}
              {selectedIntimacao.descricao && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                  <p>{selectedIntimacao.descricao}</p>
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
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap break-words">{selectedIntimacao.conteudo_publicacao}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
