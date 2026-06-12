import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
// Checkbox removido — opção "Com anexos" agora vive no DistribuicaoTstDetail.
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { DistribuicaoTst, DistribuicaoTstInsert } from "@/hooks/useDistribuicoesTst";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
import { MateriasMultiSelect } from "@/components/distribuicao-tst/MateriasMultiSelect";
import { MultiTipoRecurso } from "@/components/distribuicao-tst/MultiTipoRecurso";
import { RelatorTurmaCombo } from "@/components/distribuicao-tst/RelatorTurmaCombo";
import { persistirPartesJudit } from "@/lib/juditDistribuicaoTst";
const OPCOES_RECURSO_NORM = [
  "Agravo de Instrumento em Recurso de Revista",
  "Recurso de Revista com Agravo",
  "Recurso de Revista",
  "Embargos à SDI",
  "Embargos em Recurso de Revista",
  "Recurso Ordinário",
  "Recurso Ordinário em Procedimento Sumaríssimo",
  "Recurso Ordinário em Mandado de Segurança",
  "Recurso Ordinário em Ação Rescisória",
  "Recurso Ordinário Trabalhista",
  "Agravo de Petição",
  "Embargos de Declaração",
  "Embargos em Execução",
  "Embargos Infringentes",
  "Embargos",
  "Agravo Regimental",
  "Agravo Interno",
  "Agravo de Instrumento",
  "Agravo",
  "Recurso Extraordinário",
  "Agravo em Recurso Extraordinário",
  "Recurso Especial",
  "Agravo em Recurso Especial",
  "Recurso Adesivo",
  "Reclamação",
  "Mandado de Segurança",
  "Habeas Corpus",
];

// Mapa de siglas comuns vindas de classes/códigos da Judit/CNJ/TST.
// Mantido fora da função para reuso e evitar realocação.
const SIGLAS_RECURSO: Record<string, string> = {
  // TST
  "rr": "Recurso de Revista",
  "rrag": "Recurso de Revista com Agravo",
  "arr": "Recurso de Revista com Agravo",
  "ararr": "Recurso de Revista com Agravo",
  "airr": "Agravo de Instrumento em Recurso de Revista",
  "aiarr": "Agravo de Instrumento em Recurso de Revista",
  "e": "Embargos à SDI",
  "err": "Embargos em Recurso de Revista",
  // TRT
  "ro": "Recurso Ordinário",
  "rot": "Recurso Ordinário Trabalhista",
  "rotsum": "Recurso Ordinário em Procedimento Sumaríssimo",
  "rops": "Recurso Ordinário em Procedimento Sumaríssimo",
  "roms": "Recurso Ordinário em Mandado de Segurança",
  "roar": "Recurso Ordinário em Ação Rescisória",
  "ap": "Agravo de Petição",
  // Embargos
  "ed": "Embargos de Declaração",
  "edcl": "Embargos de Declaração",
  "ee": "Embargos em Execução",
  "ei": "Embargos Infringentes",
  // Agravos
  "ag": "Agravo",
  "agr": "Agravo Regimental",
  "agint": "Agravo Interno",
  "agi": "Agravo Interno",
  "ai": "Agravo de Instrumento",
  // Cortes superiores
  "re": "Recurso Extraordinário",
  "are": "Agravo em Recurso Extraordinário",
  "resp": "Recurso Especial",
  "aresp": "Agravo em Recurso Especial",
  // Outros
  "ms": "Mandado de Segurança",
  "hc": "Habeas Corpus",
  "rcl": "Reclamação",
  "radesivo": "Recurso Adesivo",
};

/** Normaliza string vinda da Judit (ex.: "AGRAVO DE INSTRUMENTO EM RECURSO DE REVISTA",
 *  "RECURSO DE REVISTA + EMBARGOS") para os rótulos exatos do dropdown
 *  MultiTipoRecurso. Mantém valores não reconhecidos como "Outro…" (texto livre). */
