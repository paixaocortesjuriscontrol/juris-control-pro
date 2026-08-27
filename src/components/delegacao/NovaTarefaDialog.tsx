import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import { situacoesDisponiveis } from "@/constants/situacoesItem";
import { usePermissoesSituacao } from "@/hooks/usePermissoesSituacao";
import { ModeloTituloPicker } from "@/components/modelos/ModeloTituloPicker";
import { EtiquetaPicker } from "@/components/etiquetas/EtiquetaPicker";
import { resolverPadroes, resolverPrazoModelo } from "@/lib/aplicarPadroesModelo";
import { usePodeCancelarItens } from "@/hooks/usePodeCancelarItens";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrlOrEmpty } from "@/utils/signedUrl";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
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
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { ItemAbas } from "@/components/comum/ItemAbas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Upload, FileText, Trash2, Sparkles, CheckCircle2, Eye, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { useCoordenadoresDaCoordenacao, useEnvolvidosFixosDaCoordenacao } from "@/hooks/useCoordenadoresDaCoordenacao";
import { Label } from "@/components/ui/label";
import { TarefaPublicacaoVinculada } from "@/components/shared/TarefaPublicacaoVinculada";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { BotaoPreencherIA } from "@/components/tarefas/BotaoPreencherIA";
import { AlertasConfigCard } from "@/components/shared/AlertasConfigCard";
import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { parseDataPublicacaoLocal } from "@/utils/formatConteudo";
import { ensureProcessoFromPublicacao } from "@/lib/ensureProcessoFromPublicacao";

type AnexoComAnalise = {
  file?: File;
  // Para documentos já salvos (modo edição)
  id?: string;
  nome?: string;
  tamanho_bytes?: number;
  url?: string;
  uploaded?: boolean;
};

function addBusinessDays(start: Date, days: number): Date {
  let remaining = days;
  const d = new Date(start);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

function computeDataPrevista(base: string | undefined, dias: number, unidade: "uteis" | "corridos"): string {
  if (!base || !dias || dias <= 0) return "";
  const [y, m, d] = base.split("-").map(Number);
  if (!y || !m || !d) return "";
  const baseDate = new Date(y, m - 1, d, 12, 0, 0);
  const result = unidade === "uteis" ? addBusinessDays(baseDate, dias) : addDays(baseDate, dias);
  return format(result, "yyyy-MM-dd");
}

const formSchema = z.object({
  tipo_vinculo: z.enum(["processo", "sem_vinculo"]),
  coordenacao_id: z.string().optional(),
  processo_id: z.string().optional(),
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value?: string | null) {
  const trimmed = (value || "").trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

function normalizeUuidList(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeUuid(value)).filter(Boolean))) as string[];
}

interface NovaTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacoes: Array<{ id: string; nome: string; area: string }>;
  onSuccess?: () => void;
  processoPreSelecionado?: { id: string; numero: string } | null;
  tarefaParaEditar?: any | null;
  inline?: boolean;
  /** Quando true (em conjunto com `inline`), usa fluxo natural sem scroll interno. */
  embedded?: boolean;
  publicacao?: PublicacaoUnificada | null;
  onCreated?: (tarefaId: string) => void | Promise<void>;
  /**
   * Botão extra ao lado de "Salvar". Se definido, exibe um segundo botão
   * (ex.: "Salvar e ler") que dispara o mesmo submit e, em caso de sucesso,
   * chama `onAfterSuccess` antes de fechar o diálogo.
   */
  secondarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  /**
   * Botão adicional (ex.: "Salvar e fechar" na Análise DJEN). Renderizado
   * como um terceiro botão no rodapé.
   */
  tertiarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  /**
   * Chamado após criar (não editar) a tarefa com sucesso. Recebe id e título.
   * Usado pela Análise DJEN para popular o card verde "Itens criados a partir
   * desta publicação".
   */
  onAfterCreate?: (info: { id: string; titulo: string }) => void;
}

