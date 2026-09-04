import { useState, useRef, useEffect, useMemo } from "react";
import JSZip from "jszip";
import { ProcessoTstTab } from "./ProcessoTstTab";
import { ProcessoDistribuicoesTab } from "./ProcessoDistribuicoesTab";
import { ProcessoJuditTab } from "./ProcessoJuditTab";
import { AudienciaPublicacaoVinculada } from "@/components/shared/AudienciaPublicacaoVinculada";
import { AudienciaResponsaveisResumo } from "@/components/audiencias/AudienciaResponsaveisResumo";

const SITUACAO_AUDIENCIA_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  a_confirmar: "A confirmar",
  revisao: "Em revisão",
  verificado: "Verificado",
  cumprido: "Cumprido",
  concluido: "Concluído",
  concluido_sem_sucesso: "Concluído sem sucesso",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

function SituacaoAudienciaBadge({ status }: { status?: string | null }) {
  const key = (status || "pendente").toLowerCase();
  const label = SITUACAO_AUDIENCIA_LABELS[key] || status || "Pendente";
  const variant: "default" | "secondary" | "destructive" | "outline" =
    ["cumprido", "concluido", "verificado"].includes(key)
      ? "default"
      : ["cancelado", "atrasado", "concluido_sem_sucesso"].includes(key)
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] shrink-0 whitespace-nowrap">
      {label}
    </Badge>
  );
}
import { ProcessoAnexosJuditTab } from "./ProcessoAnexosJuditTab";
import { AnaliseJuditTab } from "@/components/distribuicao-tst/AnaliseJuditTab";
import { ProcessoPartesTab } from "./ProcessoPartesTab";
import { ProcessoAuditoriaTab } from "./ProcessoAuditoriaTab";
import { useContagemAtividades } from "@/hooks/useItensComAtividades";
import { PrazoSectionEditable } from "./PrazoSectionEditable";
import { SelecionarResponsaveisProcesso } from "./SelecionarResponsaveisProcesso";
import { BaixarAutosButton } from "./BaixarAutosButton";
import { ProcessoVisaoGeralForm, type ProcessoVisaoGeralFormHandle } from "./ProcessoVisaoGeralForm";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AcompanhamentoEspecialEventos } from "./AcompanhamentoEspecialEventos";
import { supabase } from "@/integrations/supabase/client";
import { EventoProcessoCard, useEventosPessoas } from "./EventoProcessoCard";
import { getSignedUrlOrEmpty } from "@/utils/signedUrl";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft,
  ListTodo,
  Activity,
  Paperclip,
  Users,
  DollarSign,
  Download,
  MessageSquare,
  Clock,
  Scale,
  Copy,
  Calendar,
  FileText,
  Gavel,
  AlertCircle,
  FileBox,
  Briefcase,
  Newspaper,
  Shuffle,
  Radar,
  CalendarDays,
  Globe,
  User,
  Eye,
  Home,
  ShieldCheck,
  Bell,
  BellOff,
  Info,
  ListPlus,
  Plus,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import { ProcessoPedidosTab } from "./ProcessoPedidosTab";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { parseDataPublicacaoLocal } from "@/utils/formatConteudo";
import { ptBR } from "date-fns/locale";
import { TarefaPublicacaoView } from "./TarefaPublicacaoView";
import { PublicacoesDjenList } from "./PublicacoesDjenList";
import { CobrancaSection } from "./CobrancaSection";
import { MonitoramentoToggle } from "./MonitoramentoToggle";
import { PendenciasProcessoCard } from "./PendenciasProcessoCard";
import { DepositosRecursaisCard } from "./DepositosRecursaisCard";
import { CustasProcessuaisCard } from "./CustasProcessuaisCard";
import { AnaliseDocumentoDialog } from "./AnaliseDocumentoDialog";
import { AudienciaFormSimplificado } from "@/components/audiencias/AudienciaFormSimplificado";
import { NovoItemPanel, type NovoItemTipo } from "@/components/shared/NovoItemPanel";
import { ClipboardList, CalendarPlus, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast as sonnerToast } from "sonner";
import { Loader2, Upload as UploadIcon, Sparkles, Trash2, Save } from "lucide-react";

const isTarefaAudiencia = (tipo: string | null | undefined) => {
  if (!tipo) return false;
  const lower = tipo.toLowerCase().trim();
  return lower === 'audiência' || lower === 'audiencia' || lower === 'preparação audiência' || lower === 'preparacao audiencia';
};

const isPrazoTarefa = (tipo: string | null | undefined) =>
  (tipo || "").toString().trim().toUpperCase() === "PRAZO";

interface Responsavel {
  id: string;
  nome: string;
}

function PrazoField({ label, value, isDate }: { label: string; value: string | null | undefined; isDate?: boolean }) {
  let display = value || "—";
  if (isDate && value) {
    const d = new Date(`${value}T12:00:00`);
    if (!isNaN(d.getTime())) {
      display = d.toLocaleDateString("pt-BR");
    }
  }
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{display}</p>
    </div>
  );
}

interface Envolvido {
  nome: string;
  tipo: "requerido" | "requerente";
  principal?: boolean;
}

interface ProcessoDetalhesCompletosProps {
  processo: any;
  responsaveis: Responsavel[];
  movimentacoes: any[];
  documentos: any[];
  tarefas: any[];
  // Dados adicionais
  audiencias?: any[];
  intimacoes?: any[];
  publicacoesDjen?: any[];
  redistribuicoes?: any[];
  alertas360?: any[];
  eventosAgenda?: any[];
  // Loading states
  loadingAudiencias?: boolean;
  loadingIntimacoes?: boolean;
  loadingPublicacoes?: boolean;
  loadingTarefas?: boolean;
  // Tarefa selection
  selectedTarefaId?: string | null;
  // Seção inicial (para navegação via URL ?tab=)
  initialSection?: string;
  // Handlers
  onVoltar: () => void;
  onEditar: () => void;
  onCriarTarefaAudiencia?: (audiencia: any) => void;
  audienciaInvalidateKey?: unknown[];
  onSelectIntimacao?: (intimacao: any) => void;
  onSelectTarefa?: (tarefaId: string) => void;
  onVoltarTarefa?: () => void;
  onCriarTarefaPublicacao?: (publicacao: any) => void;
  onNumeroChange?: (numero: string) => void;
  /** Criação de "Caso": número do processo é opcional. */
  modoCaso?: boolean;
}

