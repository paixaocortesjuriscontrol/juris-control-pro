import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import { situacoesDisponiveis } from "@/constants/situacoesItem";
import { ModeloTituloPicker } from "@/components/modelos/ModeloTituloPicker";
import { resolverPadroes, resolverPrazoModelo } from "@/lib/aplicarPadroesModelo";
import { usePodeCancelarItens } from "@/hooks/usePodeCancelarItens";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { useAudienciasDetectadas, NovaAudiencia } from "@/hooks/useAudienciasDetectadas";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { useCoordenadoresDaCoordenacao, useEnvolvidosFixosDaCoordenacao } from "@/hooks/useCoordenadoresDaCoordenacao";
import { supabase } from "@/integrations/supabase/client";
import { formatProcessoNumero } from "@/lib/utils";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { CoordenacaoSelect } from "@/components/shared/CoordenacaoSelect";
import { AlertasConfigCard } from "@/components/shared/AlertasConfigCard";
import { useQueryClient } from "@tanstack/react-query";
import { ItemComentarios } from "@/components/comum/ItemComentarios";
import { ItemAnexos, type ItemAnexosHandle } from "@/components/comum/ItemAnexos";
import { AudienciaPublicacaoVinculada } from "@/components/shared/AudienciaPublicacaoVinculada";

type Props = {
  defaultProcessoNumero?: string;
  defaultProcessoId?: string;
  /** Coordenação herdada do contexto (ex.: pasta do processo). */
  defaultCoordenacaoId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  hideTitleHeader?: boolean;
  showProcessoField?: boolean;
  defaultTitulo?: string;
  defaultObservacoes?: string;
  defaultDataAudiencia?: string;
  publicacaoId?: string;
  publicacaoTipoOrigem?: "termo" | "processo" | "descartada" | "datajud";
  publicacaoConteudo?: string;
  secondarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  tertiarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  onAfterCreate?: (info: { id: string; titulo: string }) => void;
  resolveProcessoBeforeSubmit?: () => Promise<{ id: string; numero: string } | null>;
  audienciaParaEditar?: any | null;
  invalidateKey?: unknown[];
};

const empty = {
  titulo: "",
  data_audiencia: "",
  hora: "",
  hora_fim: "",
  alerta_valor: 0,
  alerta_unidade: "horas_antes",
  forum: "",
  sala_forum: "",
  local_audiencia: "",
  modalidade: "",
  observacoes: "",
  vara_camara: "",
  comarca: "",
  polo_ativo: "",
  cliente: "",
  terceirizado: "",
};