export function NovaTarefaDialog({
  open,
  onOpenChange,
  coordenacoes,
  onSuccess,
  processoPreSelecionado,
  tarefaParaEditar,
  inline = false,
  embedded = false,
  publicacao = null,
  onCreated,
  secondarySave,
  tertiarySave,
  onAfterCreate,
}: NovaTarefaDialogProps) {
  const [loading, setLoading] = useState(false);
  const secondaryClickedRef = useRef(false);
  /** Padrões aplicados pelo último modelo escolhido (para limpar ao trocar) */
  const modeloPadroesRef = useRef<Record<string, string> | null>(null);
  const tertiaryClickedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const [searchProcesso, setSearchProcesso] = useState("");
  const [anexos, setAnexos] = useState<AnexoComAnalise[]>([]);
  const [uploadingAnexos, setUploadingAnexos] = useState(false);
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const [mostrarEnvolvidos, setMostrarEnvolvidos] = useState(false);
  const [situacao, setSituacao] = useState<string>("pendente");
  const { podeCancelar } = usePodeCancelarItens();
  // Recorrência
  const [recorrenciaTipo, setRecorrenciaTipo] = useState<string>("nenhuma");
  const [prazoDias, setPrazoDias] = useState<number>(0);
  const [prazoUnidade, setPrazoUnidade] = useState<"uteis" | "corridos">("uteis");
  const [recorrenciaIntervalo, setRecorrenciaIntervalo] = useState<number>(1);
  const [recorrenciaOcorrencias, setRecorrenciaOcorrencias] = useState<string>("");
  const [recorrenciaFim, setRecorrenciaFim] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { precisaSelecionar, unicaCoordenacaoId, coordenacoes: coordenacoesUsuario } = useCoordenacoesDoUsuario();
  // Se a prop não trouxer coordenações (ex.: chamadas antigas), usamos a lista do hook.
  const coordenacoesDisponiveis = (coordenacoes && coordenacoes.length > 0)
    ? coordenacoes
    : coordenacoesUsuario.map((c) => ({ id: c.id, nome: c.nome, area: c.area || "" }));
  
  // Buscar usuário atual para salvar criado_por
  const { data: userData } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    enabled: open,
  });

  // Data base = data da PUBLICAÇÃO (data_publicacao); na falta dela,
  // a data de disponibilização; sem publicação vinculada, hoje.
  const dataBaseInicial = (() => {
    const pub = parseDataPublicacaoLocal((publicacao as any)?.data_publicacao);
    const disp = parseDataPublicacaoLocal((publicacao as any)?.data_disponibilizacao);
    return format(pub || disp || new Date(), "yyyy-MM-dd");
  })();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_vinculo: "processo",
      coordenacao_id: "",
      processo_id: processoPreSelecionado?.id || "",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      data_base: dataBaseInicial,
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
  const { data: coordenadoresIds = [] } = useCoordenadoresDaCoordenacao(coordenacaoId || null, "TAREFA EQUIPE");
  const { podeUsarSituacao, situacaoAtiva } = usePermissoesSituacao(coordenacaoId || null, "TAREFA");
  // Envolvidos fixos configurados na coordenação para este tipo
  const { data: envolvidosFixosIds = [] } = useEnvolvidosFixosDaCoordenacao(coordenacaoId || null, "TAREFA EQUIPE");
  // Reaplica os fixos sempre que faltar algum (o reset do formulário pode
  // ocorrer depois do carregamento dos fixos e limpar a seleção).
  useEffect(() => {
    if (!open || envolvidosFixosIds.length === 0) return;
    const faltando = envolvidosFixosIds.filter((id) => !envolvidosIds.includes(id));
    if (faltando.length === 0) return;
    setMostrarEnvolvidos(true);
    setEnvolvidosIds((prev) => Array.from(new Set([...prev, ...envolvidosFixosIds])));
  }, [open, JSON.stringify(envolvidosFixosIds), JSON.stringify(envolvidosIds)]);
  useEffect(() => {
    if (!open || coordenadoresIds.length === 0) return;
    const faltando = coordenadoresIds.filter((id) => !responsaveisIds.includes(id));
    if (faltando.length === 0) return;
    setResponsaveisIds((prev) => {
      const novos = Array.from(new Set([...prev, ...coordenadoresIds]));
      if (!form.getValues("responsavel_id")) form.setValue("responsavel_id", novos[0]);
      return novos;
    });
  }, [open, JSON.stringify(coordenadoresIds), JSON.stringify(responsaveisIds)]);
  const forcarVinculoPublicacao = !!publicacao;

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
        // Busca tolerante a máscara CNJ: usa apenas dígitos para comparar com numero
        const digits = searchProcesso.replace(/\D/g, "");
        const numeroFilter = digits.length >= 3 ? `numero.ilike.%${digits}%,` : "";
        query = query.or(`${numeroFilter}polo_ativo.ilike.%${searchProcesso}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: tipoVinculo === "processo" && (!!coordenacaoId || searchProcesso.length >= 3),
  });

  // Reset form when dialog opens — preenche para edição ou para nova
  useEffect(() => {
    if (!open) return;
    (async () => {
      if (tarefaParaEditar) {
        // Buscar coordenação a partir do processo (se houver)
        let processoId = normalizeUuid(tarefaParaEditar.processo_id);
        let coordenacaoId = "";
        let processoNumero = "";
        if (!processoId) {
          const { data: vinculoProc } = await supabase
            .from("tarefas_publicacoes_processos")
            .select("publicacao_processo_id")
            .eq("tarefa_id", tarefaParaEditar.id)
            .maybeSingle();

          if (vinculoProc?.publicacao_processo_id) {
            const { data: pubProc } = await supabase
              .from("publicacoes_djen_processos")
              .select("processo_id, processo_numero, coordenacao_id")
              .eq("id", vinculoProc.publicacao_processo_id)
              .maybeSingle();
            processoId = normalizeUuid((pubProc as any)?.processo_id);
            processoNumero = (pubProc as any)?.processo_numero || "";
            coordenacaoId = normalizeUuid((pubProc as any)?.coordenacao_id) || "";
          }
        }

        if (!processoId) {
          const { data: vinculoTermo } = await supabase
            .from("tarefas_publicacoes")
            .select("publicacao_id")
            .eq("tarefa_id", tarefaParaEditar.id)
            .maybeSingle();

          if (vinculoTermo?.publicacao_id) {
            const { data: pub } = await supabase
              .from("publicacoes_djen")
              .select("processo_numero, coordenacao_id")
              .eq("id", vinculoTermo.publicacao_id)
              .maybeSingle();
            processoNumero = (pub as any)?.processo_numero || processoNumero;
            coordenacaoId = normalizeUuid((pub as any)?.coordenacao_id) || coordenacaoId;
          }
        }

        if (!processoId && processoNumero) {
          const digits = processoNumero.replace(/\D/g, "");
          const pattern = digits.length >= 6 ? `%${digits.split("").join("%")}%` : `%${processoNumero}%`;
          let procQuery = supabase
            .from("processos")
            .select("id, coordenacao_id, numero")
            .ilike("numero", pattern)
            .limit(1);
          if (coordenacaoId) procQuery = procQuery.eq("coordenacao_id", coordenacaoId);
          const { data: procs } = await procQuery;
          const proc = procs?.[0] as any;
          processoId = normalizeUuid(proc?.id);
          coordenacaoId = normalizeUuid(proc?.coordenacao_id) || coordenacaoId;
          processoNumero = proc?.numero || processoNumero;
        }

        if (processoId) {
          const { data: proc } = await supabase
            .from("processos")
            .select("coordenacao_id, numero")
            .eq("id", processoId)
            .maybeSingle();
          coordenacaoId = proc?.coordenacao_id || coordenacaoId;
          processoNumero = proc?.numero || processoNumero;
        }
        const { data: resps } = await supabase
          .from("tarefa_responsaveis")
          .select("usuario_id")
          .eq("tarefa_id", tarefaParaEditar.id);
        const respIds = (resps || []).map((r: any) => r.usuario_id).filter(Boolean);
        const responsavelPrincipal = respIds[0] || tarefaParaEditar.responsavel_id || "";
        form.reset({
          tipo_vinculo: processoId ? "processo" : "sem_vinculo",
          coordenacao_id: coordenacaoId,
          processo_id: processoId || "",
          titulo: tarefaParaEditar.titulo || "",
          descricao: tarefaParaEditar.descricao || "",
          responsavel_id: responsavelPrincipal,
          data_base: tarefaParaEditar.data_base || "",
          data_vencimento: tarefaParaEditar.data_vencimento || "",
          hora_prevista: tarefaParaEditar.hora_prevista || "",
          data_fatal: tarefaParaEditar.data_fatal || "",
          hora_fatal: tarefaParaEditar.hora_fatal || "",
          prioridade: tarefaParaEditar.prioridade || "media",
          local: tarefaParaEditar.link_local || tarefaParaEditar.local || "",
        });
        setSearchProcesso(processoNumero);
        setResponsaveisIds(respIds.length > 0 ? respIds : responsavelPrincipal ? [responsavelPrincipal] : []);
        setSituacao((tarefaParaEditar.status as any) || "pendente");
        setRecorrenciaTipo((tarefaParaEditar as any).recorrencia_tipo || "nenhuma");
        setRecorrenciaIntervalo((tarefaParaEditar as any).recorrencia_intervalo || 1);
        setRecorrenciaFim(((tarefaParaEditar as any).recorrencia_fim || "").slice(0, 10));
        setRecorrenciaOcorrencias("");
        // Carregar envolvidos existentes
        const { data: envs } = await supabase
          .from("tarefa_envolvidos")
          .select("usuario_id")
          .eq("tarefa_id", tarefaParaEditar.id);
        const envIds = (envs || []).map((e: any) => e.usuario_id);
        setEnvolvidosIds(envIds);
        setMostrarEnvolvidos(envIds.length > 0);
        // Carregar documentos já anexados a esta tarefa
        const { data: docs } = await supabase
          .from("documentos")
          .select("id, nome, tamanho_bytes, url, categoria, tipo_documento, descricao, tags, confianca_ia, conteudo_extraido, analisado_ia")
          .eq("tarefa_id", tarefaParaEditar.id)
          .order("created_at", { ascending: true });
        if (docs && docs.length > 0) {
          setAnexos(
            docs.map((d: any) => {
              return {
                id: d.id,
                nome: d.nome,
                tamanho_bytes: d.tamanho_bytes,
                url: d.url,
                uploaded: true,
              } as AnexoComAnalise;
            })
          );
        } else {
          setAnexos([]);
        }
        return;
      }
      resetFormForNew();
    })();
  }, [open, processoPreSelecionado, form, coordenacoes, tarefaParaEditar, unicaCoordenacaoId]);

  // Reset do formulário para "nova tarefa". Reutilizado pelo useEffect de
  // abertura e pelo pós-Save quando o wrapper deve continuar aberto para
  // cadastrar outro item (Análise DJEN).
  const resetFormForNew = () => {
    const coordenacaoInicial = unicaCoordenacaoId || (coordenacoesDisponiveis.length === 1 ? coordenacoesDisponiveis[0].id : "");
    form.reset({
      tipo_vinculo: "processo",
      coordenacao_id: coordenacaoInicial,
      processo_id: processoPreSelecionado?.id || "",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      data_base: dataBaseInicial,
      data_vencimento: "",
      hora_prevista: "",
      data_fatal: "",
      hora_fatal: "",
      prioridade: "media",
      local: "",
    });
    setSearchProcesso(processoPreSelecionado?.numero ? aplicarMascaraCnj(processoPreSelecionado.numero) : "");
    setAnexos([]);
    setResponsaveisIds([]);
    setEnvolvidosIds([]);
    setMostrarEnvolvidos(false);
    setSituacao("pendente");
    setRecorrenciaTipo("nenhuma");
    setPrazoDias(0);
    setPrazoUnidade("uteis");
    setRecorrenciaIntervalo(1);
    setRecorrenciaOcorrencias("");
    setRecorrenciaFim("");
  };

  const handleAddAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const novosAnexos: AnexoComAnalise[] = Array.from(files).map(file => ({
        file,
        uploaded: false,
      }));
      setAnexos(prev => [...prev, ...novosAnexos]);
      e.target.value = '';
    }
  };

  const handleRemoveAnexo = async (index: number) => {
    const anexo = anexos[index];
    if (anexo?.uploaded && anexo.id) {
      // Remover documento já salvo
      const { error } = await supabase.from("documentos").delete().eq("id", anexo.id);
      if (error) {
        toast({ title: "Erro ao remover documento", description: error.message, variant: "destructive" });
        return;
      }
    }
    setAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadNovosAnexos = async (tarefaId: string, processoId: string | null) => {
    const pendentes = anexos.filter((a) => !a.uploaded && a.file);
    if (pendentes.length === 0) return;
    setUploadingAnexos(true);
    try {
      const folder = processoId || `tarefas/${tarefaId}`;
      for (const anexo of pendentes) {
        const file = anexo.file!;
        const sanitizedName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${folder}/${Date.now()}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('documentos_processos')
          .upload(fileName, file);
        if (uploadError) {
          console.error("Erro ao fazer upload:", uploadError);
          continue;
        }
        const signedUrl = await getSignedUrlOrEmpty("documentos_processos", fileName);
        await supabase.from('documentos').insert({
          nome: file.name,
          tipo: file.type,
          url: signedUrl,
          tamanho_bytes: file.size,
          processo_id: processoId,
          tarefa_id: tarefaId,
        });
      }
    } finally {
      setUploadingAnexos(false);
    }
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
    // Trava anti-duplo-envio: o `disabled={loading}` só vale após o commit do
    // estado, então dois cliques rápidos (ou header + rodapé) criavam 2 registros.
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setLoading(true);
    try {
      let processoId = values.tipo_vinculo === "processo" ? normalizeUuid(values.processo_id) : null;
      if (publicacao) {
        const uid = userData?.id || (await supabase.auth.getUser()).data.user?.id;
        if (!uid) throw new Error("Usuário não autenticado.");
        const proc = await ensureProcessoFromPublicacao(
          publicacao,
          uid,
          null,
          values.coordenacao_id || publicacao.coordenacao_id || null,
        );
        processoId = normalizeUuid(proc?.id) || processoId;
      }
      if (tarefaParaEditar?.id && !processoId && values.tipo_vinculo === "processo") {
        processoId = normalizeUuid(tarefaParaEditar.processo_id);
      }
      const responsaveisParaSalvar = normalizeUuidList(
        responsaveisIds.length > 0 ? responsaveisIds : [values.responsavel_id],
      );
      // Garante que os envolvidos fixos da coordenação/tipo sempre sejam salvos,
      // mesmo se o estado local tiver sido resetado antes do carregamento deles.
      const envolvidosParaSalvar = normalizeUuidList(
        Array.from(new Set([...envolvidosFixosIds, ...envolvidosIds])),
      );
      const responsavelPrincipal = responsaveisParaSalvar[0];

      if (!responsavelPrincipal) {
        throw new Error("Selecione pelo menos um responsável.");
      }

      if (precisaSelecionar && !values.coordenacao_id) {
        throw new Error("Selecione a coordenação.");
      }

      // Edição
      if (tarefaParaEditar?.id) {
        const updatePayload: Record<string, any> = {
          responsavel_id: responsavelPrincipal,
          titulo: values.titulo,
          descricao: values.descricao || null,
          data_base: values.data_base || null,
          data_vencimento: values.data_vencimento,
          data_fatal: values.data_fatal || null,
          hora_prevista: values.hora_prevista || null,
          hora_fatal: values.hora_fatal || null,
          link_local: values.local || null,
          prioridade: values.prioridade,
          status: situacao as any,
          data_cumprimento: situacao === "cumprido" ? new Date().toISOString() : null,
          recorrente: recorrenciaTipo !== "nenhuma",
          recorrencia_tipo: recorrenciaTipo !== "nenhuma" ? recorrenciaTipo : null,
          recorrencia_intervalo: recorrenciaTipo !== "nenhuma" ? recorrenciaIntervalo : null,
          recorrencia_fim: recorrenciaTipo !== "nenhuma" && recorrenciaFim ? recorrenciaFim : null,
          recorrencia_rrule:
            recorrenciaTipo !== "nenhuma"
              ? `FREQ=${recorrenciaTipo.toUpperCase()};INTERVAL=${recorrenciaIntervalo}${
                  recorrenciaFim ? `;UNTIL=${recorrenciaFim.replace(/-/g, "")}T235959Z` : ""
                }`
              : null,
        };

        if (values.tipo_vinculo === "sem_vinculo") {
          updatePayload.processo_id = null;
        } else if (processoId) {
          updatePayload.processo_id = processoId;
        }
        if (values.coordenacao_id) {
          updatePayload.coordenacao_id = values.coordenacao_id;
        }

        const { error: upErr } = await supabase
          .from("tarefas")
          .update(updatePayload)
          .eq("id", tarefaParaEditar.id);
        if (upErr) throw upErr;
        await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", tarefaParaEditar.id);
        if (responsaveisParaSalvar.length > 0) {
          await supabase.from("tarefa_responsaveis").insert(
            responsaveisParaSalvar.map((uid) => ({ tarefa_id: tarefaParaEditar.id, usuario_id: uid }))
          );
        }
        // Sincronizar envolvidos
        await supabase.from("tarefa_envolvidos").delete().eq("tarefa_id", tarefaParaEditar.id);
        if (envolvidosParaSalvar.length > 0) {
          await supabase.from("tarefa_envolvidos").insert(
            envolvidosParaSalvar.map((uid) => ({ tarefa_id: tarefaParaEditar.id, usuario_id: uid }))
          );
        }
        // Upload de novos anexos adicionados durante a edição
        await uploadNovosAnexos(tarefaParaEditar.id, processoId);
        toast({
          title: "Tarefa atualizada",
          description: "As alterações foram salvas.",
        });
        // Workflow: conclusão desta etapa materializa a próxima imediatamente
        const avancouWorkflow = await sincronizarWorkflowPorItem(
          tarefaParaEditar.id,
          situacao as string
        );
        if (avancouWorkflow) {
          toast({ title: "Próxima etapa do workflow criada" });
        }
        await queryClient.invalidateQueries({ queryKey: ["tarefas"] });
        await queryClient.invalidateQueries({ queryKey: ["lista-atividades"] });
        await queryClient.invalidateQueries({ queryKey: ["agenda-unificada-infinite-v1"] });
        await queryClient.invalidateQueries({ queryKey: ["documentos-tarefa"] });
        await queryClient.invalidateQueries({ queryKey: ["workflow-execucoes"] });
        await queryClient.invalidateQueries({ queryKey: ["workflow-execucao-etapas"] });
        await invalidarItensAgenda(queryClient);
        onOpenChange(false);
        onSuccess?.();
        return;
      }
      // Criar a tarefa primeiro
      const { data: novaTarefa, error } = await supabase.from("tarefas").insert({
        processo_id: processoId,
        coordenacao_id: values.coordenacao_id || null,
        responsavel_id: responsavelPrincipal,
        titulo: values.titulo,
        descricao: values.descricao || null,
        data_base: values.data_base || null,
        data_vencimento: values.data_vencimento,
        data_fatal: values.data_fatal || null,
        hora_prevista: values.hora_prevista || null,
        hora_fatal: values.hora_fatal || null,
        link_local: values.local || null,
        prioridade: values.prioridade,
        status: situacao as any,
        criado_por: userData?.id || null,
        recorrente: recorrenciaTipo !== "nenhuma",
        recorrencia_tipo: recorrenciaTipo !== "nenhuma" ? recorrenciaTipo : null,
        recorrencia_intervalo: recorrenciaTipo !== "nenhuma" ? recorrenciaIntervalo : null,
        recorrencia_fim: recorrenciaTipo !== "nenhuma" && recorrenciaFim ? recorrenciaFim : null,
        recorrencia_rrule:
          recorrenciaTipo !== "nenhuma"
            ? `FREQ=${recorrenciaTipo.toUpperCase()};INTERVAL=${recorrenciaIntervalo}${
                recorrenciaFim ? `;UNTIL=${recorrenciaFim.replace(/-/g, "")}T235959Z` : ""
              }`
            : null,
      }).select("id").single();

      if (error) throw error;

      if (novaTarefa?.id && responsaveisParaSalvar.length > 0) {
        await supabase.from("tarefa_responsaveis").insert(
          responsaveisParaSalvar.map((uid) => ({ tarefa_id: novaTarefa.id, usuario_id: uid }))
        );
      }

      // Inserir envolvidos
      if (novaTarefa?.id && envolvidosParaSalvar.length > 0) {
        await supabase.from("tarefa_envolvidos").insert(
          envolvidosParaSalvar.map((uid) => ({ tarefa_id: novaTarefa.id, usuario_id: uid }))
        );
      }

      // Disparar notificação para o responsável (fire and forget)
      if (novaTarefa?.id && responsavelPrincipal) {
        supabase.functions.invoke("notificar-tarefa-criada", {
          body: {
            tarefa_id: novaTarefa.id,
            titulo: values.titulo,
            descricao: values.descricao,
            data_vencimento: values.data_vencimento,
            prioridade: values.prioridade,
            processo_id: processoId,
            responsavel_id: responsavelPrincipal,
          },
        }).catch((err) => console.log("Erro ao notificar tarefa (ignorado):", err));
      }

      // Upload de anexos (funciona com ou sem processo)
      if (novaTarefa?.id) {
        await uploadNovosAnexos(novaTarefa.id, processoId);
      }

      // Buscar telefone do responsável para enviar WhatsApp
      const { data: responsavel } = await supabase
        .from("profiles")
        .select("nome, telefone")
        .eq("id", responsavelPrincipal)
        .single();

      if (responsavel?.telefone) {
        // Montar mensagem de delegação
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
        mensagem += `📆 Prazo: ${dataFormatada}\n`;
        mensagem += `⚡ Prioridade: ${prioridadeLabel}\n`;
        if (values.descricao) {
          mensagem += `\n📝 *Descrição:*\n${values.descricao}\n`;
        }
        if (anexos.length > 0) {
          mensagem += `\n📎 ${anexos.length} documento(s) anexado(s)\n`;
        }
        mensagem += `\n_JurisControl - Sistema de Gestão Jurídica_`;

        // Enviar WhatsApp (não bloqueia a criação da tarefa)
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
        queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] }),
        queryClient.invalidateQueries({ queryKey: ["processo"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo"] }),
        queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] }),
        queryClient.invalidateQueries({ queryKey: ["documentos-tarefa"] }),
        queryClient.invalidateQueries({ queryKey: ["lista-atividades"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda-unificada-infinite-v1"] }),
      ]);
      await invalidarItensAgenda(queryClient);
      if (novaTarefa?.id && onCreated) {
        await onCreated(novaTarefa.id);
      }
      if (novaTarefa?.id && onAfterCreate) {
        try { onAfterCreate({ id: novaTarefa.id, titulo: (novaTarefa as any).titulo || values.titulo || "Tarefa" }); }
        catch (err) { console.warn("onAfterCreate falhou:", err); }
      }
      if (secondaryClickedRef.current) {
        try {
          await secondarySave?.onAfterSuccess();
        } catch (err) {
          console.error("secondarySave.onAfterSuccess falhou:", err);
        } finally {
          secondaryClickedRef.current = false;
        }
      }
      const tertiaryWasClicked = tertiaryClickedRef.current;
      if (tertiaryWasClicked) {
        try { await tertiarySave?.onAfterSuccess(); }
        catch (err) { console.error("tertiarySave.onAfterSuccess falhou:", err); }
        finally { tertiaryClickedRef.current = false; }
      }
      const manterAbertoParaNovo = !tarefaParaEditar?.id && !!onAfterCreate && !tertiaryWasClicked;
      if (manterAbertoParaNovo) {
        resetFormForNew();
      } else {
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      toast({
        title: tarefaParaEditar?.id ? "Erro ao editar tarefa" : "Erro ao criar tarefa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
      setUploadingAnexos(false);
    }
  }

  const handleAlterarStatus = async (status: "pendente" | "cumprido" | "cancelado") => {
    if (!tarefaParaEditar?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: status as any,
          data_cumprimento: status === "cumprido" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tarefaParaEditar.id);
      if (error) throw error;
      const avancouWorkflow = await sincronizarWorkflowPorItem(tarefaParaEditar.id, status);
      await queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      await queryClient.invalidateQueries({ queryKey: ["lista-atividades"] });
      await queryClient.invalidateQueries({ queryKey: ["workflow-execucoes"] });
      await queryClient.invalidateQueries({ queryKey: ["workflow-execucao-etapas"] });
      await invalidarItensAgenda(queryClient);
      toast({
        title: status === "cumprido" ? "Tarefa concluída" : status === "cancelado" ? "Tarefa cancelada" : "Tarefa reaberta",
      });
      if (avancouWorkflow) toast({ title: "Próxima etapa do workflow criada" });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const Header = (
    inline ? (
      <div className="px-6 pt-5 pb-3 shrink-0 border-b flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          Tarefa
        </h3>
        <div className="flex items-center gap-2">
          {publicacao && (
            <BotaoPreencherIA
              conteudo={publicacao.conteudo}
              tipoTarefa="TAREFA EQUIPE"
              processoNumero={publicacao.processo_numero}
              dataPublicacao={publicacao.data_publicacao}
              size="sm"
              onResultado={(r) => {
                if (r.titulo) form.setValue("titulo", r.titulo);
                const desc = [r.descricao, r.observacoes].filter(Boolean).join("\n\n");
                if (desc) form.setValue("descricao", desc);
                if (r.data_vencimento) form.setValue("data_vencimento", r.data_vencimento);
              }}
            />
          )}
          <span className="text-xs text-muted-foreground">Situação</span>
          <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {situacoesDisponiveis("tarefa", { podeGerenciar: podeCancelar, atual: situacao }).filter((s) => s.value === situacao || (situacaoAtiva(s.value) && podeUsarSituacao(s.value))).map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            form="nova-tarefa-form"
            size="sm"
            disabled={loading || uploadingAnexos}
          >
            {(loading || uploadingAnexos) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    ) : (
      <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <DialogTitle className="flex items-center gap-2">
            Tarefa
          </DialogTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Situação</span>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {situacoesDisponiveis("tarefa", { podeGerenciar: podeCancelar, atual: situacao }).filter((s) => s.value === situacao || (situacaoAtiva(s.value) && podeUsarSituacao(s.value))).map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              form="nova-tarefa-form"
              size="sm"
              disabled={loading || uploadingAnexos}
            >
              {(loading || uploadingAnexos) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogHeader>
    )
  );

  const Body = (
    <>
      {Header}

        <div className={embedded ? "px-6 pb-4" : "flex-1 min-h-0 overflow-y-auto px-6 pb-4"}>
          {tarefaParaEditar?.id && (
            <div className="pb-4">
              <TarefaPublicacaoVinculada tarefaId={tarefaParaEditar.id} />
            </div>
          )}
          <Form {...form}>
            <form id="nova-tarefa-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel>Título</FormLabel>
                      <div className="flex items-center gap-1.5">
                        {tarefaParaEditar?.id && (
                          <EtiquetaPicker
                            entidade="tarefa"
                            entidadeId={tarefaParaEditar.id}
                            coordenacaoId={coordenacaoId}
                            compact
                          />
                        )}
                        <ModeloTituloPicker
                        tipo="tarefa"
                        coordenacaoId={coordenacaoId}
                        onSelect={(m) => {
                          const anterior = modeloPadroesRef.current || {};
                          const p = resolverPadroes(m);
                          form.setValue("titulo", m.titulo, { shouldDirty: true });
                          // Limpa o que o modelo anterior preencheu e o novo não define
                          for (const [k, v] of Object.entries(anterior)) {
                            if (k === "titulo" || p[k] !== undefined) continue;
                            if (String(form.getValues(k as any) ?? "") === v) {
                              form.setValue(k as any, "" as any, { shouldDirty: true });
                            }
                          }
                          for (const [k, v] of Object.entries(p)) {
                            if (k === "titulo") continue;
                            form.setValue(k as any, v, { shouldDirty: true });
                          }
                          if (m.descricao && !form.getValues("descricao")) {
                            form.setValue("descricao", m.descricao, { shouldDirty: true });
                          }
                          // Prazo pré-programado no modelo → data prevista a partir
                          // da data base (data da publicação, se houver, ou hoje)
                          const prazoCalculado = resolverPrazoModelo(
                            m,
                            publicacao?.data_publicacao || publicacao?.data_disponibilizacao || null,
                          );
                          // O modelo é uma escolha explícita: o prazo programado
                          // sempre substitui a data prevista atual.
                          if (prazoCalculado) {
                            form.setValue("data_vencimento" as any, prazoCalculado, { shouldDirty: true });
                          }
                          modeloPadroesRef.current = {
                            ...p,
                            ...(prazoCalculado ? { data_vencimento: prazoCalculado } : {}),
                          };
                        }}
                        />
                      </div>
                    </div>
                    <FormControl>
                      <AutoResizeTextarea
                        placeholder="Título da tarefa"
                        {...field}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo de Vínculo — oculto quando vindo de uma publicação (sempre vinculada ao processo da publicação) */}
              {!forcarVinculoPublicacao && (
              <FormField
                control={form.control}
                name="tipo_vinculo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de vínculo</FormLabel>
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
              )}

              {/* Coordenação — só aparece para admin ou usuário com mais de uma coordenação */}
              {precisaSelecionar && (
                <FormField
                  control={form.control}
                  name="coordenacao_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coordenação</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a coordenação" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {coordenacoesDisponiveis.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}{c.area ? ` - ${c.area}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Processo (if tipo_vinculo === "processo") — oculto quando vindo de publicação */}
              {tipoVinculo === "processo" && !forcarVinculoPublicacao && (
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

              {/* Responsável */}
              <FormField
                control={form.control}
                name="responsavel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsáveis *</FormLabel>
                    <FormControl>
                      <PeoplePicker
                        selectedIds={responsaveisIds}
                        onChange={(ids) => {
                          setResponsaveisIds(ids);
                          field.onChange(ids[0] || "");
                        }}
                        placeholder="Adicionar responsável"
                        emptyLabel="Nenhum responsável selecionado"
                        lockedIds={coordenadoresIds}
                      />
                    </FormControl>
                    {coordenadoresIds.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Responsáveis fixos configurados para Tarefa Equipe não podem ser removidos.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Envolvidos (colaboradores) */}
              <div className="space-y-1.5">
                {!mostrarEnvolvidos ? (
                  <button
                    type="button"
                    onClick={() => setMostrarEnvolvidos(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Envolver mais pessoas
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Envolvidos (acompanham)</Label>
                      {envolvidosFixosIds.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarEnvolvidos(false);
                          setEnvolvidosIds([]);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Ocultar
                      </button>
                      )}
                    </div>
                    <PeoplePicker
                      selectedIds={envolvidosIds}
                      onChange={(ids) =>
                        setEnvolvidosIds(
                          Array.from(new Set([...envolvidosFixosIds, ...ids])),
                        )
                      }
                      placeholder="Adicionar colaborador"
                      emptyLabel="Apenas para acompanhamento"
                      icon="users"
                      lockedIds={envolvidosFixosIds}
                    />
                    {envolvidosFixosIds.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Envolvidos fixos configurados para este tipo não podem ser removidos.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Data base */}
              <FormField
                control={form.control}
                name="data_base"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data base</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (prazoDias > 0) {
                            const calc = computeDataPrevista(e.target.value, prazoDias, prazoUnidade);
                            if (calc) form.setValue("data_vencimento", calc);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Prazo em dias (calcula a Data prevista) */}
              <div className="space-y-1.5">
                <Label>Prazo</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={prazoDias}
                    onChange={(e) => {
                      const dias = parseInt(e.target.value || "0", 10) || 0;
                      setPrazoDias(dias);
                      const calc = computeDataPrevista(form.getValues("data_base"), dias, prazoUnidade);
                      if (calc) form.setValue("data_vencimento", calc);
                    }}
                    className="w-20"
                  />
                  <Select
                    value={prazoUnidade}
                    onValueChange={(v) => {
                      const unidade = v as "uteis" | "corridos";
                      setPrazoUnidade(unidade);
                      const calc = computeDataPrevista(form.getValues("data_base"), prazoDias, unidade);
                      if (calc) form.setValue("data_vencimento", calc);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uteis">Dias úteis</SelectItem>
                      <SelectItem value="corridos">Dias corridos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Calcula a Data prevista a partir da Data base. Você ainda pode editar a data manualmente.
                </p>
              </div>

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
                      <FormLabel>Data Fatal *</FormLabel>
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

              {/* Prioridade */}
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

              {/* Local */}
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

              <AlertasConfigCard />

              {/* Recorrência */}
              <div className="rounded-md border p-3 space-y-3">
                <Label className="text-sm font-medium">Recorrência</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Frequência</Label>
                    <Select
                      value={recorrenciaTipo}
                      onValueChange={(v) => {
                        setRecorrenciaTipo(v);
                        setRecorrenciaIntervalo(1);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhuma">Não se repete</SelectItem>
                        <SelectItem value="daily">Dias corridos</SelectItem>
                        <SelectItem value="weekdays">Dias úteis (Seg–Sex)</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                        <SelectItem value="yearly">Anualmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {recorrenciaTipo !== "nenhuma" && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantas vezes deve aparecer?</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Ex.: 9"
                        value={recorrenciaOcorrencias}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecorrenciaOcorrencias(v);
                          const n = parseInt(v);
                          const dv = form.getValues("data_vencimento");
                          if (n && n > 0 && dv) {
                            const base = new Date(dv + "T00:00:00");
                            const offset = n - 1;
                            let fim = base;
                            if (recorrenciaTipo === "daily") fim = addDays(base, offset);
                            else if (recorrenciaTipo === "weekdays") {
                              let count = 0;
                              fim = base;
                              while (count < offset) {
                                fim = addDays(fim, 1);
                                const dow = fim.getDay();
                                if (dow !== 0 && dow !== 6) count++;
                              }
                            } else if (recorrenciaTipo === "weekly") fim = addWeeks(base, offset);
                            else if (recorrenciaTipo === "monthly") fim = addMonths(base, offset);
                            else if (recorrenciaTipo === "yearly") fim = addYears(base, offset);
                            setRecorrenciaFim(format(fim, "yyyy-MM-dd"));
                          }
                        }}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
                {recorrenciaTipo !== "nenhuma" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Ou até a data</Label>
                    <Input
                      type="date"
                      value={recorrenciaFim}
                      onChange={(e) => {
                        setRecorrenciaFim(e.target.value);
                        setRecorrenciaOcorrencias("");
                      }}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Anexos - Sempre disponível */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Documentos
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
                  </p>
                ) : (
                  <div className="space-y-2">
                    {anexos.map((anexo, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate font-medium max-w-[150px] sm:max-w-none">{anexo.file?.name || anexo.nome}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              ({formatFileSize(anexo.file?.size ?? anexo.tamanho_bytes ?? 0)})
                            </span>
                          {anexo.uploaded && anexo.url && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Baixar documento"
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = anexo.url!;
                                a.download = anexo.nome || anexo.file?.name || "documento";
                                a.target = "_blank";
                                a.rel = "noopener";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <ItemAbas
                tipo="tarefa"
                tipoComentario="tarefa"
                itemId={tarefaParaEditar?.id}
                processoId={(tarefaParaEditar as any)?.processo_id ?? null}
              />

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalhes adicionais sobre a tarefa..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
        </div>

        {/* Actions - fora do scroll para ficar sempre visível */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t px-6 pb-6 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          {tarefaParaEditar?.id && tarefaParaEditar.status !== "pendente" && (
            <Button type="button" variant="outline" onClick={() => handleAlterarStatus("pendente")} disabled={loading} className="w-full sm:w-auto">
              Reabrir
            </Button>
          )}
          <Button 
            type="submit"
            form="nova-tarefa-form"
            disabled={loading || uploadingAnexos} 
            className="w-full sm:w-auto"
            onClick={() => { secondaryClickedRef.current = false; tertiaryClickedRef.current = false; }}
          >
            {(loading || uploadingAnexos) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {uploadingAnexos ? "Enviando anexos..." : loading ? "Salvando..." : "Salvar"}
          </Button>
          {secondarySave && !tarefaParaEditar?.id && (
            <Button
              type="submit"
              form="nova-tarefa-form"
              disabled={loading || uploadingAnexos}
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => { secondaryClickedRef.current = true; }}
            >
              {(loading || uploadingAnexos) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {secondarySave.label}
            </Button>
          )}
          {tertiarySave && !tarefaParaEditar?.id && (
            <Button
              type="submit"
              form="nova-tarefa-form"
              disabled={loading || uploadingAnexos}
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => { tertiaryClickedRef.current = true; }}
            >
              {(loading || uploadingAnexos) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tertiarySave.label}
            </Button>
          )}
        </div>
    </>
  );

  if (inline) {
    return (
      <div className={embedded ? "flex flex-col bg-background" : "h-full flex flex-col bg-background overflow-hidden"}>
        {Body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {Body}
      </DialogContent>
    </Dialog>
  );
}