function normalizarTipoRecurso(raw: any): string | null {
  if (raw == null) return null;
  const txt = String(raw).trim();
  if (!txt) return null;
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Quebra em pedaços por "+" (composições já formatadas) e por "-" (siglas
  // compostas como "ED-RR" → "Embargos de Declaração + Recurso de Revista").
  const partes: string[] = [];
  for (const bloco of txt.split(/\s*\+\s*/)) {
    const b = bloco.trim();
    if (!b) continue;
    // Só quebra por "-" se TODOS os pedaços forem siglas conhecidas;
    // evita destruir nomes legítimos com hífen.
    const subs = b.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
    if (subs.length > 1 && subs.every((s) => SIGLAS_RECURSO[norm(s)])) {
      partes.push(...subs);
    } else {
      partes.push(b);
    }
  }

  const mapped: string[] = [];
  const vistos = new Set<string>();
  for (const p of partes) {
    const alvo = norm(p);
    let nome = SIGLAS_RECURSO[alvo];
    if (!nome) {
      const hit = OPCOES_RECURSO_NORM.find((opt) => norm(opt) === alvo);
      nome = hit || p;
    }
    const k = norm(nome);
    if (vistos.has(k)) continue;
    vistos.add(k);
    mapped.push(nome);
  }
  return mapped.length ? mapped.join(" + ") : null;
}

/** Mapeia o valor `recorrente` da Judit (nome(s) das partes) para uma das
 *  opções fixas do dropdown: Reclamante / Reclamada / Reclamante e Reclamada / Terceiro. */
function normalizarParteRecorrente(
  recorrenteRaw: any,
  reclamante: string,
  reclamada: string,
): string | null {
  if (recorrenteRaw == null) return null;
  const txt = String(recorrenteRaw).trim();
  if (!txt) return null;
  // Já vem rotulado?
  const baixo = txt.toLowerCase();
  if (baixo === "reclamante") return "Reclamante";
  if (baixo === "reclamada" || baixo === "reclamado") return "Reclamada";
  if (/reclamante\s+e\s+reclamad/.test(baixo)) return "Reclamante e Reclamada";
  if (baixo === "terceiro") return "Terceiro";

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = (s: string) => norm(s).split(/[\s,/]+/).filter((t) => t.length >= 3);
  const recList = txt.split(/\s*[,/]\s*/).map((s) => s.trim()).filter(Boolean);
  const recTokens = recList.flatMap(tokens);
  const reclTokens = new Set(tokens(reclamante || ""));
  const readTokens = new Set(tokens(reclamada || ""));
  let bateRecl = false;
  let bateRead = false;
  for (const t of recTokens) {
    if (reclTokens.has(t)) bateRecl = true;
    if (readTokens.has(t)) bateRead = true;
  }
  if (bateRecl && bateRead) return "Reclamante e Reclamada";
  if (bateRecl) return "Reclamante";
  if (bateRead) return "Reclamada";
  return "Terceiro";
}

/** Aplica a normalização correta para os campos cujo dropdown tem lista fixa
 *  (Tipo de Recurso, Parte Recorrente). Para os demais campos, devolve o valor
 *  original. Usado tanto pelo preenchimento da Judit quanto pelo da IA. */
function normalizarValorPorCampo(
  campo: string,
  valor: any,
  reclamante: string,
  reclamada: string,
): any {
  if (valor === null || valor === undefined) return valor;
  if (
    campo === "tipo_recurso" ||
    campo === "tipo_recurso_reclamante" ||
    campo === "tipo_recurso_banco" ||
    campo === "tipo_recurso_terceiro"
  ) {
    return normalizarTipoRecurso(valor);
  }
  if (campo === "parte_recorrente") {
    return normalizarParteRecorrente(valor, reclamante, reclamada);
  }
  return valor;
}

import { Badge } from "@/components/ui/badge";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";
import {
  useTurmasTst,
  useRelatoresTst,
  classificarTurmaDB,
  classificarRelatorDB,
} from "@/hooks/useClassificacaoTst";

interface Props {
  dado?: DistribuicaoTst | null;
  onSave: (dado: DistribuicaoTstInsert, id?: string) => Promise<boolean | string>;
  onCancel: () => void;
  onJuditSync?: (newId?: string) => void;
  /** Callback disparado quando a busca Judit retorna attachments (com anexos). */
  onAnexosFound?: (atts: any[]) => void;
  /** Sugestões geradas por IA a partir dos anexos. Aplicadas e marcadas em azul. */
  iaSugestao?: Record<string, any> | null;
  /** Resumo textual da última execução da IA (anexos), exibido próximo ao título
   *  e mesclado automaticamente em "Observação Advogado" para ficar persistido. */
  iaResumo?: string | null;
  /** Registro Dados Benner unificado nesta aba. Lê os campos exclusivos do
   *  Benner para edi\u00e7\u00e3o inline. */
  bennerDado?: any | null;
  /** Persiste o patch de campos exclusivos do Benner ap\u00f3s o save principal. */
  onSaveBennerExtra?: (patch: Record<string, any>, id?: string) => Promise<any>;
}

export interface DistribuicaoTstFormHandle {
  runJudit: (comAnexos: boolean, forceRefresh?: boolean) => Promise<void>;
  isBuscando: () => boolean;
  save: (options?: { silent?: boolean }) => Promise<boolean | string>;
}

const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

const emptyForm: DistribuicaoTstInsert = {
  processo_id: "",
  processo_numero: "",
  aba_origem: null,
  data_distribuicao_planilha: null,
  data_distribuicao_real: null,
  coordenacao_id: null,
  responsaveis_ids: [],
  dossie: null,
  equipe: null,
  reclamante: null,
  reclamada: null,
  relator: null,
  relator_favorabilidade: null,
  turma: null,
  turma_favorabilidade: null,
  parte_recorrente: null,
  tipo_recurso_reclamante: null,
  materias_recurso_reclamante: null,
  aparelhamento_reclamante: null,
  chance_exito_reclamante: null,
  tipo_recurso_banco: null,
  materias_recurso_banco: null,
  aparelhamento_banco: null,
  chance_exito_banco: null,
  tipo_recurso_terceiro: null,
  materias_recurso_terceiro: null,
  aparelhamento_terceiro: null,
  chance_exito_terceiro: null,
  honra: null,
  tema: null,
  execucao: null,
  midia_negativa: null,
  decisao_quarteirizado: null,
  recurso_terceiros: null,
  transito_julgado: false,
  benner_atualizado: false,
  judit_preenchido: false,
  judit_preenchido_em: null,
  judit_preenchido_por: null,
  observacao_advogado: null,
};

const EQUIPE_OPTIONS = [
  "Acordo Extrajudicial",
  "Ações Corporativas",
  "Ações Especiais",
  "Adm e Coligadas",
  "Núcleo Complementação de Aposentadoria",
  "Núcleo de Terceiros",
  "Núcleo Execução",
  "Núcleo Noroeste Sul",
  "Núcleo Sudeste",
];

const getEquipeOptions = (current?: string | null) => {
  const currentValue = String(current || "").trim();
  const options = currentValue && !EQUIPE_OPTIONS.includes(currentValue)
    ? [...EQUIPE_OPTIONS, currentValue]
    : EQUIPE_OPTIONS;
  return [...options].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
};

export const DistribuicaoTstForm = forwardRef<DistribuicaoTstFormHandle, Props>(function DistribuicaoTstForm(
  { dado, onSave, onCancel, onJuditSync, onAnexosFound, iaSugestao, iaResumo, bennerDado, onSaveBennerExtra }: Props,
  ref
) {
  const [form, setForm] = useState<DistribuicaoTstInsert>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [buscandoJudit, setBuscandoJudit] = useState(false);
  const queryClient = useQueryClient();
  const [responsaveisLoaded, setResponsaveisLoaded] = useState(false);
  const { data: turmasTst = [] } = useTurmasTst();
  const { data: relatoresTst = [] } = useRelatoresTst();
  // Marca dinamicamente, durante a sessão, os campos preenchidos por esta busca Judit.
  const [juditSessionFields, setJuditSessionFields] = useState<Set<string>>(new Set());
  // Marca os campos preenchidos pela IA a partir dos anexos.
  const [iaFields, setIaFields] = useState<Set<string>>(new Set());
  const [tipoRecursoJuditVazio, setTipoRecursoJuditVazio] = useState(false);

  // ============================================================
  // Campos exclusivos da tabela `dados_benner` (unificados nesta aba).
  // Carregados de `bennerDado` e persistidos via `onSaveBennerExtra`.
  // ============================================================
  const BENNER_EXTRA_FIELDS = [
    "analise_quarteirizado",
    "risco_midia",
    "risco_descricao",
    "provas_digitais",
    "materia_honra",
    "tem_data_julgamento",
    "data_julgamento",
    "horario_julgamento",
    "tipo_julgamento",
    "entrega_memoriais",
    "sustentacao_oral",
    "resultado_sem_transcendencia",
    "resultado_nao_conhecido",
    "resultado_conhecido_provido",
    "resultado_conhecido_nao_provido",
    "resultado_outra",
    "observacoes",
    "notas",
    "ganhamos",
    "perdemos",
    "processo_baixado",
    "chance_exito",
  ] as const;
  const buildBennerExtra = (src: any | null | undefined): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const k of BENNER_EXTRA_FIELDS) out[k] = src ? (src as any)[k] ?? null : null;
    return out;
  };
  const [bennerExtra, setBennerExtra] = useState<Record<string, any>>(() => buildBennerExtra(bennerDado));
  useEffect(() => {
    setBennerExtra(buildBennerExtra(bennerDado));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bennerDado?.id]);
  const setExtra = (field: string, value: any) =>
    setBennerExtra((prev) => ({ ...prev, [field]: value }));

  // Destaque verde "Judit" quando o registro foi preenchido pela Judit e o campo tem valor.
  const isJuditFilled = (value: any) =>
    (!!dado?.judit_preenchido || juditSessionFields.size > 0) && !!(value && String(value).trim());
  const juditClass = (value: any) =>
    isJuditFilled(value)
      ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 rounded-md transition-all"
      : "";
  const JuditBadge = ({ show }: { show: boolean }) =>
    show ? (
      <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4 font-normal border-emerald-500 text-emerald-600 dark:text-emerald-400">
        Judit
      </Badge>
    ) : null;

  const isIaFilled = (field: string, value: any) =>
    iaFields.has(field) && !!(value !== null && value !== undefined && String(value).trim() !== "");
  const iaClass = (field: string, value: any) =>
    isIaFilled(field, value)
      ? "ring-2 ring-sky-500 bg-sky-50 dark:bg-sky-950/30 rounded-md transition-all"
      : "";
  const fieldClass = (field: string, value: any) =>
    iaClass(field, value) || juditClass(value);
  const IaBadge = ({ field, value }: { field: string; value: any }) =>
    isIaFilled(field, value) ? (
      <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4 font-normal border-sky-500 text-sky-600 dark:text-sky-400">
        IA
      </Badge>
    ) : null;

  // Aplica sugestões da IA quando recebidas — sem sobrescrever o que o usuário já editou no formulário corrente.
  useEffect(() => {
    if (!iaSugestao || Object.keys(iaSugestao).length === 0) return;
    setForm((prev) => {
      const next: any = { ...prev };
      const filled = new Set(iaFields);
      const iaSituacao = String((iaSugestao as any)?.situacao_processo || "");
      const iaBaixado = String((iaSugestao as any)?.processo_baixado || "").toUpperCase();
      if (/ativ|active|em\s*curso|em\s*tramita|andamento/i.test(iaSituacao) || iaBaixado === "N") {
        next.transito_julgado = false;
        next.data_transito_julgado = null;
        filled.delete("transito_julgado");
      }
      // Campos que SEMPRE são da Judit (reutilizados também no Dados Benner).
      // A IA nunca pode tocar nesses, mesmo quando ainda estão vazios — eles
      // dependem da consulta Judit/cadastro existente.
      const ALWAYS_JUDIT = new Set(["relator", "turma", "tipo_recurso_reclamante", "tipo_recurso_terceiro"]);
      const isJuditField = (k: string) => {
        if (ALWAYS_JUDIT.has(k)) return true;
        // Bloqueia a IA de tocar em qualquer campo cujo valor veio (ou virá ao recarregar)
        // da Judit — fonte da verdade. Isso cobre tanto a sessão atual quanto o registro
        // já marcado como `judit_preenchido` no banco.
        if (juditSessionFields.has(k)) return true;
        if ((dado as any)?.judit_preenchido) {
          const v = (dado as any)?.[k];
          if (v !== null && v !== undefined && String(v).trim() !== "") return true;
        }
        return false;
      };
      for (const [k, v] of Object.entries(iaSugestao)) {
        if (v === null || v === undefined) continue;
        if (isJuditField(k)) continue;
        const cur = (prev as any)[k];
        const curEmpty = cur === null || cur === undefined || (typeof cur === "string" && cur.trim() === "");
        if (curEmpty) {
          const vNorm = normalizarValorPorCampo(k, v, String(prev.reclamante || ""), String(prev.reclamada || ""));
          if (vNorm === null || vNorm === undefined) continue;
          next[k] = vNorm;
          filled.add(k);
        }
      }
      setIaFields(filled);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(iaSugestao || {}), dado?.id]);

  useEffect(() => {
    const loadResponsaveis = async (id: string) => {
      const { data } = await supabase
        .from("dados_benner_responsaveis" as any)
        .select("usuario_id")
        .eq("dados_benner_id", id);
      const ids = ((data as any[]) || []).map(r => r.usuario_id);
      setForm(f => ({ ...f, responsaveis_ids: ids }));
      setResponsaveisLoaded(true);
    };

    if (dado) {
      setResponsaveisLoaded(false);
      const { id, created_at, updated_at, ...rest } = dado;
      const base: any = { ...emptyForm, ...rest, responsaveis_ids: undefined };
      // Reaplica sugestões da IA (somente em campos vazios e não-Judit) para
      // que a montagem da aba não apague as sugestões pendentes.
      if (iaSugestao && Object.keys(iaSugestao).length > 0) {
        const iaSituacao = String((iaSugestao as any)?.situacao_processo || "");
        const iaBaixado = String((iaSugestao as any)?.processo_baixado || "").toUpperCase();
        if (/ativ|active|em\s*curso|em\s*tramita|andamento/i.test(iaSituacao) || iaBaixado === "N") {
          base.transito_julgado = false;
          base.data_transito_julgado = null;
        }
        const ALWAYS_JUDIT = new Set(["relator", "turma", "tipo_recurso_reclamante", "tipo_recurso_terceiro"]);
        const filled = new Set<string>();
        for (const [k, v] of Object.entries(iaSugestao)) {
          if (v === null || v === undefined) continue;
          if (ALWAYS_JUDIT.has(k)) continue;
          if ((dado as any)?.judit_preenchido) {
            const dv = (dado as any)?.[k];
            if (dv !== null && dv !== undefined && String(dv).trim() !== "") continue;
          }
          const cur = base[k];
          const curEmpty = cur === null || cur === undefined || (typeof cur === "string" && cur.trim() === "");
          if (curEmpty) {
            const vNorm = normalizarValorPorCampo(k, v, String(base.reclamante || ""), String(base.reclamada || ""));
            if (vNorm === null || vNorm === undefined) continue;
            base[k] = vNorm; filled.add(k);
          }
        }
        if (filled.size > 0) setIaFields((prev) => new Set([...Array.from(prev), ...Array.from(filled)]));
      }
      setForm(base as DistribuicaoTstInsert);
      loadResponsaveis(dado.id);
    } else {
      setResponsaveisLoaded(true);
      const base: any = { ...emptyForm };
      if (iaSugestao && Object.keys(iaSugestao).length > 0) {
        const iaSituacao = String((iaSugestao as any)?.situacao_processo || "");
        const iaBaixado = String((iaSugestao as any)?.processo_baixado || "").toUpperCase();
        if (/ativ|active|em\s*curso|em\s*tramita|andamento/i.test(iaSituacao) || iaBaixado === "N") {
          base.transito_julgado = false;
          base.data_transito_julgado = null;
        }
        const ALWAYS_JUDIT = new Set(["relator", "turma", "tipo_recurso_reclamante", "tipo_recurso_terceiro"]);
        const filled = new Set<string>();
        for (const [k, v] of Object.entries(iaSugestao)) {
          if (v === null || v === undefined) continue;
          if (ALWAYS_JUDIT.has(k)) continue;
          const vNorm = normalizarValorPorCampo(k, v, String(base.reclamante || ""), String(base.reclamada || ""));
          if (vNorm === null || vNorm === undefined) continue;
          base[k] = vNorm; filled.add(k);
        }
        if (filled.size > 0) setIaFields((prev) => new Set([...Array.from(prev), ...Array.from(filled)]));
      }
      setForm(base);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // IMPORTANTE: só refaz a carga inicial quando muda o REGISTRO (dado.id).
    // NÃO depender de `dado` por referência nem de `iaSugestao` — caso contrário
    // qualquer refetch do parent ou sugestão da IA chegando durante a edição
    // sobrescreveria o que o advogado digitou (bug reportado: "ao salvar volta
    // os valores da Judit").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dado?.id]);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  // Mescla o resumo da IA em "Observação Advogado" para que fique persistido
  // de forma definitiva quando o usuário salvar. Evita duplicar o mesmo bloco.
  useEffect(() => {
    if (!iaResumo) return;
    setForm((prev) => {
      const atual = (prev.observacao_advogado || "").trim();
      if (atual.includes(iaResumo.trim())) return prev;
      const novo = atual ? `${atual}\n\n${iaResumo}` : iaResumo;
      return { ...prev, observacao_advogado: novo };
    });
    setIaFields((prev) => new Set([...Array.from(prev), "observacao_advogado"]));
  }, [iaResumo]);

  const handleBuscarJudit = async (comAnexosArg = false, forceRefresh = false) => {
    // Aceita o número vindo do form OU do `dado` carregado (corrige o bug onde
    // a 1ª tentativa falha "informe o número" porque o estado do form ainda não
    // sincronizou com a row do banco).
    const numeroRaw = ((form.processo_numero || (dado as any)?.processo_numero || "") as string).trim();
    const numero = aplicarMascaraCnj(numeroRaw);
    if (!numero) {
      toast.warning("Informe o número do processo antes de buscar na Judit");
      return;
    }
    // Garante que o form tem o número (caso o usuário tenha digitado sem blur)
    if (!form.processo_numero || form.processo_numero !== numero) {
      setForm(f => ({ ...f, processo_numero: numero }));
    }
    setBuscandoJudit(true);
    try {
      // Salva o que a advogada já digitou ANTES de consultar a Judit, para
      // que nenhum dado não salvo seja perdido caso a Judit sobrescreva
      // campos ou se algo falhe no meio do caminho.
      try {
        const prePayload: DistribuicaoTstInsert = { ...form, processo_numero: numero };
        if (!prePayload.processo_id && prePayload.processo_numero?.trim()) {
          const { data: proc } = await supabase
            .from("processos")
            .select("id")
            .eq("numero", prePayload.processo_numero.trim())
            .maybeSingle();
          if (proc) prePayload.processo_id = proc.id;
          else {
            const { data: existingId } = await supabase.rpc(
              "find_processo_id_by_numero" as any,
              { _numero: prePayload.processo_numero.trim() }
            );
            if (existingId) prePayload.processo_id = existingId as string;
          }
        }
        const preResult = await onSave(prePayload, dado?.id);
        if (preResult && typeof preResult === "string" && !dado?.id) {
          // Novo registro: propaga o id para o parent para que `dado` seja
          // recarregado e o auto-save pós-Judit atualize a mesma linha.
          onJuditSync?.(preResult);
        }
      } catch (e) {
        console.warn("Pré-save antes da Judit falhou:", e);
      }
      const requestPayload = { numero_processo: numero, tribunal: "TST", com_anexos: comAnexosArg, force_refresh: forceRefresh };
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: requestPayload,
      });
      // Persiste log da consulta (sucesso, erro de função ou erro retornado).
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("judit_logs" as any).insert({
          processo_numero: numero,
          tribunal: "TST",
          request_payload: { ...requestPayload, numero_processo_original: numeroRaw },
          raw_response: data ?? null,
          status: error ? "erro_funcao" : (data?.error ? "erro_api" : "sucesso"),
          error_message: error?.message || data?.error || null,
          created_by: userData?.user?.id || null,
        });
      } catch (logErr) {
        console.warn("Falha ao gravar judit_logs:", logErr);
      }
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("timeout") || msg.includes("aborted") || msg.includes("network")) {
          toast.error("A Judit demorou mais que o normal. Tente novamente em alguns segundos — o resultado já pode estar em cache.");
        } else {
          toast.error("Erro ao buscar na Judit: " + (error.message || "desconhecido"));
        }
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (comAnexosArg) {
        const atts = Array.isArray((data as any)?.attachments) ? (data as any).attachments : [];
        // Persiste no Supabase (judit_anexos) para sobreviver a reload/nova busca.
        // Quando a busca atual TAMBÉM é "com anexos", a lista deve ser ATUALIZADA
        // (substituída) com o resultado mais recente — apagamos os registros
        // antigos do mesmo processo antes de inserir os novos. Quando a Judit
        // retorna 0 anexos nesta tentativa, preservamos a lista anterior
        // (não apagamos nada) para não perder o que veio da consulta anterior.
        if (atts.length > 0) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            const rowsRaw = atts.map((a: any) => ({
              processo_numero: numero,
              cnj: a?.cnj || numero,
              instance: a?.instance != null ? String(a.instance) : null,
              attachment_id: String(a?.step_id || a?.attachment_id || ""),
              step_id: a?.step_id ? String(a.step_id) : null,
              attachment_name: a?.attachment_name || null,
              attachment_date: a?.attachment_date || null,
              extension: a?.extension || null,
              status: a?.status || "done",
              corrupted: a?.corrupted ?? false,
              raw_attachment: a,
              created_by: userData?.user?.id || null,
            })).filter((r: any) => r.attachment_id);
            // Deduplica no cliente: mesmo nome/data/ext = mesmo documento lógico,
            // ainda que a Judit repita em instâncias diferentes ou marque como "(cópia)".
            const seen = new Set<string>();
            const rows = rowsRaw.filter((r: any) => {
              const key = getJuditAttachmentDedupKey(r);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            if (rows.length > 0) {
              // Substitui a lista anterior do processo por completo.
              await supabase
                .from("judit_anexos" as any)
                .delete()
                .eq("processo_numero", numero);
              await supabase
                .from("judit_anexos" as any)
                .insert(rows);
            }
          } catch (e) {
            console.warn("Falha ao persistir judit_anexos:", e);
          }
        }
        // Notifica o parent: quando vieram anexos novos, manda a lista nova;
        // quando a busca não retornou nada, NÃO sobrescreve a lista existente
        // (passa undefined para que o parent recarregue do Supabase).
        if (atts.length > 0) {
          onAnexosFound?.(atts);
        }
        if (atts.length === 0) {
          toast.warning("Judit não retornou anexos nesta consulta — a lista anterior foi mantida.");
        } else {
          toast.success(`Judit retornou ${atts.length} anexo(s).`);
        }
      }

      // Extrai reclamante / reclamada das partes (polo ativo / passivo, sem advogados).
      // Usa `lado_efetivo` (derivado de person_type) quando disponível; cai para `polo`
      // apenas como fallback. Isso evita misturar banco/reclamante em recursos onde
      // ambos figuram como AGRAVANTE/RECORRENTE.
      // PRIORIDADE: usa reclamante/reclamada já desambiguados pelo backend
      // (cruzamento com person_type da instância de origem). Só faz fallback
      // por polo ACTIVE/PASSIVE quando o backend não conseguiu identificar —
      // ATENÇÃO: ACTIVE/PASSIVE no TST = recorrente/recorrido, NÃO reclamante/reclamada,
      // por isso o backend é a fonte preferida.
      const partes = Array.isArray(data?.parties_detail) ? data.parties_detail : [];
      // Persiste as partes (origem 'judit') para que a aba "Partes do processo"
      // reflita imediatamente o resultado da consulta Judit.
      try {
        const bennerId = (dado as any)?.id || null;
        if (bennerId && partes.length > 0) {
          await persistirPartesJudit(bennerId, data);
          await queryClient.invalidateQueries({ queryKey: ["partes-processo-benner", bennerId] });
        }
      } catch (e) {
        console.warn("Falha ao persistir partes_processo_benner:", e);
      }
      const nomesPorPersonType = (re: RegExp) =>
        [...new Set(
          partes
            .filter((p: any) => !p?.is_advogado && re.test(String(p?.tipo_pessoa || "")))
            .map((p: any) => String(p?.nome || "").trim())
            .filter(Boolean)
        )].join(" / ");
      const reclamanteJudit = (data?.reclamante && String(data.reclamante).trim())
        || nomesPorPersonType(/RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE/i)
        || "";
      const reclamadaJudit = (data?.reclamada && String(data.reclamada).trim())
        || nomesPorPersonType(/RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/i)
        || "";

      const filled = new Set<string>(juditSessionFields);
      const hasValue = (value: any) => value !== null && value !== undefined && String(value).trim() !== "";
      const nextForm: DistribuicaoTstInsert = (() => {
        const next: any = { ...form };
        const apply = (field: string, novo: any) => {
          // Política: a Judit é fonte da verdade — sempre sobrescreve
          // qualquer valor existente quando retorna algo para o campo.
          if (hasValue(novo)) {
            next[field] = novo;
            filled.add(field);
          }
        };
        // Para Tipo de Recurso, a Judit é fonte ÚNICA: quando não confirma,
        // o valor antigo é APAGADO (sem fallback DataJud / classe da capa).
        const applyJuditOnly = (field: string, novo: any) => {
          const val = hasValue(novo) ? novo : null;
          next[field] = val;
          if (val) filled.add(field); else filled.delete(field);
        };
        apply("dossie", data.dossie);
        apply("data_distribuicao_real", data.data_distribuicao);
        apply("relator", data.relator);
        apply("turma", data.turma);
        // Classificação automática (Turma / Relator) com base no cadastro TST
        const turmaVal = next.turma;
        if (turmaVal) {
          const c = classificarTurmaDB(String(turmaVal), turmasTst);
          if (c === "POSITIVO") { next.turma_favorabilidade = "POSITIVA"; filled.add("turma_favorabilidade"); }
          else if (c === "NEGATIVO") { next.turma_favorabilidade = "NEGATIVA"; filled.add("turma_favorabilidade"); }
        }
        const relatorVal = next.relator;
        if (relatorVal) {
          const r = classificarRelatorDB(String(relatorVal), relatoresTst);
          if (r?.classificacao === "POSITIVO") { next.relator_favorabilidade = "POSITIVO"; filled.add("relator_favorabilidade"); }
          else if (r?.classificacao === "NEGATIVO") { next.relator_favorabilidade = "NEGATIVO"; filled.add("relator_favorabilidade"); }
        }
        apply("reclamante", reclamanteJudit);
        apply("reclamada", reclamadaJudit);
        apply(
          "parte_recorrente",
          normalizarParteRecorrente(data.recorrente, reclamanteJudit, reclamadaJudit),
        );
        // Tipo de recurso: Judit é fonte ÚNICA — mesma regra da aba Dados Benner.
        // Vazio da Judit APAGA valor antigo (inclusive valor importado de planilha).
        applyJuditOnly("tipo_recurso", normalizarTipoRecurso(data.tipo_recurso));
        applyJuditOnly("tipo_recurso_reclamante", normalizarTipoRecurso(data.tipo_recurso_reclamante));
        applyJuditOnly("tipo_recurso_banco", normalizarTipoRecurso(data.tipo_recurso_banco));
        applyJuditOnly("tipo_recurso_terceiro", normalizarTipoRecurso(data.tipo_recurso_terceiro));
        // Situação do processo / trânsito em julgado
        const situacao = (data.situacao_processo || "").toString();
        if (situacao) apply("situacao_processo", situacao);
        const baixado = (data.processo_baixado || "").toString().toUpperCase();
        if (baixado) next.processo_baixado = baixado;
        const juditAtivo = /ativ|active|em\s*curso|em\s*tramita|andamento/i.test(situacao) || baixado === "N";
        const ehTransito = !juditAtivo && (/arquivad|baixad|tr[âa]nsito/i.test(situacao) || baixado === "S");
        if (juditAtivo) {
          next.transito_julgado = false;
          next.data_transito_julgado = null;
          filled.delete("transito_julgado");
        } else if (ehTransito && next.transito_julgado !== true) {
          next.transito_julgado = true;
          filled.add("transito_julgado");
        }
        // Pauta de julgamento — não extraímos mais automaticamente.
        // (Os campos abaixo continuam editáveis manualmente no form.)
        return next;
      })();

      setForm(nextForm);

      setJuditSessionFields(filled);

      // Aviso visual quando a Judit não confirmou nenhum recurso interposto
      // (mesma lógica da aba Dados Benner).
      const meta = (data as any)?._judit_meta;
      const semRecurso =
        !data.tipo_recurso && !data.tipo_recurso_reclamante && !data.tipo_recurso_banco;
      setTipoRecursoJuditVazio(semRecurso && (meta?.fonte_tipo_recurso === "nenhuma" || semRecurso));

      const preenchidos = filled.size;
      if (preenchidos > 0) {
        toast.success(`Judit preencheu ${preenchidos} campo(s). Salvando automaticamente...`);
        try {
          const payload: DistribuicaoTstInsert = {
            ...nextForm,
            judit_preenchido: true,
            judit_preenchido_em: new Date().toISOString(),
          };
          if (!payload.processo_id && payload.processo_numero?.trim()) {
            const { data: proc } = await supabase
              .from("processos")
              .select("id")
              .eq("numero", payload.processo_numero.trim())
              .maybeSingle();
            if (proc) payload.processo_id = proc.id;
            else {
              const { data: existingId } = await supabase.rpc(
                "find_processo_id_by_numero" as any,
                { _numero: payload.processo_numero.trim() }
              );
              if (existingId) payload.processo_id = existingId as string;
            }
          }
          const result = await onSave(payload, dado?.id);
          if (result) {
            toast.success("Distribuição TST e Dados Benner sincronizados com Judit");
            // Se foi um insert novo, `result` é o id recém-criado; propaga para
            // o container habilitar as abas dependentes imediatamente.
            const newId = typeof result === "string" ? result : (dado?.id || undefined);
            onJuditSync?.(newId);
          }
        } catch (e: any) {
          console.error("Auto-save Judit falhou:", e);
        }
      } else {
        toast.info("Judit retornou dados, mas todos os campos já estavam preenchidos.");
      }
    } catch (e: any) {
      toast.error("Falha ao buscar na Judit: " + (e?.message || "erro desconhecido"));
    } finally {
      setBuscandoJudit(false);
    }
  };

  useImperativeHandle(ref, () => ({
    runJudit: (comAnexos: boolean, forceRefresh: boolean = false) => handleBuscarJudit(comAnexos, forceRefresh),
    isBuscando: () => buscandoJudit,
    save: (options?: { silent?: boolean }) => handleSave(options),
  }), [buscandoJudit, form, dado, juditSessionFields, turmasTst, relatoresTst]);

  const handleSave = async (options?: { silent?: boolean }): Promise<boolean | string> => {
    if (!form.processo_numero?.trim()) {
      toast.warning("Informe o número do processo");
      return false;
    }
    setSaving(true);

    // Garante sessão válida antes de tentar INSERT/UPDATE em tabelas com RLS.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      toast.error("Sua sessão expirou. Faça login novamente para salvar.");
      setSaving(false);
      return false;
    }

    if (!form.processo_id) {
      const { data: proc } = await supabase
        .from("processos")
        .select("id")
        .eq("numero", form.processo_numero.trim())
        .maybeSingle();
      if (proc) {
        form.processo_id = proc.id;
      } else {
        // Fallback: o processo pode existir mas estar invisível por RLS
        // (pertence a outro advogado/coordenação). Buscamos via RPC SECURITY
        // DEFINER antes de tentar inserir — caso contrário a UNIQUE
        // constraint em processos.numero quebra o save.
        const { data: existingId } = await supabase.rpc(
          "find_processo_id_by_numero" as any,
          { _numero: form.processo_numero.trim() }
        );
        if (existingId) {
          form.processo_id = existingId as string;
        } else {
        const { data: newProc, error } = await supabase
          .from("processos")
          .insert({
            numero: form.processo_numero.trim(),
            status: "ativo",
            area: "trabalhista",
            // RLS: precisa de advogado_responsavel_id = auth.uid() para que o
            // RETURNING enxergue a linha recém-criada (caso contrário 403).
            advogado_responsavel_id: sessionData.session.user.id,
          })
          .select("id")
          .single();
        if (error) {
          const msg = /row-level security/i.test(error.message)
            ? "Sem permissão para criar processo. Verifique se seu usuário está ativo e se a sessão não expirou."
            : error.message;
          toast.error("Erro ao criar processo: " + msg);
          setSaving(false);
          return false;
        }
        form.processo_id = newProc.id;
        }
      }
    }

    // Se a sessão Judit preencheu campos, marca o registro como preenchido pela Judit.
    const payloadBase = responsaveisLoaded ? form : ({ ...form, responsaveis_ids: undefined } as DistribuicaoTstInsert);
    const payload: DistribuicaoTstInsert = juditSessionFields.size > 0
      ? {
          ...payloadBase,
          judit_preenchido: true,
          judit_preenchido_em: new Date().toISOString(),
        }
      : payloadBase;
    // IMPORTANTE: persistir PRIMEIRO os campos exclusivos do Dados Benner
    // (Análise/Risco, Julgamento, Resultado, etc.) e SÓ DEPOIS salvar a
    // Distribuição. A save da distribuição aciona um reloadSavedRow no parent
    // que remonta este form (bump em saveVersion). Se o extra-save vier
    // depois, o form remonta com a snapshot anterior do bennerDado e a UI
    // mostra os valores antigos (parecendo que a alteração não foi salva),
    // mesmo com o banco já atualizado na sequência.
    const extraTargetId = (bennerDado as any)?.id || dado?.id;
    if (onSaveBennerExtra && extraTargetId) {
      try {
        await onSaveBennerExtra(bennerExtra, extraTargetId);
      } catch (e: any) {
        console.error("Falha ao salvar campos Benner unificados:", e);
      }
    }
    const ok = await onSave(payload, dado?.id);
    // Se for um INSERT (sem id prévio), o extra-save acima não tinha alvo.
    // Salva agora usando o id retornado pelo insert.
    if (ok && onSaveBennerExtra && !extraTargetId) {
      const newId = typeof ok === "string" ? ok : undefined;
      if (newId) {
        try {
          await onSaveBennerExtra(bennerExtra, newId);
        } catch (e: any) {
          console.error("Falha ao salvar campos Benner unificados (novo):", e);
        }
      }
    }
    setSaving(false);
    if (ok && !options?.silent) {
      toast.success("Salvo com sucesso!", { id: "save-success" });
    }
    return ok;
  };

  const SectionHeader = ({ title, color }: { title: string; color: string }) => (
    <div className={cn("px-4 py-2 rounded-t-lg font-semibold text-sm text-white", color)}>
      {title}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {iaResumo && (
          <div
            className="ml-2 max-w-[60%] rounded-md border border-sky-500/40 bg-sky-50 dark:bg-sky-950/30 px-3 py-1.5 text-[11px] leading-snug text-sky-900 dark:text-sky-200 whitespace-pre-wrap"
            title="Resumo da última análise da IA — gravado em Observação Advogado ao salvar"
          >
            {iaResumo}
          </div>
        )}
      </div>

      {/* SEÇÃO 1 - Rosa: Dados Básicos */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Dados Básicos" color="bg-[#782170]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data Distribuição Planilha</Label>
              <Input type="date" value={form.data_distribuicao_planilha || ""} onChange={e => set("data_distribuicao_planilha", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Data Distribuição Real</Label>
              <Input type="date" value={form.data_distribuicao_real || ""} onChange={e => set("data_distribuicao_real", e.target.value || null)} />
              <p className="text-[10px] text-muted-foreground">Preenchida via Judit ou manualmente</p>
            </div>
            <div className="space-y-2">
              <Label>Número do Processo</Label>
              <Input value={form.processo_numero || ""} onChange={e => set("processo_numero", e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dossiê</Label>
              <Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select value={String(form.equipe || "").trim() || "__none__"} onValueChange={v => set("equipe", v === "__none__" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  {getEquipeOptions(form.equipe).map((equipe) => (
                    <SelectItem key={equipe} value={equipe}>{equipe}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reclamante</Label>
              <Textarea
                value={form.reclamante || ""}
                onChange={e => set("reclamante", e.target.value || null)}
                rows={2}
                className="min-h-[76px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Reclamada</Label>
              <Textarea
                value={form.reclamada || ""}
                onChange={e => set("reclamada", e.target.value || null)}
                rows={2}
                className="min-h-[76px] resize-y"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Responsáveis</Label>
            <ResponsaveisSelector
              selectedIds={form.responsaveis_ids || []}
              onChange={(ids) => {
                setResponsaveisLoaded(true);
                set("responsaveis_ids", ids);
              }}
              placeholder="Selecionar um ou mais responsáveis..."
              coordenacaoId="3e47fc83-3539-4fa7-9fcf-33825120e1b7"
            />
          </div>
          <div className="space-y-2">
            <Label>Observação Advogado</Label>
            <Textarea
              value={form.observacao_advogado || ""}
              onChange={e => set("observacao_advogado", e.target.value || null)}
              placeholder="Anotações livres do advogado responsável..."
              rows={10}
              className="min-h-[240px] resize-y"
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2 - Azul: Relator e Turma */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Relator e Turma" color="bg-[#6D9EEB]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("relator", form.relator))}>
              <Label className="flex items-center">Relator <JuditBadge show={isJuditFilled(form.relator)} /><IaBadge field="relator" value={form.relator} /></Label>
              <RelatorTurmaCombo tipo="relator" value={form.relator} onChange={(v) => set("relator", v)} />
              {(() => {
                const r = classificarRelatorDB(form.relator as any, relatoresTst);
                if (!r) return null;
                const c = r.classificacao;
                const cls = c === "POSITIVO" ? "bg-green-100 text-green-800 border-green-300"
                  : c === "NEGATIVO" ? "bg-red-100 text-red-800 border-red-300"
                  : "bg-amber-100 text-amber-800 border-amber-300";
                return (
                  <Badge className={cn("border", cls)}>
                    Classificação: {c}{r.relator.observacao ? " ⚠" : ""}
                  </Badge>
                );
              })()}
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("relator_favorabilidade", form.relator_favorabilidade))}>
              <Label className="flex items-center">Relator (+ ou -) <JuditBadge show={isJuditFilled(form.relator_favorabilidade)} /><IaBadge field="relator_favorabilidade" value={form.relator_favorabilidade} /></Label>
              <Select value={form.relator_favorabilidade || "__none__"} onValueChange={v => set("relator_favorabilidade", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="POSITIVO">POSITIVO</SelectItem>
                  <SelectItem value="NEGATIVO">NEGATIVO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("turma", form.turma))}>
              <Label className="flex items-center">Turma <JuditBadge show={isJuditFilled(form.turma)} /><IaBadge field="turma" value={form.turma} /></Label>
              <RelatorTurmaCombo tipo="turma" value={form.turma} onChange={(v) => set("turma", v)} />
              {(() => {
                const c = classificarTurmaDB(form.turma as any, turmasTst);
                if (!c) return null;
                const cls = c === "POSITIVO" ? "bg-green-100 text-green-800 border-green-300"
                  : c === "NEGATIVO" ? "bg-red-100 text-red-800 border-red-300"
                  : "bg-amber-100 text-amber-800 border-amber-300";
                return <Badge className={cn("border", cls)}>Classificação: {c}</Badge>;
              })()}
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("turma_favorabilidade", form.turma_favorabilidade))}>
              <Label className="flex items-center">Turma (+ ou -) <JuditBadge show={isJuditFilled(form.turma_favorabilidade)} /><IaBadge field="turma_favorabilidade" value={form.turma_favorabilidade} /></Label>
              <Select value={form.turma_favorabilidade || "__none__"} onValueChange={v => set("turma_favorabilidade", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="POSITIVA">POSITIVA</SelectItem>
                  <SelectItem value="NEGATIVA">NEGATIVA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("parte_recorrente", form.parte_recorrente))}>
              <Label className="flex items-center">Parte Recorrente <JuditBadge show={isJuditFilled(form.parte_recorrente)} /><IaBadge field="parte_recorrente" value={form.parte_recorrente} /></Label>
              <Select value={form.parte_recorrente || "__none__"} onValueChange={v => set("parte_recorrente", v === "__none__" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="Reclamante">Reclamante</SelectItem>
                  <SelectItem value="Reclamada">Reclamado</SelectItem>
                  <SelectItem value="Reclamante e Reclamada">Reclamante e Reclamado</SelectItem>
                  <SelectItem value="Terceiro">Terceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3 - Recurso Reclamante */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso Reclamante" color="bg-[#F9CB9C] !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tipo_recurso_reclamante", form.tipo_recurso_reclamante))}>
              <Label className="flex items-center">
                Tipo de Recurso do Reclamante
                <JuditBadge show={isJuditFilled(form.tipo_recurso_reclamante)} />
                <IaBadge field="tipo_recurso_reclamante" value={form.tipo_recurso_reclamante} />
              </Label>
              <MultiTipoRecurso
                value={form.tipo_recurso_reclamante}
                onChange={(v) => set("tipo_recurso_reclamante", v)}
              />
              {tipoRecursoJuditVazio && (
                <div className="text-xs rounded border border-amber-300 bg-amber-50 text-amber-900 px-2 py-1.5 leading-snug">
                  ⚠ Judit não identificou recurso interposto neste processo. Os
                  campos de Tipo de Recurso foram limpos. Preencha manualmente
                  apenas se você confirmar a existência de um recurso pelo
                  PJe/TST.
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Aparelhamento</Label>
              <Select value={form.aparelhamento_reclamante || "__none__"} onValueChange={v => set("aparelhamento_reclamante", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="BEM APARELHADO">BEM APARELHADO</SelectItem>
                  <SelectItem value="MAL APARELHADO">MAL APARELHADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matérias Recurso Reclamante</Label>
            <MateriasMultiSelect
              value={form.materias_recurso_reclamante || null}
              onChange={(v) => set("materias_recurso_reclamante", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito</Label>
            <Select value={form.chance_exito_reclamante || "__none__"} onValueChange={v => set("chance_exito_reclamante", v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                <SelectItem value="PROVÁVEL">PROVÁVEL</SelectItem>
                <SelectItem value="POSSÍVEL">POSSÍVEL</SelectItem>
                <SelectItem value="REMOTA">REMOTA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 4 - Recurso Banco */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso Banco" color="bg-[#B6D7A8] !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tipo_recurso_banco", form.tipo_recurso_banco))}>
              <Label className="flex items-center">
                Tipo de Recurso do Banco
                <JuditBadge show={isJuditFilled(form.tipo_recurso_banco)} />
                <IaBadge field="tipo_recurso_banco" value={form.tipo_recurso_banco} />
              </Label>
              <MultiTipoRecurso
                value={form.tipo_recurso_banco}
                onChange={(v) => set("tipo_recurso_banco", v)}
              />
              {tipoRecursoJuditVazio && (
                <div className="text-xs rounded border border-amber-300 bg-amber-50 text-amber-900 px-2 py-1.5 leading-snug">
                  ⚠ Judit não identificou recurso interposto neste processo. Os
                  campos de Tipo de Recurso foram limpos. Preencha manualmente
                  apenas se você confirmar a existência de um recurso pelo
                  PJe/TST.
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Aparelhamento</Label>
              <Select value={form.aparelhamento_banco || "__none__"} onValueChange={v => set("aparelhamento_banco", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="BEM APARELHADO">BEM APARELHADO</SelectItem>
                  <SelectItem value="MAL APARELHADO">MAL APARELHADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matérias Recurso do Banco</Label>
            <MateriasMultiSelect
              value={form.materias_recurso_banco || null}
              onChange={(v) => set("materias_recurso_banco", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito</Label>
            <Select value={form.chance_exito_banco || "__none__"} onValueChange={v => set("chance_exito_banco", v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                <SelectItem value="PROVÁVEL">PROVÁVEL</SelectItem>
                <SelectItem value="POSSÍVEL">POSSÍVEL</SelectItem>
                <SelectItem value="REMOTA">REMOTA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 4B - Recurso de terceiro (*preenchimento IA - não preencher) */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso de terceiro (*preenchimento IA - não preencher)" color="bg-[#A4C2F4] !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tipo_recurso_terceiro", (form as any).tipo_recurso_terceiro))}>
              <Label className="flex items-center">
                Tipo de Recurso (Terceiro)
                <JuditBadge show={isJuditFilled((form as any).tipo_recurso_terceiro)} />
                <IaBadge field="tipo_recurso_terceiro" value={(form as any).tipo_recurso_terceiro} />
              </Label>
              <MultiTipoRecurso
                value={(form as any).tipo_recurso_terceiro}
                onChange={(v) => set("tipo_recurso_terceiro", v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Aparelhamento</Label>
              <Select
                value={(form as any).aparelhamento_terceiro || "__none__"}
                onValueChange={(v) => set("aparelhamento_terceiro", v === "__none__" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="BEM APARELHADO">BEM APARELHADO</SelectItem>
                  <SelectItem value="MAL APARELHADO">MAL APARELHADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matérias Recurso (Terceiro)</Label>
            <MateriasMultiSelect
              value={(form as any).materias_recurso_terceiro || null}
              onChange={(v) => set("materias_recurso_terceiro", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito</Label>
            <Select
              value={(form as any).chance_exito_terceiro || "__none__"}
              onValueChange={(v) => set("chance_exito_terceiro", v === "__none__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                <SelectItem value="PROVÁVEL">PROVÁVEL</SelectItem>
                <SelectItem value="POSSÍVEL">POSSÍVEL</SelectItem>
                <SelectItem value="REMOTA">REMOTA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 5 - Análise */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Análise" color="bg-[#1D69C8]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Honra</Label>
              <Select value={form.honra || "__none__"} onValueChange={v => set("honra", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tema IRR</Label>
              <Input value={form.tema || ""} onChange={e => set("tema", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Execução</Label>
              <Select value={form.execucao || "__none__"} onValueChange={v => set("execucao", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mídia Negativa</Label>
              <Select value={form.midia_negativa || "__none__"} onValueChange={v => set("midia_negativa", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recurso de Terceiros</Label>
              <Select value={form.recurso_terceiros || "__none__"} onValueChange={v => set("recurso_terceiros", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Decisão - Análise do Quarteirizado</Label>
            {(() => {
              const OPCOES_QUARTEIRIZADO = [
                "Acordo",
                "Arquivado",
                "Desistir - Falha Processual",
                "Desistir - Fatos e Provas",
                "Desistir - Jurisprudência consolidada",
                "Desistir - Mídia Negativa",
                "Desistir - Súmula 266 C.TST",
                "Prosseguir",
                "Sobrestamento",
              ];
              const valor = form.decisao_quarteirizado || "";
              const isPredef = OPCOES_QUARTEIRIZADO.includes(valor);
              return (
                <div className="space-y-2">
                  <Select
                    value={isPredef ? valor : (valor ? "__custom__" : "__none__")}
                    onValueChange={(v) => {
                      if (v === "__none__") set("decisao_quarteirizado", null);
                      else if (v === "__custom__") set("decisao_quarteirizado", valor && !isPredef ? valor : " ");
                      else set("decisao_quarteirizado", v);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione</SelectItem>
                      {OPCOES_QUARTEIRIZADO.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">Outro…</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isPredef && valor && (
                    <Input
                      value={valor}
                      onChange={e => set("decisao_quarteirizado", e.target.value)}
                      placeholder="Descreva a decisão"
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* SE\u00c7\u00c3O - Dados Benner (campos exclusivos unificados nesta aba) */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Dados Benner — Análise / Risco" color="bg-[#0F766E]" />
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Análise Quarteirizado</Label>
            <Textarea
              value={bennerExtra.analise_quarteirizado || ""}
              onChange={e => setExtra("analise_quarteirizado", e.target.value)}
              rows={6}
              className="min-h-[140px] resize-y"
              placeholder="Descreva a análise do quarteirizado..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Risco Mídia Negativa</Label>
              <Select value={bennerExtra.risco_midia || "__none__"} onValueChange={v => setExtra("risco_midia", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risco (descrição)</Label>
              <Input value={bennerExtra.risco_descricao || ""} onChange={e => setExtra("risco_descricao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Provas Digitais</Label>
              <Select value={bennerExtra.provas_digitais || "__none__"} onValueChange={v => setExtra("provas_digitais", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matéria de Honra</Label>
            <Select value={bennerExtra.materia_honra || "__none__"} onValueChange={v => setExtra("materia_honra", v === "__none__" ? "" : v)}>
              <SelectTrigger className="md:w-1/3"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                <SelectItem value="S">S</SelectItem>
                <SelectItem value="N">N</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SE\u00c7\u00c3O - Dados Benner / Julgamento */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Dados Benner — Julgamento" color="bg-[#0E7490]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Data Julgamento?</Label>
              <Select value={bennerExtra.tem_data_julgamento || "__none__"} onValueChange={v => setExtra("tem_data_julgamento", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Julgamento</Label>
              <Input type="date" value={bennerExtra.data_julgamento || ""} onChange={e => setExtra("data_julgamento", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={bennerExtra.horario_julgamento || ""} onChange={e => setExtra("horario_julgamento", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo Julgamento</Label>
              <Select value={bennerExtra.tipo_julgamento || "__none__"} onValueChange={v => setExtra("tipo_julgamento", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Telepresencial">Telepresencial</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entrega Memoriais</Label>
              <Select value={bennerExtra.entrega_memoriais || "__none__"} onValueChange={v => setExtra("entrega_memoriais", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sustentação Oral</Label>
              <Select value={bennerExtra.sustentacao_oral || "__none__"} onValueChange={v => setExtra("sustentacao_oral", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                  <SelectItem value="Não cabe">Não cabe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* SE\u00c7\u00c3O - Dados Benner / Resultado */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Dados Benner — Resultado" color="bg-green-600" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              ["resultado_sem_transcendencia", "Sem Transcendência"],
              ["resultado_nao_conhecido", "Não Conhecido"],
              ["resultado_conhecido_provido", "Conhecido e Provido"],
              ["resultado_conhecido_nao_provido", "Conhecido e Não Provido"],
            ] as const).map(([field, label]) => (
              <div key={field} className="flex items-center gap-2">
                <Checkbox
                  id={`be-${field}`}
                  checked={!!bennerExtra[field]}
                  onCheckedChange={v => setExtra(field, !!v)}
                />
                <Label htmlFor={`be-${field}`} className="text-sm cursor-pointer">{label}</Label>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Outra (descrição)</Label>
            <Input value={bennerExtra.resultado_outra || ""} onChange={e => setExtra("resultado_outra", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={bennerExtra.observacoes || ""} onChange={e => setExtra("observacoes", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={bennerExtra.notas || ""} onChange={e => setExtra("notas", e.target.value)} rows={3} placeholder="Anotações livres sobre este registro..." />
          </div>
        </div>
      </div>

      {/* SE\u00c7\u00c3O - Dados Benner / Fechamento */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Dados Benner — Fechamento" color="bg-yellow-500 !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="flex items-center gap-2">
              <Checkbox id="be-ganhamos" checked={!!bennerExtra.ganhamos} onCheckedChange={v => setExtra("ganhamos", !!v)} />
              <Label htmlFor="be-ganhamos" className="cursor-pointer">Ganhamos</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="be-perdemos" checked={!!bennerExtra.perdemos} onCheckedChange={v => setExtra("perdemos", !!v)} />
              <Label htmlFor="be-perdemos" className="cursor-pointer">Perdemos</Label>
            </div>
            <div className="space-y-2">
              <Label>Processo Baixado</Label>
              <Select value={bennerExtra.processo_baixado || "__none__"} onValueChange={v => setExtra("processo_baixado", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chance de Êxito (geral)</Label>
              <Select value={bennerExtra.chance_exito || "__none__"} onValueChange={v => setExtra("chance_exito", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="PROVÁVEL">PROVÁVEL</SelectItem>
                  <SelectItem value="POSSÍVEL">POSSÍVEL</SelectItem>
                  <SelectItem value="REMOTA">REMOTA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Trânsito em Julgado */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Trânsito em Julgado" color="bg-[#B4A7D6] !text-black" />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.transito_julgado} onCheckedChange={v => set("transito_julgado", v)} />
            <Label>Trânsito em Julgado</Label>
          </div>
        </div>
      </div>

      {/* Benner */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Benner Atualizado" color="bg-[#FF0000]" />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.benner_atualizado} onCheckedChange={v => set("benner_atualizado", v)} />
            <Label>Benner Atualizado</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
});