export function AudienciaFormSimplificado({
  defaultProcessoNumero,
  defaultProcessoId,
  defaultCoordenacaoId,
  onSuccess,
  onCancel,
  hideTitleHeader,
  showProcessoField = true,
  defaultTitulo,
  defaultObservacoes,
  defaultDataAudiencia,
  publicacaoId,
  publicacaoTipoOrigem,
  publicacaoConteudo,
  secondarySave,
  tertiarySave,
  onAfterCreate,
  resolveProcessoBeforeSubmit,
  audienciaParaEditar,
  invalidateKey,
}: Props) {
  const queryClient = useQueryClient();
  const { criarAudiencia } = useAudienciasDetectadas();
  const isEditing = !!audienciaParaEditar?.id;
  const secondaryClickedRef = useRef(false);
  const anexosRef = useRef<ItemAnexosHandle>(null);
  const tertiaryClickedRef = useRef(false);
  const {
    precisaSelecionar,
    unicaCoordenacaoId,
    isAdmin: isAdminCoord,
    coordenacoes: coordenacoesDoUsuario,
  } = useCoordenacoesDoUsuario();
  const toDateInput = (value?: string | null) => value ? value.slice(0, 10) : "";
  const toTimeInput = (value?: string | null) => value ? value.slice(0, 5) : "";
  const [form, setForm] = useState({
    ...empty,
    titulo: audienciaParaEditar?.titulo ?? audienciaParaEditar?.tipo_audiencia ?? defaultTitulo ?? "",
    observacoes: audienciaParaEditar?.observacoes ?? defaultObservacoes ?? "",
    data_audiencia: toDateInput(audienciaParaEditar?.data_audiencia) || defaultDataAudiencia || "",
    hora: toTimeInput(audienciaParaEditar?.hora),
    hora_fim: toTimeInput(audienciaParaEditar?.hora_fim),
    forum: audienciaParaEditar?.forum ?? "",
    sala_forum: audienciaParaEditar?.sala_forum ?? "",
    local_audiencia: audienciaParaEditar?.local_audiencia ?? "",
    modalidade: audienciaParaEditar?.modalidade ?? "",
    vara_camara: audienciaParaEditar?.vara_camara ?? "",
    comarca: audienciaParaEditar?.comarca ?? "",
    polo_ativo: audienciaParaEditar?.polo_ativo ?? "",
    cliente: audienciaParaEditar?.cliente ?? "",
    terceirizado: audienciaParaEditar?.terceirizado ?? "",
  });
  const [situacao, setSituacao] = useState<string>(audienciaParaEditar?.status ?? "pendente");
  const { podeCancelar } = usePodeCancelarItens();
  const [processoNumero, setProcessoNumero] = useState(
    audienciaParaEditar?.processo_numero
      ? formatProcessoNumero(audienciaParaEditar.processo_numero)
      : defaultProcessoNumero ? formatProcessoNumero(defaultProcessoNumero) : ""
  );
  const [processoId, setProcessoId] = useState<string | undefined>(audienciaParaEditar?.processo_id ?? defaultProcessoId);
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const [mostrarEnvolvidos, setMostrarEnvolvidos] = useState(false);
  const [coordenacaoId, setCoordenacaoId] = useState<string>(
    audienciaParaEditar?.coordenacao_id ?? ""
  );
  const { data: coordenadoresIds = [] } = useCoordenadoresDaCoordenacao(coordenacaoId || null, "AUDIÊNCIA");
  // Envolvidos fixos configurados na coordenação para este tipo
  const { data: envolvidosFixosIds = [] } = useEnvolvidosFixosDaCoordenacao(coordenacaoId || null, "AUDIÊNCIA");
  useEffect(() => {
    if (envolvidosFixosIds.length === 0) return;
    setEnvolvidosIds((prev) => {
      const faltando = envolvidosFixosIds.filter((id) => !prev.includes(id));
      return faltando.length > 0 ? [...prev, ...faltando] : prev;
    });
  }, [JSON.stringify(envolvidosFixosIds)]);
  useEffect(() => {
    if (coordenadoresIds.length === 0) return;
    setResponsaveisIds((prev) => {
      const faltando = coordenadoresIds.filter((id) => !prev.includes(id));
      return faltando.length > 0 ? [...prev, ...faltando] : prev;
    });
  }, [JSON.stringify(coordenadoresIds)]);
  const [buscando, setBuscando] = useState(false);
  const autoBuscaRef = useRef(false);

  useEffect(() => {
    if (!audienciaParaEditar) return;
    setForm({
      ...empty,
      titulo: audienciaParaEditar.titulo ?? audienciaParaEditar.tipo_audiencia ?? "",
      observacoes: audienciaParaEditar.observacoes ?? "",
      data_audiencia: toDateInput(audienciaParaEditar.data_audiencia),
      hora: toTimeInput(audienciaParaEditar.hora),
      hora_fim: toTimeInput(audienciaParaEditar.hora_fim),
      forum: audienciaParaEditar.forum ?? "",
      sala_forum: audienciaParaEditar.sala_forum ?? "",
      local_audiencia: audienciaParaEditar.local_audiencia ?? "",
      modalidade: audienciaParaEditar.modalidade ?? "",
      vara_camara: audienciaParaEditar.vara_camara ?? "",
      comarca: audienciaParaEditar.comarca ?? "",
      polo_ativo: audienciaParaEditar.polo_ativo ?? "",
      cliente: audienciaParaEditar.cliente ?? "",
      terceirizado: audienciaParaEditar.terceirizado ?? "",
    });
    setSituacao(audienciaParaEditar.status ?? "pendente");
    setProcessoNumero(audienciaParaEditar.processo_numero ? formatProcessoNumero(audienciaParaEditar.processo_numero) : "");
    setProcessoId(audienciaParaEditar.processo_id ?? undefined);
    setCoordenacaoId(audienciaParaEditar.coordenacao_id ?? "");
  }, [audienciaParaEditar]);

  useEffect(() => {
    if (!audienciaParaEditar?.id) return;
    let cancelled = false;
    const carregarVinculos = async () => {
      const [{ data: advogados }, { data: envolvidos }] = await Promise.all([
        supabase.from("audiencias_advogados").select("advogado_id").eq("audiencia_id", audienciaParaEditar.id),
        supabase.from("audiencia_envolvidos").select("usuario_id").eq("audiencia_id", audienciaParaEditar.id),
      ]);
      if (cancelled) return;
      setResponsaveisIds((advogados || []).map((a: any) => a.advogado_id).filter(Boolean));
      const envolvidosIdsCarregados = (envolvidos || []).map((e: any) => e.usuario_id).filter(Boolean);
      setEnvolvidosIds(envolvidosIdsCarregados);
      setMostrarEnvolvidos(envolvidosIdsCarregados.length > 0);
    };
    carregarVinculos();
    return () => { cancelled = true; };
  }, [audienciaParaEditar?.id]);

  useEffect(() => {
    if (!coordenacaoId && unicaCoordenacaoId) {
      setCoordenacaoId(unicaCoordenacaoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unicaCoordenacaoId]);

  // Segurança de escopo: a coordenação herdada do processo pode pertencer a outra
  // equipe (processos são compartilhados). O item deve nascer na coordenação do
  // próprio usuário — nunca em uma coordenação da qual ele não participa.
  useEffect(() => {
    if (isEditing || isAdminCoord) return;
    if (coordenacoesDoUsuario.length === 0 || !coordenacaoId) return;
    const permitida = coordenacoesDoUsuario.some((c) => c.id === coordenacaoId);
    if (!permitida) setCoordenacaoId(unicaCoordenacaoId ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordenacaoId, isAdminCoord, isEditing, JSON.stringify(coordenacoesDoUsuario), unicaCoordenacaoId]);

  // A coordenação nunca é herdada do processo/pasta: usa sempre a do usuário logado
  // (e, com mais de uma, exige escolha explícita no select).

  const set = (field: keyof typeof empty, v: any) =>
    setForm((p) => ({ ...p, [field]: v }));

  const buscarProcesso = async (numero: string, withToast = true) => {
    setBuscando(true);
    try {
      const numeroDigits = numero.replace(/\D/g, "");
      const numeroMasked = formatProcessoNumero(numero);
      const candidatos = Array.from(
        new Set([numeroMasked, numero, numeroDigits].filter(Boolean))
      );
      const orExpr = candidatos.map((c) => `numero.ilike.%${c}%`).join(",");
      const { data } = await supabase
        .from("processos")
        .select("id, numero, vara, comarca, coordenacao_id")
        .or(orExpr)
        .limit(1)
        .maybeSingle();
      if (!data) {
        if (withToast) toast.error("Processo não encontrado");
        return;
      }
      setProcessoNumero(formatProcessoNumero(data.numero ?? numero));
      setProcessoId(data.id);
      if (withToast) toast.success("Processo encontrado");
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    // Quando já temos o id do processo (aberto dentro da pasta), NÃO buscamos por
    // número: o mesmo número pode existir em outra coordenação e o vínculo iria
    // para a pasta errada. Apenas herdamos a coordenação do processo informado.
    if (defaultProcessoId && !autoBuscaRef.current) {
      autoBuscaRef.current = true;
      (async () => {
        const { data } = await supabase
          .from("processos")
          .select("id, numero, coordenacao_id")
          .eq("id", defaultProcessoId)
          .maybeSingle();
        if (!data) return;
        setProcessoId(data.id);
        setProcessoNumero(formatProcessoNumero(data.numero ?? defaultProcessoNumero ?? ""));
      })();
      return;
    }
    if (defaultProcessoNumero && !autoBuscaRef.current) {
      autoBuscaRef.current = true;
      buscarProcesso(defaultProcessoNumero, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProcessoNumero, defaultProcessoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
    if (!form.titulo.trim()) {
      toast.error("Informe o título da audiência");
      return;
    }
    if (!form.data_audiencia) {
      toast.error("Informe a data");
      return;
    }
    if (!isEditing && responsaveisIds.length === 0) {
      toast.error("Selecione ao menos um responsável", {
        description: "Campo obrigatório: 'Responsáveis', no final do formulário.",
      });
      return;
    }
    if (precisaSelecionar && !coordenacaoId) {
      toast.error("Selecione a coordenação", {
        description: "Campo obrigatório: 'Coordenação', no início do formulário.",
      });
      return;
    }

    let processoIdParaSalvar = processoId;
    let processoNumeroParaSalvar = processoNumero;
    // Garante que o processo vinculado realmente existe (evita erro de chave
    // estrangeira que fazia o "Salvar" falhar sem salvar nada).
    if (processoIdParaSalvar) {
      const { data: procExiste } = await supabase
        .from("processos")
        .select("id, numero")
        .eq("id", processoIdParaSalvar)
        .maybeSingle();
      if (!procExiste) {
        processoIdParaSalvar = undefined;
        toast.warning("Processo vinculado não encontrado", {
          description: "A audiência será salva sem o vínculo com o processo.",
        });
      }
    }
    if (resolveProcessoBeforeSubmit) {
      try {
        const proc = await resolveProcessoBeforeSubmit();
        if (proc?.id) {
          processoIdParaSalvar = proc.id;
          processoNumeroParaSalvar = formatProcessoNumero(proc.numero);
          setProcessoId(proc.id);
          setProcessoNumero(formatProcessoNumero(proc.numero));
        }
      } catch (err: any) {
        toast.error("Erro ao vincular processo da publicação: " + (err?.message || err));
        return;
      }
    }

    const payload: NovaAudiencia = {
      processo_id: processoIdParaSalvar,
      processo_numero: processoNumeroParaSalvar || "",
      titulo: form.titulo.trim(),
      data_audiencia: form.data_audiencia,
      hora: form.hora || undefined,
      hora_fim: form.hora_fim || undefined,
      alerta_valor: form.alerta_valor > 0 ? Number(form.alerta_valor) : undefined,
      alerta_unidade: form.alerta_valor > 0 ? form.alerta_unidade : undefined,
      forum: form.forum || undefined,
      sala_forum: form.sala_forum || undefined,
      local_audiencia: form.local_audiencia || undefined,
      modalidade: form.modalidade || undefined,
      observacoes: form.observacoes || undefined,
      vara_camara: form.vara_camara || undefined,
      comarca: form.comarca || undefined,
      polo_ativo: form.polo_ativo || undefined,
      cliente: form.cliente || undefined,
      terceirizado: form.terceirizado || undefined,
      status: situacao,
      advogados_ids: responsaveisIds,
      envolvidos_ids: envolvidosIds,
      coordenacao_id: coordenacaoId || undefined,
      // Vínculo com a publicação DJEN que originou a audiência
      // IMPORTANTE: a origem deve permanecer "manual" (regra de segurança da
      // tabela só aceita "manual" ou "detectado"); o vínculo com a publicação
      // é registrado em publicacao_id e nas tabelas de junção.
      origem: undefined,
      publicacao_id: publicacaoId && publicacaoTipoOrigem === "termo" ? publicacaoId : undefined,
      conteudo_publicacao: publicacaoConteudo || undefined,
    };

    if (isEditing) {
      const hora = payload.hora_brasilia || payload.hora || "12:00";
      const dataAudienciaISO = `${payload.data_audiencia}T${hora}:00-03:00`;
      const { advogados_ids, envolvidos_ids, ...dadosAudiencia } = payload;
      const { error } = await supabase
        .from("audiencias_detectadas")
        .update({
          ...dadosAudiencia,
          processo_id: dadosAudiencia.processo_id || null,
          data_audiencia: dataAudienciaISO,
          status: situacao,
          tipo_audiencia: form.titulo.trim(),
        } as any)
        .eq("id", audienciaParaEditar.id);
      if (error) throw error;

      await supabase.from("audiencias_advogados").delete().eq("audiencia_id", audienciaParaEditar.id);
      if (advogados_ids && advogados_ids.length > 0) {
        await supabase.from("audiencias_advogados").insert(
          advogados_ids.map((advogadoId) => ({ audiencia_id: audienciaParaEditar.id, advogado_id: advogadoId }))
        );
      }

      await supabase.from("audiencia_envolvidos").delete().eq("audiencia_id", audienciaParaEditar.id);
      if (envolvidos_ids && envolvidos_ids.length > 0) {
        await supabase.from("audiencia_envolvidos").insert(
          envolvidos_ids.map((usuarioId) => ({ audiencia_id: audienciaParaEditar.id, usuario_id: usuarioId }))
        );
      }

      await anexosRef.current?.uploadPendentes(audienciaParaEditar.id, dadosAudiencia.processo_id || null);
      await invalidarItensAgenda(queryClient, invalidateKey ? [invalidateKey] : []);
      toast.success("Audiência atualizada com sucesso!");
    } else {
      const criada: any = await criarAudiencia.mutateAsync(payload);
      // Vincular à publicação via tabela de junção correta conforme origem
      if (criada?.id && publicacaoId && publicacaoTipoOrigem) {
        try {
          if (publicacaoTipoOrigem === "termo") {
            await supabase
              .from("audiencias_publicacoes")
              .insert({ audiencia_id: criada.id, publicacao_id: publicacaoId });
          } else if (publicacaoTipoOrigem === "processo") {
            await supabase
              .from("audiencias_publicacoes_processos")
              .insert({ audiencia_id: criada.id, publicacao_processo_id: publicacaoId });
          } else if (publicacaoTipoOrigem === "descartada") {
            await supabase
              .from("audiencias_publicacoes_descartadas")
              .insert({ audiencia_id: criada.id, publicacao_descartada_id: publicacaoId });
          }
        } catch (err) {
          console.warn("Falha ao vincular audiência à publicação:", err);
        }
      }
      if (criada?.id && onAfterCreate) {
        try { onAfterCreate({ id: criada.id, titulo: payload.titulo || "Audiência" }); }
        catch (err) { console.warn("onAfterCreate falhou:", err); }
      }
      if (criada?.id) {
        await anexosRef.current?.uploadPendentes(criada.id, payload.processo_id || null);
      }
    }
    setForm({ ...empty });
    setResponsaveisIds([]);
    setEnvolvidosIds([]);
    setMostrarEnvolvidos(false);
    if (secondaryClickedRef.current) {
      try { await secondarySave?.onAfterSuccess(); }
      catch (err) { console.error("secondarySave.onAfterSuccess falhou:", err); }
      finally { secondaryClickedRef.current = false; }
    }
    const tertiaryWasClicked = tertiaryClickedRef.current;
    if (tertiaryWasClicked) {
      try { await tertiarySave?.onAfterSuccess(); }
      catch (err) { console.error("tertiarySave.onAfterSuccess falhou:", err); }
      finally { tertiaryClickedRef.current = false; }
    }
    // Análise DJEN: se onAfterCreate foi fornecido e o usuário clicou no Salvar
    // primário (não em "Salvar e fechar"), mantém o form aberto para novo cadastro.
    const manterAbertoParaNovo = !isEditing && !!onAfterCreate && !tertiaryWasClicked;
    if (!manterAbertoParaNovo) {
      onSuccess?.();
    } else {
      toast.success("Audiência salva. Você pode cadastrar outro item para esta publicação.");
    }
    } catch (err: any) {
      console.error("[AudienciaFormSimplificado] falha ao salvar:", err);
      toast.error("Não foi possível salvar a audiência", {
        description: err?.message || String(err),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hideTitleHeader && (
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Audiência
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Situação</Label>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {situacoesDisponiveis("audiencia", { podeGerenciar: podeCancelar, atual: situacao }).map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              size="sm"
              disabled={criarAudiencia.isPending}
              onClick={(e) => { secondaryClickedRef.current = false; tertiaryClickedRef.current = false; handleSubmit(e as any); }}
            >
              {criarAudiencia.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
            {secondarySave && (
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={criarAudiencia.isPending}
                onClick={(e) => { secondaryClickedRef.current = true; handleSubmit(e as any); }}
              >
                {criarAudiencia.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {secondarySave.label}
              </Button>
            )}
            {tertiarySave && !isEditing && (
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={criarAudiencia.isPending}
                onClick={(e) => { tertiaryClickedRef.current = true; handleSubmit(e as any); }}
              >
                {criarAudiencia.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {tertiarySave.label}
              </Button>
            )}
          </div>
        </div>
      )}

      {isEditing && <AudienciaPublicacaoVinculada audienciaId={audienciaParaEditar?.id} />}

      <div className="space-y-1.5">
        <Label className="text-sm">
          Título da audiência<span className="text-destructive">*</span>
        </Label>
        <div className="mb-1 flex justify-end">
          <ModeloTituloPicker
            tipo="audiencia"
            coordenacaoId={coordenacaoId}
            onSelect={(m) => {
              set("titulo", m.titulo);
              if (m.descricao && !form.observacoes) set("observacoes", m.descricao);
              const p = resolverPadroes(m);
              const prazoCalculado = resolverPrazoModelo(m, null);
              setForm((prev) => {
                const next: any = { ...prev };
                for (const [k, v] of Object.entries(p)) {
                  if (k === "titulo") continue;
                  if (!String(next[k] ?? "").trim()) next[k] = v;
                }
                if (prazoCalculado && !String(next.data_audiencia ?? "").trim()) {
                  next.data_audiencia = prazoCalculado;
                }
                return next;
              });
            }}
          />
        </div>
        <AutoResizeTextarea
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Digite o título da audiência"
          autoFocus
        />
      </div>

      {precisaSelecionar && (
        <CoordenacaoSelect
          value={coordenacaoId}
          onChange={setCoordenacaoId}
          required
        />
      )}

      {showProcessoField && (
        <div className="space-y-1.5">
          <Label className="text-sm">Processo</Label>
          <div className="flex gap-2 min-w-0">
            <Input
              value={processoNumero}
              onChange={(e) => setProcessoNumero(e.target.value)}
              onBlur={(e) => setProcessoNumero(formatProcessoNumero(e.target.value))}
              placeholder="0000000-00.0000.0.00.0000"
              className="h-10 flex-1 min-w-0 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => processoNumero && buscarProcesso(processoNumero, true)}
              disabled={buscando}
              title="Buscar processo"
            >
              {buscando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-6 space-y-1.5">
          <Label className="text-sm">
            Data<span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={form.data_audiencia}
            onChange={(e) => set("data_audiencia", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="col-span-3 space-y-1.5">
          <Label className="text-sm">Início</Label>
          <Input
            type="time"
            value={form.hora}
            onChange={(e) => set("hora", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="col-span-3 space-y-1.5">
          <Label className="text-sm">Até</Label>
          <Input
            type="time"
            value={form.hora_fim}
            onChange={(e) => set("hora_fim", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <AlertasConfigCard />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Fórum</Label>
          <Input
            value={form.forum}
            onChange={(e) => set("forum", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Sala do fórum</Label>
          <Input
            value={form.sala_forum}
            onChange={(e) => set("sala_forum", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Vara / Câmara / Turma</Label>
          <Input
            value={form.vara_camara}
            onChange={(e) => set("vara_camara", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Comarca</Label>
          <Input
            value={form.comarca}
            onChange={(e) => set("comarca", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Polo ativo</Label>
          <Input
            value={form.polo_ativo}
            onChange={(e) => set("polo_ativo", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Cliente</Label>
          <Input
            value={form.cliente}
            onChange={(e) => set("cliente", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Terceirizada</Label>
          <Input
            value={form.terceirizado}
            onChange={(e) => set("terceirizado", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Endereço ou local</Label>
        <Input
          value={form.local_audiencia}
          onChange={(e) => set("local_audiencia", e.target.value)}
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Modalidade</Label>
        <Select
          value={form.modalidade || ""}
          onValueChange={(v) => set("modalidade", v)}
        >
          <SelectTrigger className="h-10 max-w-xs">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Presencial">Presencial</SelectItem>
            <SelectItem value="Virtual">Virtual</SelectItem>
            <SelectItem value="Híbrida">Híbrida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">
          Responsáveis<span className="text-destructive">*</span>
        </Label>
        <PeoplePicker
          selectedIds={responsaveisIds}
          onChange={setResponsaveisIds}
          placeholder="Adicionar responsável"
          emptyLabel="Nenhum responsável selecionado"
          lockedIds={coordenadoresIds}
        />
        {coordenadoresIds.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Responsáveis fixos configurados para Audiência não podem ser removidos.
          </p>
        )}
        {!mostrarEnvolvidos && (
          <button
            type="button"
            onClick={() => setMostrarEnvolvidos(true)}
            className="text-xs text-primary hover:underline"
          >
            + Envolver mais pessoas
          </button>
        )}
      </div>

      {mostrarEnvolvidos && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Envolvidos (acompanham)</Label>
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
          </div>
          <PeoplePicker
            selectedIds={envolvidosIds}
            onChange={setEnvolvidosIds}
            placeholder="Adicionar envolvido"
            emptyLabel="Apenas para acompanhamento"
            icon="users"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm">Observações</Label>
        <Textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          placeholder="Digite observações sobre a audiência"
          rows={4}
        />
      </div>

      <ItemAnexos
        ref={anexosRef}
        tipo="audiencia"
        itemId={audienciaParaEditar?.id}
        processoId={audienciaParaEditar?.processo_id || defaultProcessoId || null}
      />

      <ItemComentarios tipo="audiencia" itemId={audienciaParaEditar?.id} />

      <div className="flex justify-end gap-2 pt-2 border-t">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={criarAudiencia.isPending}
          onClick={() => { secondaryClickedRef.current = false; tertiaryClickedRef.current = false; }}
        >
          {criarAudiencia.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Salvar
        </Button>
        {secondarySave && (
          <Button
            type="submit"
            variant="secondary"
            disabled={criarAudiencia.isPending}
            onClick={() => { secondaryClickedRef.current = true; }}
          >
            {criarAudiencia.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {secondarySave.label}
          </Button>
        )}
        {tertiarySave && !isEditing && (
          <Button
            type="submit"
            variant="secondary"
            disabled={criarAudiencia.isPending}
            onClick={() => { tertiaryClickedRef.current = true; }}
          >
            {criarAudiencia.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {tertiarySave.label}
          </Button>
        )}
      </div>
    </form>
  );
}