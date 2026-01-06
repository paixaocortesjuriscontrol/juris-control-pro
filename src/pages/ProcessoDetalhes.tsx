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
  AlertCircle
} from "lucide-react";
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

  // Initialize form when processo loads or editing starts
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
        <Tabs defaultValue="audiencias" className="w-full">
          <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
              <TabsTrigger value="audiencias" className="gap-1.5">
                <Gavel className="w-4 h-4" />
                <span className="hidden sm:inline">Audiências</span>
                {audiencias.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{audiencias.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="intimacoes" className="gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Intimações</span>
                {intimacoes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{intimacoes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="publicacoes" className="gap-1.5">
                <Newspaper className="w-4 h-4" />
                <span className="hidden sm:inline">Pub. DJEN</span>
                {publicacoesDjen.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{publicacoesDjen.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="andamentos" className="gap-1.5">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Andamentos</span>
                {movimentacoes && movimentacoes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{movimentacoes.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Audiências Tab */}
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
                          <div key={aud.id} className="p-5 border-2 rounded-xl hover:bg-muted/30 transition-colors">
                            {/* Header com Status e Data */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 pb-3 border-b">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={aud.status === 'pendente' ? 'default' : aud.status === 'tratado' ? 'secondary' : 'outline'}>
                                  {aud.status}
                                </Badge>
                                {aud.tipo_audiencia && (
                                  <Badge variant="outline">{aud.tipo_audiencia}</Badge>
                                )}
                                {aud.origem && (
                                  <Badge variant="secondary" className="text-xs">{aud.origem}</Badge>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                {aud.data_audiencia && (
                                  <p className="font-semibold text-lg flex items-center gap-2 justify-end">
                                    <Calendar className="w-5 h-5 text-primary" />
                                    {formatDate(aud.data_audiencia)}
                                  </p>
                                )}
                                {(aud.hora_brasilia || aud.hora) && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end mt-1">
                                    <Clock className="w-4 h-4" />
                                    {aud.hora_brasilia || aud.hora}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Detalhes da Audiência */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              {aud.local_audiencia && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Local</p>
                                  <p className="font-medium flex items-center gap-1">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    {aud.local_audiencia}
                                  </p>
                                </div>
                              )}
                              {aud.vara_camara && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Vara/Câmara</p>
                                  <p className="font-medium">{aud.vara_camara}</p>
                                </div>
                              )}
                              {aud.comarca && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Comarca</p>
                                  <p className="font-medium">{aud.comarca}</p>
                                </div>
                              )}
                              {aud.cliente && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</p>
                                  <p className="font-medium">{aud.cliente}</p>
                                </div>
                              )}
                              {aud.polo_ativo && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Polo Ativo</p>
                                  <p className="font-medium">{aud.polo_ativo}</p>
                                </div>
                              )}
                              {aud.advogado && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Advogado</p>
                                  <p className="font-medium flex items-center gap-1">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    {aud.advogado}
                                  </p>
                                </div>
                              )}
                              {aud.preposto && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Preposto</p>
                                  <p className="font-medium">{aud.preposto}</p>
                                </div>
                              )}
                              {aud.terceirizado && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Terceirizado</p>
                                  <p className="font-medium">{aud.terceirizado}</p>
                                </div>
                              )}
                              {aud.testemunhas && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Testemunhas</p>
                                  <p className="font-medium">{aud.testemunhas}</p>
                                </div>
                              )}
                              {aud.funcao && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Função</p>
                                  <p className="font-medium">{aud.funcao}</p>
                                </div>
                              )}
                            </div>

                            {/* Resumo do Objeto */}
                            {aud.resumo_objeto && (
                              <div className="mt-4 pt-3 border-t">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Resumo do Objeto</p>
                                <p className="text-sm">{aud.resumo_objeto}</p>
                              </div>
                            )}

                            {/* Observações */}
                            {aud.observacoes && (
                              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Observações</p>
                                <p className="text-sm">{aud.observacoes}</p>
                              </div>
                            )}

                            {/* Providências Tomadas */}
                            {aud.providencias_tomadas && (
                              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Providências Tomadas</p>
                                <p className="text-sm">{aud.providencias_tomadas}</p>
                              </div>
                            )}

                            {/* Conteúdo da Publicação (colapsável) */}
                            {aud.conteudo_publicacao && (
                              <details className="mt-3">
                                <summary className="cursor-pointer text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground">
                                  Ver conteúdo da publicação original
                                </summary>
                                <div className="mt-2 p-3 bg-muted/20 rounded-lg text-sm max-h-48 overflow-y-auto">
                                  {aud.conteudo_publicacao}
                                </div>
                              </details>
                            )}

                            {/* Metadados */}
                            <div className="mt-4 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {aud.tratado_em && (
                                <span>Tratado em: {formatDateTime(aud.tratado_em)}</span>
                              )}
                              <span>Criado em: {formatDateTime(aud.created_at)}</span>
                            </div>
                          </div>
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
                        {intimacoes.map((int) => (
                          <div key={int.id} className="p-5 border-2 rounded-xl hover:bg-muted/30 transition-colors">
                            {/* Header com Status e Datas */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 pb-3 border-b">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={int.status === 'pendente' ? 'default' : int.status === 'tratado' ? 'secondary' : 'outline'}>
                                  {int.status}
                                </Badge>
                                {int.prioridade && (
                                  <Badge variant={int.prioridade === 'alta' ? 'destructive' : int.prioridade === 'media' ? 'default' : 'outline'}>
                                    Prioridade: {int.prioridade}
                                  </Badge>
                                )}
                                {int.tipo_intimacao && (
                                  <Badge variant="outline">{int.tipo_intimacao}</Badge>
                                )}
                                {int.origem && (
                                  <Badge variant="secondary" className="text-xs">{int.origem}</Badge>
                                )}
                              </div>
                              <div className="text-right shrink-0 space-y-1">
                                {int.data_intimacao && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                                    <Calendar className="w-4 h-4" />
                                    Intimação: {formatDate(int.data_intimacao)}
                                  </p>
                                )}
                                {int.data_limite && (
                                  <p className="font-semibold text-lg text-destructive flex items-center gap-2 justify-end">
                                    <Clock className="w-5 h-5" />
                                    Prazo: {formatDate(int.data_limite)}
                                  </p>
                                )}
                                {int.prazo_dias && (
                                  <p className="text-xs text-muted-foreground">
                                    ({int.prazo_dias} dias)
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Descrição */}
                            {int.descricao && (
                              <div className="mb-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Descrição</p>
                                <p className="text-sm font-medium">{int.descricao}</p>
                              </div>
                            )}

                            {/* Detalhes da Intimação */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              {int.orgao_intimante && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Órgão Intimante</p>
                                  <p className="font-medium flex items-center gap-1">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    {int.orgao_intimante}
                                  </p>
                                </div>
                              )}
                              {int.processo_numero && (
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Nº Processo</p>
                                  <p className="font-medium font-mono">{int.processo_numero}</p>
                                </div>
                              )}
                            </div>

                            {/* Contexto */}
                            {int.contexto && (
                              <div className="mt-4 pt-3 border-t">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contexto</p>
                                <p className="text-sm">{int.contexto}</p>
                              </div>
                            )}

                            {/* Observações */}
                            {int.observacoes && (
                              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Observações</p>
                                <p className="text-sm">{int.observacoes}</p>
                              </div>
                            )}

                            {/* Providências Tomadas */}
                            {int.providencias_tomadas && (
                              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Providências Tomadas</p>
                                <p className="text-sm">{int.providencias_tomadas}</p>
                              </div>
                            )}

                            {/* Conteúdo da Publicação (colapsável) */}
                            {int.conteudo_publicacao && (
                              <details className="mt-3">
                                <summary className="cursor-pointer text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground">
                                  Ver conteúdo da publicação original
                                </summary>
                                <div className="mt-2 p-3 bg-muted/20 rounded-lg text-sm max-h-48 overflow-y-auto">
                                  {int.conteudo_publicacao}
                                </div>
                              </details>
                            )}

                            {/* Metadados */}
                            <div className="mt-4 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {int.tratado_em && (
                                <span>Tratado em: {formatDateTime(int.tratado_em)}</span>
                              )}
                              <span>Criado em: {formatDateTime(int.created_at)}</span>
                            </div>
                          </div>
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

        <Accordion type="multiple" defaultValue={["info-basicas", "localizacao", "partes", "valores", "contingencial", "andamentos"]} className="space-y-4">
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
    </MainLayout>
  );
}