export function ProcessoDetalhesCompletos({
  processo,
  responsaveis,
  movimentacoes,
  documentos,
  tarefas,
  audiencias = [],
  intimacoes = [],
  publicacoesDjen = [],
  redistribuicoes = [],
  alertas360 = [],
  eventosAgenda = [],
  loadingAudiencias = false,
  loadingIntimacoes = false,
  loadingPublicacoes = false,
  loadingTarefas = false,
  selectedTarefaId,
  initialSection,
  onVoltar,
  onEditar,
  onCriarTarefaAudiencia,
  audienciaInvalidateKey,
  onSelectIntimacao,
  onSelectTarefa,
  onVoltarTarefa,
  onCriarTarefaPublicacao,
  onNumeroChange,
  modoCaso = false,
}: ProcessoDetalhesCompletosProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Inicializa com initialSection se fornecido (vem do ?tab= da URL)
  const [activeSection, setActiveSection] = useState<string>(initialSection || "resumo");
  const [juditNovoDestaque, setJuditNovoDestaque] = useState(false);

  // Sinaliza (fonte verde no nome da aba) quais seções têm dados vindos da Judit.
  const { data: juditFlags } = useQuery({
    queryKey: ["judit-flags-processo", processo?.id],
    enabled: !!processo?.id,
    queryFn: async () => {
      const [partes, consultas] = await Promise.all([
        supabase
          .from("processos_partes" as any)
          .select("id", { count: "exact", head: true })
          .eq("processo_id", processo.id)
          .eq("fonte", "judit"),
        supabase
          .from("consultas_judit" as any)
          .select("id", { count: "exact", head: true })
          .eq("processo_id", processo.id),
      ]);
      return { partes: (partes.count || 0) > 0, analise: (consultas.count || 0) > 0 };
    },
  });

  const juditCamposCount = Array.isArray((processo as any)?.judit_campos)
    ? (processo as any).judit_campos.length
    : 0;
  const juditSecoes: Record<string, boolean> = {
    resumo: juditCamposCount > 0,
    andamentos: (movimentacoes || []).some((m: any) => String(m?.fonte || "").startsWith("judit")),
    partes: !!juditFlags?.partes,
    "analise-judit": !!juditFlags?.analise,
  };

  // Ref para o formulário Resumo — permite autosave ao trocar de seção
  const visaoGeralRef = useRef<ProcessoVisaoGeralFormHandle>(null);
  const handleSectionChange = (next: string) => {
    if (activeSection === "resumo" && next !== "resumo" && visaoGeralRef.current) {
      // Autosave em background — não bloqueia a navegação
      visaoGeralRef.current.save({ silent: true }).catch(() => {});
    }
    fecharNovoItem();
    if (next === "tarefas" || next === "prazo") {
      onVoltarTarefa?.();
    }
    setAudienciaSelecionada(null);
    setActiveSection(next);
  };
  
  // Sincroniza quando initialSection muda (navegação SPA para o mesmo processo com ?tab= diferente)
  const prevInitialSectionRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (initialSection && initialSection !== prevInitialSectionRef.current) {
      prevInitialSectionRef.current = initialSection;
      const merged = initialSection === "detalhes" || initialSection === "envolvidos"
        ? "resumo"
        : initialSection;
      setActiveSection(merged);
    }
  }, [initialSection]);
  
  const [comentario, setComentario] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'analyzing' | 'done'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [zipPhase, setZipPhase] = useState<'none' | 'decompressing' | 'extracting' | 'uploading'>('none');
  const [analiseResult, setAnaliseResult] = useState<any>(null);
  const [analiseDialogOpen, setAnaliseDialogOpen] = useState(false);
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  // Painel unificado (mesmo do Painel de Controle): Tarefa, Evento, Prazo, Audiência, Parcelamento.
  const [novoItemTipo, setNovoItemTipo] = useState<NovoItemTipo | null>(null);
  const [itemParaEditar, setItemParaEditar] = useState<any | null>(null);
  const [audienciaSelecionada, setAudienciaSelecionada] = useState<any | null>(null);
  const eventosDoProcesso = eventosAgenda.filter((evento: any) => (evento.tipo || "").toLowerCase() !== "parcelamento");
  const { data: eventosPessoas = {} } = useEventosPessoas(
    eventosAgenda.map((e: any) => String(e.id)).filter(Boolean)
  );
  const parcelamentosDoProcesso = eventosAgenda.filter((evento: any) => (evento.tipo || "").toLowerCase() === "parcelamento");
  const processoPreSelecionado = processo
    ? { id: processo.id, numero: processo.numero || "", coordenacao_id: (processo as any).coordenacao_id ?? null }
    : null;
  const abrirNovoItem = (tipo: NovoItemTipo, item: any | null = null) => {
    if (tipo === "audiencia") {
      setAudienciaSelecionada(null);
    }
    setItemParaEditar(item);
    setNovoItemTipo(tipo);
  };
  const fecharNovoItem = () => {
    setNovoItemTipo(null);
    setItemParaEditar(null);
  };
  const invalidarAposSalvar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    await queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
    await queryClient.invalidateQueries({ queryKey: ["audiencias-detectadas"] });
    if (audienciaInvalidateKey) {
      await queryClient.invalidateQueries({ queryKey: audienciaInvalidateKey });
    }
    await queryClient.invalidateQueries({ queryKey: ["prazos"] });
    fecharNovoItem();
  };
  const audienciaSelecionadaAtual = audienciaSelecionada
    ? audiencias.find((aud: any) => aud.id === audienciaSelecionada.id) ?? audienciaSelecionada
    : null;
  // Sem agrupamento por conteúdo: cada registro do banco aparece uma vez.
  // A advogada precisa ver todos os itens que criou, mesmo que iguais (título/data/responsável).
  const anexarResponsaveis = (lista: any[]) =>
    lista.map((item) => ({
      ...item,
      _responsaveisNomes: item.responsavel?.nome ? [item.responsavel.nome] : [],
    }));
  const tarefasSemPrazo = anexarResponsaveis(tarefas.filter((t: any) => !isPrazoTarefa(t.tipo_tarefa)));
  const prazosDoProcesso = anexarResponsaveis(tarefas.filter((t: any) => isPrazoTarefa(t.tipo_tarefa)));

  // Contagem de atividades (subatividades) vinculadas aos itens do processo,
  // para exibir nas abas laterais (Tarefa, Prazo, Evento, Audiência).
  const idsItensProcesso = useMemo(
    () => [
      ...tarefas.map((t: any) => t?.id),
      ...eventosAgenda.map((e: any) => e?.id),
      ...audiencias.map((a: any) => a?.id),
    ],
    [tarefas, eventosAgenda, audiencias]
  );
  const { data: contagemAtividades = {} } = useContagemAtividades(idsItensProcesso);
  const qtdAtividades = (id?: string | null) => (id ? contagemAtividades[String(id)] || 0 : 0);


  // Inline editable resumo
  const [resumoForm, setResumoForm] = useState<Record<string, any>>({});
  const [resumoInitialized, setResumoInitialized] = useState(false);
  const [savingResumo, setSavingResumo] = useState(false);
  const [resumoResponsaveis, setResumoResponsaveis] = useState<any[]>([]);

  useEffect(() => {
    if (!processo || resumoInitialized) return;

    setResumoForm({
      assunto: processo.assunto || "",
      tribunal: processo.tribunal || "",
      comarca: processo.comarca || "",
      vara: processo.vara || "",
      polo_ativo: processo.polo_ativo || "",
      polo_passivo: processo.polo_passivo || "",
      valor_causa: processo.valor_causa || "",
      area: processo.area || "",
      fase: processo.fase || "",
      pasta_fisica: processo.pasta_fisica || "",
      pasta_cliente: processo.pasta_cliente || "",
      descricao: processo.descricao || "",
      data_distribuicao: processo.data_distribuicao || "",
    });
    setResumoInitialized(true);
  }, [processo, resumoInitialized]);

  useEffect(() => {
    setResumoInitialized(false);
  }, [processo?.id]);

  const updateResumoField = (field: string, value: any) => {
    setResumoForm(prev => ({ ...prev, [field]: value }));
  };

  const salvarResumo = async () => {
    if (!processo?.id) return;
    setSavingResumo(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({
          assunto: resumoForm.assunto || null,
          tribunal: resumoForm.tribunal || null,
          comarca: resumoForm.comarca || null,
          vara: resumoForm.vara || null,
          
          polo_ativo: resumoForm.polo_ativo || null,
          polo_passivo: resumoForm.polo_passivo || null,
          valor_causa: resumoForm.valor_causa ? Number(resumoForm.valor_causa) : null,
          area: resumoForm.area || null,
          fase: resumoForm.fase || null,
          
          pasta_fisica: resumoForm.pasta_fisica || null,
          pasta_cliente: resumoForm.pasta_cliente || null,
          descricao: resumoForm.descricao || null,
          data_distribuicao: resumoForm.data_distribuicao || null,
        } as any)
        .eq("id", processo.id);
      if (error) throw error;

      // Salvar responsáveis
      if (resumoResponsaveis.length > 0) {
        // Desativar existentes
        await supabase
          .from("processos_responsaveis")
          .update({ ativo: false } as any)
          .eq("processo_id", processo.id);

        // Inserir novos
        const inserts = resumoResponsaveis.map((r: any) => ({
          processo_id: processo.id,
          usuario_id: r.usuario_id,
          coordenacao_id: r.coordenacao_id || null,
          papel: r.papel || "responsavel",
          ativo: true,
        }));
        const { error: errResp } = await supabase
          .from("processos_responsaveis")
          .upsert(inserts as any, { onConflict: "processo_id,usuario_id" });
        if (errResp) throw errResp;
      }

      sonnerToast.success("Processo atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["processo"] });
      queryClient.invalidateQueries({ queryKey: ["processos-responsaveis"] });
    } catch (err: any) {
      sonnerToast.error("Erro ao salvar: " + err.message);
    } finally {
      setSavingResumo(false);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Não informado";
    // Datas "puras" (YYYY-MM-DD ou timestamp 00:00:00Z) são ancoradas ao
    // meio-dia local para evitar o deslocamento de -1 dia (UTC -> BRT).
    const local = parseDataPublicacaoLocal(date);
    if (!local) return "Não informado";
    return format(local, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return "Não informado";
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "Não informado";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Valid processos columns for auto-fill (whitelist)
  const VALID_PROCESSOS_COLUMNS = new Set([
    'polo_ativo', 'polo_passivo', 'vara', 'comarca', 'tribunal',
    'assunto', 'valor_causa', 'data_distribuicao', 'classe',
    'esfera', 'instancia', 'justica', 'natureza', 'materia',
    'advogado_externo', 'cpf_cnpj_parte_contraria', 'funcao_parte_contraria',
  ]);

  // Supported extensions for ZIP extraction
  const SUPPORTED_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv',
  ]);

  const isSystemFile = (name: string) => {
    return name.startsWith('__MACOSX/') || name.endsWith('.DS_Store') || name.endsWith('Thumbs.db');
  };

  const uploadSingleFile = async (file: File, processoId: string, userId: string) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${processoId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${sanitizedName}`;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (file.size > 6 * 1024 * 1024) {
      const tus = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000],
          headers: {
            authorization: `Bearer ${accessToken}`,
            "x-upsert": "false",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: "documentos_processos",
            objectName: filePath,
            contentType: file.type || "application/octet-stream",
          },
          chunkSize: 6 * 1024 * 1024,
          onError: (error) => reject(error),
          onSuccess: () => resolve(),
        });
        upload.findPreviousUploads().then((prev) => {
          if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
          upload.start();
        });
      });
    } else {
      const { error: uploadError } = await supabase.storage
        .from("documentos_processos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
    }

    const signedUrl = await getSignedUrlOrEmpty("documentos_processos", filePath);

    const { error: dbError } = await supabase
      .from("documentos")
      .insert({
        nome: file.name,
        tipo: file.type || "application/octet-stream",
        url: signedUrl,
        tamanho_bytes: file.size,
        processo_id: processoId,
        uploaded_by: userId,
      });
    if (dbError) throw dbError;

    // Best-effort repo save
    try {
      const repoPath = `${userId}/${Date.now()}_${sanitizedName}`;
      await supabase.storage.from("repositorio_documentos").upload(repoPath, file);
      await supabase.from("repositorio_documentos").insert({
        nome: file.name,
        nome_original: file.name,
        categoria: "outros",
        tamanho_bytes: file.size,
        mime_type: file.type,
        storage_path: repoPath,
        uploaded_by: userId,
        processo_id: processoId,
      });
    } catch (repoErr) {
      console.warn("Erro ao salvar no repositório (não-crítico):", repoErr);
    }
  };

  // Upload handler - only uploads, no analysis
  const handlePastaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !processo?.id) return;

    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';

    setUploading(true);
    setUploadStep('uploading');
    setUploadProgress(0);

    try {
      if (isZip) {
        // === ZIP flow ===
        setZipPhase('decompressing');
        setUploadStep('uploading');
        sonnerToast.info("Descompactando ZIP...");
        setUploadProgress(2);

        const zip = await JSZip.loadAsync(file);
        setUploadProgress(10);

        const entries = Object.entries(zip.files).filter(([name, entry]) => {
          if (entry.dir) return false;
          if (isSystemFile(name)) return false;
          const ext = '.' + name.split('.').pop()?.toLowerCase();
          return SUPPORTED_EXTENSIONS.has(ext);
        });

        if (entries.length === 0) {
          sonnerToast.error("Nenhum arquivo válido encontrado no ZIP.");
          return;
        }
        if (entries.length > 50) {
          sonnerToast.error("O ZIP contém mais de 50 arquivos. Limite excedido.");
          return;
        }

        // Pre-extract all blobs first (fast, in-memory)
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf', doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          xls: 'application/vnd.ms-excel', csv: 'text/csv',
        };

        setZipPhase('extracting');
        sonnerToast.info(`Extraindo ${entries.length} arquivo(s) do ZIP...`);
        const extractedFiles: File[] = [];
        for (let i = 0; i < entries.length; i++) {
          const [name, entry] = entries[i];
          const blob = await entry.async("blob");
          const fileName = name.split('/').pop() || name;
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          extractedFiles.push(new File([blob], fileName, {
            type: mimeMap[ext] || 'application/octet-stream',
          }));
          // Extraction progress: 10% to 25%
          setUploadProgress(10 + Math.round(((i + 1) / entries.length) * 15));
        }

        // Upload in parallel batches of 3
        setZipPhase('uploading');
        sonnerToast.info(`Enviando ${extractedFiles.length} arquivo(s)...`);
        let uploaded = 0;
        const BATCH_SIZE = 3;

        const uploadOneFile = async (extractedFile: File) => {
          const sanitizedName = extractedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = `processos/${processo.id}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${sanitizedName}`;

          if (extractedFile.size > 6 * 1024 * 1024) {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) throw new Error("Sessão expirada");
            const tus = await import("tus-js-client");
            await new Promise<void>((resolve, reject) => {
              const upload = new tus.Upload(extractedFile, {
                endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
                retryDelays: [0, 3000],
                headers: { authorization: `Bearer ${accessToken}`, "x-upsert": "false" },
                uploadDataDuringCreation: true,
                removeFingerprintOnSuccess: true,
                metadata: { bucketName: "documentos_processos", objectName: filePath, contentType: extractedFile.type },
                chunkSize: 6 * 1024 * 1024,
                onError: (error) => reject(error),
                onSuccess: () => resolve(),
              });
              upload.start();
            });
          } else {
            const { error: uploadError } = await supabase.storage
              .from("documentos_processos")
              .upload(filePath, extractedFile);
            if (uploadError) throw uploadError;
          }

          const signedUrl2 = await getSignedUrlOrEmpty("documentos_processos", filePath);
          await supabase.from("documentos").insert({
            nome: extractedFile.name,
            tipo: extractedFile.type || "application/octet-stream",
            url: signedUrl2,
            tamanho_bytes: extractedFile.size,
            processo_id: processo.id,
            uploaded_by: user.id,
          });

          uploaded++;
          // Upload progress: 25% to 100%
          setUploadProgress(25 + Math.round((uploaded / extractedFiles.length) * 75));
        };

        // Process in batches of BATCH_SIZE for parallelism
        for (let i = 0; i < extractedFiles.length; i += BATCH_SIZE) {
          const batch = extractedFiles.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(f => uploadOneFile(f)));
        }

        sonnerToast.success(`${uploaded} documento(s) extraído(s) do ZIP e enviado(s)!`);
      } else {
        // === Normal single file flow ===
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 8, 85));
        }, 150);

        await uploadSingleFile(file, processo.id, user.id);

        clearInterval(progressInterval);
        setUploadProgress(100);
        sonnerToast.success("Documento enviado com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ["documentos-processo", processo.id] });
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["repositorio-documentos"] });
    } catch (error: any) {
      sonnerToast.error("Erro ao enviar documento: " + error.message);
    } finally {
      setUploading(false);
      setUploadStep('idle');
      setUploadProgress(0);
      setZipPhase('none');
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Analyze a specific document with AI
  const handleAnalyzeDocument = async (doc: any) => {
    if (!doc?.url || !processo?.id) return;
    setAnalyzingDocId(doc.id);

    try {
      // Check if we already have cached extracted text
      let fileContent: string;
      const hasCachedContent = doc.conteudo_extraido && doc.paginas_extraidas >= 5;

      if (hasCachedContent) {
        console.log("Usando texto extraído do cache (banco de dados)");
        fileContent = doc.conteudo_extraido;
      } else {
        // Fetch the file from URL
        const response = await fetch(doc.url);
        const blob = await response.blob();
        const file = new File([blob], doc.nome, { type: doc.tipo || 'application/octet-stream' });

        // Extract text content
        fileContent = await (async () => {
          const isPdf = (doc.tipo || '').includes('pdf') || doc.nome?.toLowerCase().endsWith('.pdf');
          if (isPdf) {
            try {
              const pdfjsLib = await import("pdfjs-dist");
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
              const arrayBuffer = await file.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              const maxPages = Math.min(pdf.numPages, 5);
              const pages: string[] = [];
              for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const tc = await page.getTextContent();
                const text = tc.items.map((item: any) => item.str).join(" ");
                if (text.trim()) pages.push(`--- Página ${i} ---\n${text}`);
              }
              return pages.join("\n\n") || `[PDF sem texto extraível: ${doc.nome}]`;
            } catch (e) {
              console.error("Erro ao extrair texto do PDF:", e);
              return `[Erro ao ler PDF: ${doc.nome}]`;
            }
          }
          const isText = (doc.tipo || '').includes("text") || (doc.tipo || '').includes("json");
          if (isText) {
            return await file.text();
          }
          return `[Arquivo binário: ${doc.nome}]`;
        })();

        // Save extracted content to DB for future use
        const isPdf = (doc.tipo || '').includes('pdf') || doc.nome?.toLowerCase().endsWith('.pdf');
        if (isPdf && !fileContent.startsWith('[')) {
          const paginasExtraidas = (fileContent.match(/--- Página \d+ ---/g) || []).length;
          await supabase.from("documentos").update({
            conteudo_extraido: fileContent,
            paginas_extraidas: paginasExtraidas,
          }).eq("id", doc.id);
          console.log(`Texto de ${paginasExtraidas} páginas salvo no banco`);
        }
      }

      const { data: session } = await supabase.auth.getSession();
      const aiResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analisar-documento`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            fileName: doc.nome,
            fileContent,
            mimeType: doc.tipo,
            processoAtual: processo,
          }),
        }
      );

      if (aiResponse.ok) {
        const analise = await aiResponse.json();

        // Update document with AI metadata
        await supabase.from("documentos").update({
          categoria: analise.categoria,
          tipo_documento: analise.tipo_documento,
          descricao: analise.descricao,
          tags: analise.tags,
          analisado_ia: true,
          confianca_ia: analise.confianca,
        }).eq("id", doc.id);

        const hasCampos = analise.campos_extraidos && Object.keys(analise.campos_extraidos).length > 0;
        const hasPartes = analise.partes?.polo_ativo || analise.partes?.polo_passivo;
        const hasInfo = analise.info_processual && Object.keys(analise.info_processual).length > 0;
        const hasAdvogados = analise.advogados && analise.advogados.length > 0;

        if (hasCampos || hasPartes || hasInfo || hasAdvogados) {
          setAnaliseResult(analise);
          setAnaliseDialogOpen(true);
        } else {
          sonnerToast.info("Documento analisado pela IA. Nenhum campo novo encontrado.");
        }

        queryClient.invalidateQueries({ queryKey: ["documentos"] });
      } else {
        sonnerToast.error("Erro ao analisar documento com IA.");
      }
    } catch (error: any) {
      sonnerToast.error("Erro ao analisar: " + error.message);
    } finally {
      setAnalyzingDocId(null);
    }
  };

  const handleAnaliseConfirm = async (camposParaPreencher: Record<string, any>) => {
    if (!processo?.id) {
      setAnaliseDialogOpen(false);
      return;
    }

    try {
      // Filter only valid processos columns
      const validCampos: Record<string, any> = {};
      for (const [key, value] of Object.entries(camposParaPreencher)) {
        if (VALID_PROCESSOS_COLUMNS.has(key)) {
          validCampos[key] = value;
        }
      }

      // Always save advogados_identificados if available
      if (analiseResult?.advogados?.length > 0) {
        validCampos.advogados_identificados = analiseResult.advogados;
      }

      if (Object.keys(validCampos).length === 0) {
        sonnerToast.info("Nenhum campo válido para preencher.");
        setAnaliseDialogOpen(false);
        return;
      }


      const { error } = await supabase
        .from("processos")
        .update(validCampos)
        .eq("id", processo.id);

      if (error) throw error;
      sonnerToast.success(`${Object.keys(validCampos).length} campo(s) preenchido(s) automaticamente!`);
      queryClient.invalidateQueries({ queryKey: ["processos"] });
    } catch (error: any) {
      sonnerToast.error("Erro ao atualizar processo: " + error.message);
    }
    setAnaliseDialogOpen(false);
  };


  const envolvidos: Envolvido[] = [
    ...(processo.polo_passivo ? [{ nome: processo.polo_passivo, tipo: "requerido" as const, principal: true }] : []),
    ...(processo.polo_ativo ? [{ nome: processo.polo_ativo, tipo: "requerente" as const, principal: true }] : []),
  ];

  const FieldItem = ({ label, value, className }: { label: string; value: any; className?: string }) => (
    <div className={className}>
      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{label}</p>
      <p className="text-sm text-foreground">{value || "Não informado"}</p>
    </div>
  );

  // Deduplica alertas 360 por movimentacao_id + termo_encontrado (usado na contagem e na listagem)
  // e enriquece com publicação DJEN relacionada (busca por termo no conteúdo)
  const alertas360Unicos = alertas360.reduce((acc: any[], alerta: any) => {
    const chave = `${alerta.movimentacao_id || 'sem-mov'}-${alerta.termo_encontrado}`;
    if (!acc.find((a: any) => `${a.movimentacao_id || 'sem-mov'}-${a.termo_encontrado}` === chave)) {
      // Busca publicação DJEN que contenha o termo encontrado
      const publicacaoRelacionada = publicacoesDjen.find((pub: any) => {
        const conteudo = (pub.conteudo || '').toLowerCase();
        const termo = (alerta.termo_encontrado || '').toLowerCase();
        return conteudo.includes(termo);
      });
      acc.push({ ...alerta, publicacao_relacionada: publicacaoRelacionada || null });
    }
    return acc;
  }, []);

  // Navegação agrupada estilo Projuris: 7 grupos principais + Visão Geral
  // Mantém todas as seções existentes, apenas organizadas por categoria.
  const navGroups: Array<{
    label: string;
    items: Array<{ id: string; label: string; icon: any; count?: number; iconColor?: string }>;
  }> = [
    {
      label: "Visão geral",
      items: [
        { id: "resumo", label: "Visão Geral", icon: Home },
        { id: "auditoria", label: "Auditoria", icon: ShieldCheck, iconColor: "text-slate-500" },
      ],
    },
    {
      label: "Prazos & Eventos",
      items: [
        { id: "tarefas", label: "Tarefa", icon: ClipboardList, count: tarefasSemPrazo.length, iconColor: "text-blue-500" },
        { id: "agenda", label: "Evento", icon: CalendarPlus, count: eventosDoProcesso.length, iconColor: "text-violet-500" },
        { id: "prazo", label: "Prazo", icon: Clock, count: prazosDoProcesso.length, iconColor: "text-red-500" },
        { id: "audiencias", label: "Audiência", icon: Gavel, count: audiencias.length, iconColor: "text-yellow-500" },
        { id: "parcelamento", label: "Parc. Recor.", icon: Coins, count: parcelamentosDoProcesso.length, iconColor: "text-emerald-500" },
      ],
    },
    {
      label: "Andamentos",
      items: [
        { id: "andamentos", label: "Andamentos", icon: Activity, count: movimentacoes.length },
        { id: "publicacoes", label: "Pub. DJEN", icon: Newspaper, count: publicacoesDjen.length },
        { id: "redistribuicoes", label: "Redistribuições", icon: Shuffle, count: redistribuicoes.length },
      ],
    },
    {
      label: "Documentos",
      items: [
        { id: "documentos", label: "Pasta", icon: FileBox, count: documentos.length },
      ],
    },
    {
      label: "Pedidos & Financeiro",
      items: [
        { id: "pedidos", label: "Pedidos", icon: ListPlus },
        { id: "cobranca", label: "Cobrança", icon: DollarSign },
      ],
    },
    {
      label: "Monitoramento",
      items: [
        { id: "analise-judit", label: "Análise Judit", icon: Sparkles },
        { id: "partes", label: "Partes", icon: Users },
      ],
    },
    {
      label: "Distribuições",
      items: [
        { id: "distribuicoes-tst", label: "Distribuições", icon: Scale },
      ],
    },
    {
      label: "Interação",
      items: [
        { id: "comentarios", label: "Comentários", icon: MessageSquare },
      ],
    },
  ];
  // Lista achatada (compatibilidade com lógica que dependia de navItems)
  const navItems = navGroups.flatMap((g) => g.items);

  const getAudienciaStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      pendente: { className: "bg-amber-100 text-amber-700", label: "Pendente" },
      confirmada: { className: "bg-emerald-100 text-emerald-700", label: "Confirmada" },
      realizada: { className: "bg-blue-100 text-blue-700", label: "Realizada" },
      cancelada: { className: "bg-red-100 text-red-700", label: "Cancelada" },
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge className={cn("text-xs", config.className)}>{config.label}</Badge>;
  };

  const getIntimacaoStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      pendente: { className: "bg-amber-100 text-amber-700", label: "Pendente" },
      em_andamento: { className: "bg-blue-100 text-blue-700", label: "Em andamento" },
      tratada: { className: "bg-emerald-100 text-emerald-700", label: "Tratada" },
      ignorada: { className: "bg-zinc-100 text-zinc-700", label: "Ignorada" },
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge className={cn("text-xs", config.className)}>{config.label}</Badge>;
  };

  return (
    <div className="processo-chrome min-h-screen bg-background">
      {/* Main Content - Sidebar + Content */}
      <div className="flex min-h-0 flex-col sm:flex-row min-w-0">
        {/* Sidebar Navigation - Horizontal scrollable on mobile, vertical on desktop */}
        <aside className="w-full sm:w-44 md:w-52 border-b sm:border-b-0 sm:border-r border-border bg-muted/30 flex-shrink-0 sm:min-h-0 sm:self-start">

          {/* Mobile: horizontal scroll, agrupado por categoria com separadores */}
          <div className="sm:hidden overflow-x-auto pb-1">
            <nav className="flex items-center gap-1 px-2 py-2 min-w-max">
              <button
                onClick={onVoltar}
                className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-md whitespace-nowrap bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3 h-3 flex-shrink-0" />
                <span>Voltar</span>
              </button>
              <span className="text-muted-foreground/40 px-1">|</span>
              {navGroups.map((group, gi) => (
                <div key={group.label} className="flex items-center gap-1">
                  {gi > 0 && <span className="text-muted-foreground/40 px-1">|</span>}
                  {group.items.map((item) => (
                    (() => {
                      const destacarJudit = juditNovoDestaque && item.id === "analise-judit";
                      return (
                    <button
                      key={item.id}
                      onClick={() => handleSectionChange(item.id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-md whitespace-nowrap transition-colors",
                        destacarJudit
                          ? "bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                          : activeSection === item.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("w-3 h-3 flex-shrink-0", !destacarJudit && activeSection !== item.id && item.iconColor)} />
                      <span className={cn(!destacarJudit && activeSection !== item.id && juditSecoes[item.id] && "text-emerald-600 dark:text-emerald-400 font-semibold")}>{item.label}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <Badge variant="secondary" className="ml-1 text-[8px] h-3.5 px-1 min-w-[14px] flex items-center justify-center bg-background/80">
                          {item.count}
                        </Badge>
                      )}
                    </button>
                      );
                    })()
                  ))}
                </div>
              ))}
            </nav>
          </div>
          {/* Desktop: vertical sidebar agrupado estilo Projuris */}
          <ScrollArea className="hidden sm:block h-[calc(100vh-112px)] sticky top-0">
            <nav className="py-2">
              <button
                onClick={onVoltar}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-left text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors mb-1 border-b"
              >
                <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Voltar</span>
              </button>
              {navGroups.map((group) => (
                <div key={group.label} className="mb-1">
                  <p className="px-3 pt-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    (() => {
                      const destacarJudit = juditNovoDestaque && item.id === "analise-judit";
                      return (
                    <button
                      key={item.id}
                      onClick={() => handleSectionChange(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-wide text-left transition-colors",
                        destacarJudit
                          ? "bg-emerald-600 text-white border-y border-emerald-700 font-semibold hover:bg-emerald-700"
                          : activeSection === item.id
                          ? "bg-background text-primary border-y border-border font-semibold"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("w-3.5 h-3.5 flex-shrink-0", !destacarJudit && activeSection !== item.id && item.iconColor)} />
                      <span className={cn("truncate", !destacarJudit && activeSection !== item.id && juditSecoes[item.id] && "text-emerald-600 dark:text-emerald-400 font-semibold")}>{item.label}</span>

                      {item.count !== undefined && item.count > 0 && (
                        <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1 min-w-[16px] flex items-center justify-center">
                          {item.count}
                        </Badge>
                      )}
                    </button>
                      );
                    })()
                  ))}
                </div>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0 min-h-0">
          {/*
            No mobile, evitamos criar um scroll container próprio (ScrollArea) com altura fixa.
            Isso reduz conflitos de gesto com scrolls horizontais aninhados (ex.: tabela de Pedidos).
            No desktop mantemos a altura fixa para scroll interno.
          */}
          {/*
            Evita ScrollArea (Radix) no conteúdo para não capturar gestos no mobile.
            No desktop mantemos scroll interno via overflow-y-auto + altura fixa.
          */}
          <div className={cn("min-h-0", novoItemTipo ? "p-0" : "p-3 sm:p-4")}>
              {/* Painel unificado (mesmo do Painel de Controle) — sobrepõe o conteúdo */}
              {novoItemTipo && (
                <div className="min-h-0">
                  <NovoItemPanel
                    tipo={novoItemTipo}
                    embedded
                    itemParaEditar={itemParaEditar}
                    processoPreSelecionado={processoPreSelecionado}
                    onClose={fecharNovoItem}
                    onSuccess={invalidarAposSalvar}
                  />
                </div>
              )}
              {!novoItemTipo && (<>
              {/* Toolbar global de ações Judit — ocultada temporariamente */}
              {/* Resumo Section - Visão geral rápida */}
              {/* Visão Geral — formulário único editável (Resumo + Detalhes + Envolvidos) */}
              {activeSection === "resumo" && (
                <ProcessoVisaoGeralForm
                  ref={visaoGeralRef}
                  processo={processo}
                  audiencias={audiencias}
                  intimacoes={intimacoes}
                  tarefas={tarefas}
                  movimentacoes={movimentacoes}
                  eventosAgenda={eventosAgenda}
                  onNavigate={handleSectionChange}
                  onAddItem={abrirNovoItem}
                  onNumeroChange={onNumeroChange}
                  modoCaso={modoCaso}
                  onJuditNovoPreenchido={() => setJuditNovoDestaque(true)}
                  hideJuditButtons
                />
              )}

              {/* Audiências Section */}
              {activeSection === "audiencias" && (
                <div className="space-y-3">
                  {audienciaSelecionadaAtual ? (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAudienciaSelecionada(null)}
                        >
                          <ArrowLeft className="w-4 h-4 mr-1" />
                          Voltar para audiências
                        </Button>
                      </div>
                      <div className="px-4 sm:px-6 py-4 border rounded-lg bg-card">
                        <AudienciaFormSimplificado
                          showProcessoField={false}
                          defaultProcessoId={processo?.id}
                          defaultProcessoNumero={processo?.numero}
                          audienciaParaEditar={audienciaSelecionadaAtual}
                          invalidateKey={audienciaInvalidateKey ?? ['audiencias-processo', processo?.id]}
                          onSuccess={() => setAudienciaSelecionada(null)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Gavel className="w-4 h-4" />
                          Audiências
                        </h3>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirNovoItem("audiencia")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar Audiência
                        </Button>
                      </div>
                      {loadingAudiencias ? (
                        <div className="space-y-3">
                          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                        </div>
                      ) : audiencias.length > 0 ? (
                        <div className="space-y-3">
                          {audiencias.map((aud) => (
                            <Card
                              key={aud.id}
                              role="button"
                              tabIndex={0}
                              className="cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => setAudienciaSelecionada(aud)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setAudienciaSelecionada(aud);
                                }
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b">
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Gavel className="h-4 w-4 text-primary shrink-0" />
                                      <span className="font-mono text-sm font-semibold text-foreground truncate">
                                        {aud.processo_numero || processo?.numero || 'Processo sem número'}
                                      </span>
                                      {aud.tipo_audiencia && (
                                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                          {aud.tipo_audiencia}
                                        </Badge>
                                      )}
                                      {aud.modalidade && (
                                        <Badge variant="outline" className="text-[10px] capitalize">
                                          {aud.modalidade}
                                        </Badge>
                                      )}
                                    </div>
                                    {aud.titulo && (
                                      <p className="text-sm font-medium text-foreground break-words">
                                        {aud.titulo}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                                      {aud.created_at && <span>Registrada em {formatDate(aud.created_at)}</span>}
                                      {aud.origem && <span className="capitalize">Origem: {aud.origem}</span>}
                                    </div>
                                  </div>
                                  <SituacaoAudienciaBadge status={aud.status} />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</p>
                                    <p className="font-medium text-foreground">{aud.data_audiencia ? formatDate(aud.data_audiencia) : '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hora</p>
                                    <p className="font-medium text-foreground">
                                      {[aud.hora, aud.hora_fim].filter(Boolean).join(' às ') || aud.hora_brasilia || aud.hora_local || '—'}
                                    </p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vara / Câmara</p>
                                    <p className="font-medium text-foreground truncate">{aud.vara_camara || '—'}</p>
                                  </div>
                                  {(aud.comarca || aud.forum || aud.local_audiencia) && (
                                    <div className="col-span-2">
                                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Local</p>
                                      <p className="font-medium text-foreground truncate">
                                        {[aud.local_audiencia, aud.forum, aud.comarca].filter(Boolean).join(' • ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <AudienciaResponsaveisResumo audienciaId={aud.id} className="mt-3 pt-3 border-t" />
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <AudienciaPublicacaoVinculada audienciaId={aud.id} className="mt-3" />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Gavel className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Nenhuma audiência</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Intimações Section */}
              {activeSection === "intimacoes" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Intimações
                    </h3>
                  </div>
                  {loadingIntimacoes ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                    </div>
                  ) : intimacoes.length > 0 ? (
                    <div className="space-y-2">
                      {intimacoes.map((int) => (
                        <Card 
                          key={int.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => onSelectIntimacao?.(int)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  {getIntimacaoStatusBadge(int.status)}
                                </div>
                                {int.descricao && (
                                  <p className="text-sm line-clamp-2">{int.descricao}</p>
                                )}
                                {int.data_limite && (
                                  <p className="text-xs text-destructive flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Prazo: {formatDate(int.data_limite)}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma intimação</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tarefas Section */}
              {activeSection === "tarefas" && (
                <div className="space-y-3">
                  {selectedTarefaId ? (
                    <TarefaPublicacaoView
                      tarefaId={selectedTarefaId}
                      processoId={processo.id}
                      onVoltar={() => onVoltarTarefa?.()}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <ListTodo className="w-4 h-4" />
                          Tarefas
                        </h3>
                        <Button 
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                          onClick={() => abrirNovoItem("tarefa")}
                        >
                          Adicionar Tarefa
                        </Button>
                      </div>
                      {loadingTarefas ? (
                        <div className="space-y-3">
                          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                        </div>
                      ) : tarefasSemPrazo.length > 0 ? (
                        <div className="space-y-2">
                          {tarefasSemPrazo.map((tarefa: any) => (
                            <Card 
                              key={tarefa._ocorrencia_id || tarefa.id}
                              className="hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => abrirNovoItem("tarefa", tarefa._registro_pai || tarefa)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium">{tarefa.titulo}</p>
                                    {tarefa.descricao && (
                                      <p className="text-xs text-muted-foreground line-clamp-1">{tarefa.descricao}</p>
                                    )}
                                    {(tarefa.processo?.numero || processo?.numero) && (
                                      <p className="text-[11px] font-mono text-muted-foreground">
                                        Processo: {tarefa.processo?.numero || processo?.numero}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {tarefa.data_vencimento && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {formatDate(tarefa.data_vencimento)}
                                        </span>
                                      )}
                                      {(tarefa._responsaveisNomes?.length ?? 0) > 0 && (
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {tarefa._responsaveisNomes.join(", ")}
                                        </span>
                                      )}
                                      {qtdAtividades(tarefa.id) > 0 && (
                                        <span className="flex items-center gap-1 text-emerald-600">
                                          <ListChecks className="h-3 w-3" />
                                          {qtdAtividades(tarefa.id)} atividade{qtdAtividades(tarefa.id) > 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {tarefa.n === 'astrea' && (
                                      <Badge variant="outline" className="text-[10px] whitespace-nowrap border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
                                        Veio do Astrea
                                      </Badge>
                                    )}
                                    <Badge variant={tarefa.status === 'cumprido' ? 'default' : 'secondary'} className="text-xs">
                                      {tarefa.status}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ListTodo className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Nenhuma tarefa</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Documentos/Pasta Section */}
              {activeSection === "documentos" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <FileBox className="w-4 h-4" />
                      Pasta
                    </h3>
                    <Button 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enviando...</>
                      ) : (
                        <><UploadIcon className="w-3 h-3 mr-1" /> Adicionar</>
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handlePastaFileSelect}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.zip"
                    />
                  </div>
                  {uploading && (
                    <div className="mb-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {zipPhase === 'decompressing' ? "📦 Descompactando ZIP..." :
                           zipPhase === 'extracting' ? "📂 Extraindo arquivos..." :
                           zipPhase === 'uploading' ? "📤 Enviando arquivos..." :
                           "📤 Enviando arquivo..."}
                        </span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                  {documentos.length > 0 ? (
                    <div className="space-y-2">
                      {documentos.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between py-2 px-3 border rounded-lg gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">{doc.nome}</span>
                            {doc.analisado_ia && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">IA ✓</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleAnalyzeDocument(doc)}
                              disabled={analyzingDocId === doc.id}
                              title="Analisar com IA e preencher campos do processo"
                            >
                              {analyzingDocId === doc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              {analyzingDocId === doc.id ? 'Analisando...' : 'Analisar IA'}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(doc.url, '_blank')}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={async () => {
                                if (!confirm('Excluir este documento?')) return;
                                const { error } = await supabase.from("documentos").delete().eq("id", doc.id);
                                if (error) { sonnerToast.error("Erro ao excluir documento"); return; }
                                sonnerToast.success("Documento excluído");
                                queryClient.invalidateQueries({ queryKey: ["documentos-processo", processo?.id] });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileBox className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum documento</p>
                    </div>
                  )}
                </div>
              )}

              {/* Pedidos Trabalhistas Section */}
              {activeSection === "pedidos" && (
                <ProcessoPedidosTab processo={processo} />
              )}

              {/* TST Section */}
              {activeSection === "tst" && (
                <ProcessoTstTab processo={processo} />
              )}

              {/* Distribuições TST Section */}
              {activeSection === "distribuicoes-tst" && (
                <ProcessoDistribuicoesTab processoId={processo.id} processoNumero={processo.numero || ""} />
              )}

              {/* Prazo Section - campos da planilha TST - edição inline */}
              {activeSection === "prazo" && (
                <div className="space-y-4">
                  {/* Lista de prazos (tarefas tipo PRAZO) criados via "Adicionar" */}
                  {selectedTarefaId ? (
                    <TarefaPublicacaoView
                      tarefaId={selectedTarefaId}
                      processoId={processo.id}
                      onVoltar={() => onVoltarTarefa?.()}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Prazos
                        </h3>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                          onClick={() => abrirNovoItem("prazo")}
                        >
                          Adicionar Prazo
                        </Button>
                      </div>
                      {loadingTarefas ? (
                        <div className="space-y-3">
                          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                        </div>
                      ) : prazosDoProcesso.length > 0 ? (
                        <div className="space-y-2">
                          {prazosDoProcesso.map((tarefa: any) => (
                            <Card
                              key={tarefa._ocorrencia_id || tarefa.id}
                              className="hover:shadow-md transition-shadow cursor-pointer border-l-[3px] border-l-destructive"
                              onClick={() => abrirNovoItem("prazo", tarefa._registro_pai || tarefa)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium">{tarefa.titulo}</p>
                                    {tarefa.descricao && (
                                      <p className="text-xs text-muted-foreground line-clamp-1">{tarefa.descricao}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {tarefa.data_vencimento && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          Limite: {formatDate(tarefa.data_vencimento)}
                                        </span>
                                      )}
                                      {tarefa.data_fatal && (
                                        <span className="flex items-center gap-1 text-destructive">
                                          <AlertTriangle className="h-3 w-3" />
                                          Fatal: {formatDate(tarefa.data_fatal)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {tarefa.n === 'astrea' && (
                                      <Badge variant="outline" className="text-[10px] whitespace-nowrap border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
                                        Veio do Astrea
                                      </Badge>
                                    )}
                                    <Badge variant={tarefa.status === 'cumprido' ? 'default' : 'secondary'} className="text-xs">
                                      {tarefa.status}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          Nenhum prazo cadastrado para este processo
                        </div>
                      )}
                      <div className="pt-2 border-t mt-4">
                      <PrazoSectionEditable processo={processo} />
                      </div>
                    </>
                  )}
                </div>
              )}


              {activeSection === "publicacoes" && (
                <PublicacoesDjenList
                  publicacoes={publicacoesDjen}
                  loading={loadingPublicacoes}
                  processoId={processo?.id}
                />
              )}

              {/* Andamentos Section */}
              {activeSection === "andamentos" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Andamentos
                    </h3>
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      Atualizar
                    </Button>
                  </div>
                  {(processo as any)?.acompanhamento_especial && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        ✨ Novidades do Acompanhamento Especial
                      </p>
                      <AcompanhamentoEspecialEventos processoId={processo.id} limit={10} />
                    </div>
                  )}
                  {movimentacoes.length > 0 ? (
                    <div className="space-y-2">
                      {movimentacoes.map((mov: any) => (
                        <div key={mov.id} className={`border-l-2 pl-3 py-2 ${mov.fonte === "judit" ? "border-emerald-500/60" : "border-blue-500/50"}`}>
                          <p className={`text-xs ${mov.fonte === "judit" ? "text-emerald-700/80 dark:text-emerald-400/80" : "text-muted-foreground"}`}>
                            {formatDate(mov.data_movimentacao)}
                            {mov.fonte === "judit" && <span className="ml-2 uppercase text-[10px]">judit</span>}
                          </p>
                          <p className={`text-sm ${mov.fonte === "judit" ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{mov.descricao}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum andamento</p>
                    </div>
                  )}
                </div>
              )}

              {/* Redistribuições Section */}
              {activeSection === "redistribuicoes" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      Redistribuições
                    </h3>
                  </div>
                  {redistribuicoes.length > 0 ? (
                    <div className="space-y-2">
                      {redistribuicoes.map((red: any) => (
                        <div key={red.id} className="border-l-2 border-amber-500/50 pl-3 py-2">
                          <p className="text-xs text-muted-foreground">{formatDate(red.data_movimentacao)}</p>
                          <p className="text-sm">{red.descricao}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Shuffle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma redistribuição</p>
                    </div>
                  )}
                </div>
              )}

              {/* Monitoramento 360 Section */}
              {activeSection === "monitoramento360" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Radar className="w-4 h-4" />
                      Monitoramento 360°
                    </h3>
                  </div>
                  {alertas360Unicos.length > 0 ? (
                    <div className="space-y-2">
                      {alertas360Unicos.map((alerta: any) => (
                          <Card key={alerta.id} className="hover:shadow-sm transition-shadow border-l-2" style={{
                            borderLeftColor: alerta.prioridade === "alta" ? "hsl(var(--destructive))" :
                              alerta.prioridade === "media" ? "hsl(45 93% 47%)" : "hsl(var(--muted-foreground))"
                          }}>
                            <CardContent className="p-3">
                              {/* Header: Badges + Data da movimentação */}
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Badge className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    alerta.prioridade === "alta" ? "bg-red-100 text-red-700" :
                                    alerta.prioridade === "media" ? "bg-amber-100 text-amber-700" :
                                    "bg-zinc-100 text-zinc-700"
                                  )}>
                                    {alerta.prioridade}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {alerta.status}
                                  </Badge>
                                  {alerta.termo?.categoria && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      {alerta.termo.categoria}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {alerta.movimentacao?.data_movimentacao 
                                    ? formatDate(alerta.movimentacao.data_movimentacao)
                                    : formatDate(alerta.created_at)}
                                </span>
                              </div>
                              
                              {/* Termo encontrado em destaque */}
                              <p className="text-sm font-medium text-foreground">
                                Termo: <span className="text-primary">{alerta.termo_encontrado}</span>
                              </p>
                              
                              {/* Movimentação DataJud/CNJ onde foi encontrado */}
                              {alerta.movimentacao && (
                                <div className="mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Activity className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] font-medium text-primary">
                                      {alerta.movimentacao.fonte || 'Movimentação'}
                                    </span>
                                    {alerta.movimentacao.data_movimentacao && (
                                      <span className="text-[10px] text-muted-foreground ml-auto">
                                        {formatDate(alerta.movimentacao.data_movimentacao)}
                                      </span>
                                    )}
                                  </div>
                                  {alerta.movimentacao.tipo && (
                                    <p className="text-xs font-medium text-foreground mb-0.5">
                                      {alerta.movimentacao.tipo}
                                    </p>
                                  )}
                                  {alerta.movimentacao.descricao && (
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                      {alerta.movimentacao.descricao}
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {/* Publicação DJEN relacionada (se encontrada) */}
                              {alerta.publicacao_relacionada && (
                                <div className="mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Newspaper className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] font-medium text-primary">Publicação DJEN</span>
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                      {formatDate(alerta.publicacao_relacionada.data_publicacao)}
                                    </span>
                                  </div>
                                  {alerta.publicacao_relacionada.resumo_ia ? (
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                      {alerta.publicacao_relacionada.resumo_ia}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                      {alerta.publicacao_relacionada.conteudo}
                                    </p>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum alerta</p>
                    </div>
                  )}
                </div>
              )}

              {/* Agenda Section */}
              {activeSection === "agenda" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      Eventos
                    </h3>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                      onClick={() => abrirNovoItem("evento")}
                    >
                      Adicionar Evento
                    </Button>
                  </div>
                  {eventosDoProcesso.length > 0 ? (
                    <div className="space-y-2">
                      {eventosDoProcesso.map((evento: any) => (
                        <EventoProcessoCard
                          key={evento.id}
                          evento={evento}
                          pessoas={eventosPessoas[evento.id]}
                          onClick={() => abrirNovoItem("evento", evento)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum evento</p>
                    </div>
                  )}
                </div>
              )}

              {/* Portal Section */}
              {activeSection === "portal" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Portal do Tribunal
                    </h3>
                  </div>
                  <BaixarAutosButton
                    processoId={processo?.id}
                    processoNumero={processo?.numero}
                    tribunal={processo?.tribunal}
                  />
                </div>
              )}

              {activeSection === "parcelamento" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      Parcelamento recorrente
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirNovoItem("parcelamento")}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Parcelamento
                    </Button>
                  </div>
                  {parcelamentosDoProcesso.length > 0 ? (
                    <div className="space-y-2">
                      {parcelamentosDoProcesso.map((parcelamento: any) => (
                        <Card
                          key={parcelamento.id}
                          className="hover:shadow-md transition-shadow cursor-pointer border-l-[3px] border-l-emerald-500"
                          onClick={() => abrirNovoItem("parcelamento", parcelamento)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1 min-w-0">
                                <p className="text-sm font-medium truncate">{parcelamento.titulo}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDateTime(parcelamento.data_inicio)}
                                </p>
                                {parcelamento.descricao && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">{parcelamento.descricao}</p>
                                )}
                              </div>
                              <Badge variant={parcelamento.status === "concluido" ? "default" : "secondary"} className="text-xs shrink-0">
                                {parcelamento.status || "pendente"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Coins className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum parcelamento recorrente</p>
                    </div>
                  )}
                </div>
              )}

              {/* Cobrança Section */}
              {activeSection === "cobranca" && (
                <CobrancaSection processo={processo} formatDate={formatDate} />
              )}

              {/* Análise Judit (mesmo painel da Distribuição TST) */}
              {activeSection === "analise-judit" && processo?.numero && (
                <Tabs defaultValue="analise" className="w-full">
                  <TabsList>
                    <TabsTrigger value="analise">Análise</TabsTrigger>
                    <TabsTrigger value="anexos">Anexos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="analise" className="mt-3">
                    <AnaliseJuditTab
                      processoNumero={processo.numero}
                      onPreencherFormulario={async (presetData?: any) => {
                        // O formulário só existe quando a aba "Visão Geral" está
                        // montada. Navega para lá e aguarda o mount do form
                        // antes de chamar o preencher, com polling curto para
                        // garantir que o ref esteja atribuído.
                        handleSectionChange("resumo");
                        for (let i = 0; i < 30 && !visaoGeralRef.current; i++) {
                          await new Promise((r) => setTimeout(r, 50));
                        }
                        if (!visaoGeralRef.current) {
                          sonnerToast.error(
                            "Não foi possível abrir o formulário Visão Geral. Tente novamente."
                          );
                          return;
                        }
                        await visaoGeralRef.current.preencherFormularioJudit(false, presetData);
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="anexos" className="mt-3">
                    <ProcessoAnexosJuditTab processoNumero={processo.numero} processoId={processo.id} />
                  </TabsContent>
                </Tabs>
              )}

              {/* Partes do processo (mesma listagem da Distribuição TST) */}
              {activeSection === "partes" && processo?.id && (
                <ProcessoPartesTab processoId={processo.id} />
              )}

              {/* Auditoria — histórico completo de ações do processo e itens vinculados */}
              {activeSection === "auditoria" && (
                <ProcessoAuditoriaTab processoId={processo?.id} processoNumero={processo?.numero} />
              )}

              {/* Comentários Section */}
              {activeSection === "comentarios" && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comentários
                  </h3>
                  <div className="space-y-3">
                    <div className="text-right text-xs text-muted-foreground">
                      2000 caracteres restantes
                    </div>
                    <Textarea 
                      placeholder="Utilize o @ antes de um nome para citar outros usuários do sistema."
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <Button className="bg-zinc-700 hover:bg-zinc-800 text-white text-sm">
                      Comentar
                    </Button>
                  </div>
                </div>
              )}
              </>)}
            </div>
        </div>
      </div>
      {/* AI Analysis Dialog */}
      <AnaliseDocumentoDialog
        open={analiseDialogOpen}
        onOpenChange={setAnaliseDialogOpen}
        analise={analiseResult}
        processo={processo}
        onConfirm={handleAnaliseConfirm}
        onSkip={() => {
          setAnaliseDialogOpen(false);
          sonnerToast.success("Documento enviado com sucesso!");
        }}
      />
    </div>
  );
}
