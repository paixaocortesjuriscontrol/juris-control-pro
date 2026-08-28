import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
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
import {
  MateriasAnaliseList,
  reconcileMateriasAnalise,
  derivarAgregadosDeMaterias,
  type MateriaAnaliseItem,
} from "@/components/distribuicao-tst/MateriasAnaliseList";
import { MultiTipoRecurso } from "@/components/distribuicao-tst/MultiTipoRecurso";
import { RelatorTurmaCombo } from "@/components/distribuicao-tst/RelatorTurmaCombo";
import {
  persistirPartesJudit,
  normalizarTipoRecurso,
  normalizarParteRecorrente,
  normalizarValorPorCampo,
} from "@/lib/juditDistribuicaoTst";
import {
  recorrenteEnvolveReclamante,
  recorrenteEnvolveBanco,
  recorrenteEhTerceiro,
} from "@/utils/distribuicaoTstPendencias";

/** Asterisco vermelho indicando campo obrigatório (vide spec da advogada). */
const ReqMark = () => (
  <span className="text-red-600 font-bold ml-0.5" title="Campo obrigatório" aria-label="obrigatório">*</span>
);

/** Compara case-insensitive contra uma lista de alvos. Usado para
 *  condicionar asteriscos de obrigatoriedade (ex.: Mídia Negativa = SIM). */
const eq = (v: any, ...alvos: string[]) => {
  const s = String(v ?? "").trim().toUpperCase();
  return alvos.some((a) => s === a.toUpperCase());
};

import { Badge } from "@/components/ui/badge";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";
import { logJudit } from "@/lib/juditLog";
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
  /** Reporta a quantidade real de sugestões da IA que foram pintadas em azul
   *  no formulário (após filtragem por Judit, normalização etc.). Usado pelo
   *  pai para ajustar o resumo "N campo(s) Distribuição + M campo(s) Benner.". */
  onIaApplied?: (counts: { distribuicao: number; benner: number; distribuicaoFields: string[]; bennerFields: string[] }) => void;
}

export interface DistribuicaoTstFormHandle {
  runJudit: (comAnexos: boolean, forceRefresh?: boolean) => Promise<void>;
  isBuscando: () => boolean;
  save: (options?: { silent?: boolean }) => Promise<boolean | string>;
  getValues: () => any;
  /** Retorna o state `bennerExtra` (campos do quadro Análise/Julgamento que
   *  vivem fora do react-hook-form). Necessário para o botão "Verificar
   *  Pendências" avaliar o registro completo. */
  getBennerExtra: () => Record<string, any>;
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
  tribunal: "TST",
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

const normalizeDateInputValue = (value: any): any => {
  if (value === null || value === undefined || value === "") return value;
  const s = String(value).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return value;
};

const normalizeYesNoToSimNao = (value: any): any => {
  if (value === null || value === undefined || value === "") return value;
  const s = String(value).trim().toUpperCase();
  if (["S", "SIM", "YES", "TRUE"].includes(s)) return "SIM";
  if (["N", "NAO", "NÃO", "NO", "FALSE"].includes(s)) return "NÃO";
  return value;
};

const normalizeYesNoToSN = (value: any): any => {
  if (value === null || value === undefined || value === "") return value;
  const s = String(value).trim().toUpperCase();
  if (["S", "SIM", "YES", "TRUE"].includes(s)) return "S";
  if (["N", "NAO", "NÃO", "NO", "FALSE"].includes(s)) return "N";
  return value;
};

const normalizeBooleanLike = (value: any): any => {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return value;
  const s = String(value).trim().toUpperCase();
  if (["S", "SIM", "YES", "TRUE", "TRANSITADO"].includes(s)) return true;
  if (["N", "NAO", "NÃO", "NO", "FALSE", "ATIVO", "EM CURSO"].includes(s)) return false;
  return value;
};

const normalizeIaValueForField = (field: string, value: any, reclamante: string, reclamada: string): any => {
  const normalized = normalizarValorPorCampo(field, value, reclamante, reclamada);
  if (["honra", "execucao", "midia_negativa", "recurso_terceiros"].includes(field)) {
    return normalizeYesNoToSimNao(normalized);
  }
  if ([
    "risco_midia",
    "provas_digitais",
    "materia_honra",
    "tem_data_julgamento",
    "entrega_memoriais",
    "sustentacao_oral",
    "processo_baixado",
  ].includes(field)) {
    return normalizeYesNoToSN(normalized);
  }
  if (field === "transito_julgado") return normalizeBooleanLike(normalized);
  if ([
    "resultado_sem_transcendencia",
    "resultado_nao_conhecido",
    "resultado_conhecido_provido",
    "resultado_conhecido_nao_provido",
    "ganhamos",
    "perdemos",
  ].includes(field)) {
    return normalizeBooleanLike(normalized);
  }
  return normalizeDateInputValue(normalized);
};

const extractPersistedIaFields = (text?: string | null): Set<string> => {
  const fields = new Set<string>();
  if (!text) return fields;
  const re = /Campos IA (?:Distribuição|Benner):\s*([^\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((field) => fields.add(field));
  }
  return fields;
};

export const DistribuicaoTstForm = forwardRef<DistribuicaoTstFormHandle, Props>(function DistribuicaoTstForm(
  { dado, onSave, onCancel, onJuditSync, onAnexosFound, iaSugestao, iaResumo, bennerDado, onSaveBennerExtra, onIaApplied }: Props,
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
  // Última versão de `iaResumo` já mesclada em `observacao_advogado`, para que
  // atualizações posteriores (ex.: recontagem dos campos pintados) substituam
  // o bloco antigo no lugar em vez de duplicar.
  const lastIaResumoRef = useRef<string | null>(null);
  // ID real da linha ativa durante a sessão. Em "Novo registro + Judit", o
  // pré-save cria a linha antes da consulta; usar só `dado?.id` aqui ficava
  // preso no valor antigo (undefined) e o auto-save final inseria uma segunda
  // linha. Este ref é atualizado assim que o primeiro save retorna o id.
  const activeRecordIdRef = useRef<string | undefined>(dado?.id || undefined);
  useEffect(() => {
    activeRecordIdRef.current = dado?.id || undefined;
  }, [dado?.id]);
  const [tipoRecursoJuditVazio, setTipoRecursoJuditVazio] = useState(false);
  // true quando a Judit não devolveu a instância TST do processo nesta consulta.
  const [tstIndisponivel, setTstIndisponivel] = useState(false);

  // Campos que a tela identifica explicitamente com o badge "Judit".
  // O toast deve contar estes campos, não campos técnicos/ocultos nem campos
  // preenchidos pela Judit mas sem indicação visual no formulário.
  const camposJuditVisiveis = [
    "data_distribuicao_real",
    "tribunal",
    "reclamante",
    "reclamada",
    "relator",
    "relator_favorabilidade",
    "turma",
    "turma_favorabilidade",
    "parte_recorrente",
    "tipo_recurso_reclamante",
    "tipo_recurso_banco",
    "tipo_recurso_terceiro",
  ] as const;

  const isCampoJuditPersistido = (field: string, value: any) =>
    !!(dado as any)?.judit_preenchido &&
    juditSessionFields.size === 0 &&
    (camposJuditVisiveis as readonly string[]).includes(field) &&
    !!(value !== null && value !== undefined && String(value).trim() !== "");

  const contarCamposJuditVisiveis = (state: any, fields: Set<string>) => {
    let count = 0;
    for (const field of camposJuditVisiveis) {
      const value = state?.[field];
      const hasVisibleValue =
        typeof value === "boolean" ||
        (value !== null && value !== undefined && String(value).trim() !== "");
      if (fields.has(field) && hasVisibleValue) count++;
    }
    return count;
  };

  // ============================================================
  // Campos exclusivos da tabela `dados_benner` (unificados nesta aba).
  // Carregados de `bennerDado` e persistidos via `onSaveBennerExtra`.
  // ============================================================
  const BENNER_EXTRA_FIELDS = [
    "analise_quarteirizado",
    "risco_midia",
    "risco_descricao",
    "risco_nivel",
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
    "situacao_processo",
    "data_transito_julgado",
    "chance_exito",
    "materias_analise_reclamante",
    "materias_analise_banco",
    "tem_chance_exito_reclamante",
    "tem_chance_exito_banco",
    "tem_chance_exito_terceiro",
  ] as const;
  const buildBennerExtra = (src: any | null | undefined): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const k of BENNER_EXTRA_FIELDS) out[k] = src ? normalizeDateInputValue((src as any)[k] ?? null) : null;
    return out;
  };
  const [bennerExtra, setBennerExtra] = useState<Record<string, any>>(() => buildBennerExtra(bennerDado));
  // Snapshot do estado original carregado de `bennerDado` — usado para
  // computar o diff no save (só envia campos que o usuário realmente alterou).
  const [bennerExtraInitial, setBennerExtraInitial] = useState<Record<string, any>>(() => buildBennerExtra(bennerDado));
  // Indica que `bennerExtra` já foi populado a partir de uma carga real do
  // banco. Antes disso, NUNCA persistir (evita salvar tudo nulo e apagar
  // valores existentes em dados_benner numa race condition).
  const [bennerExtraLoaded, setBennerExtraLoaded] = useState<boolean>(!!bennerDado);
  // Campos que o usuário REALMENTE tocou nesta sessão de edição. É a fonte
  // da verdade do save: o que está aqui é persistido SEMPRE, mesmo que o
  // `bennerDado` ainda não tenha terminado de carregar (corrige o bug de
  // "salvou com sucesso" mas os campos Benner voltavam vazios quando a
  // advogada editava/salvava antes da carga em segundo plano concluir).
  const bennerDirtyRef = useRef<Set<string>>(new Set());
  // Refs-espelho SEMPRE atualizados a cada render. O botão "Salvar" do menu
  // esquerdo chama handleSave via useImperativeHandle, cujas dependências não
  // incluem bennerExtra — sem estes refs, o save rodava com uma closure
  // CONGELADA dos campos Benner (valores antigos) e o diff saía vazio,
  // descartando silenciosamente o que a advogada digitou.
  const bennerExtraRef = useRef<Record<string, any>>(bennerExtra);
  bennerExtraRef.current = bennerExtra;
  const bennerExtraInitialRef = useRef<Record<string, any>>(bennerExtraInitial);
  bennerExtraInitialRef.current = bennerExtraInitial;
  const bennerExtraLoadedRef = useRef<boolean>(bennerExtraLoaded);
  bennerExtraLoadedRef.current = bennerExtraLoaded;
  const bennerDadoRef = useRef<any>(bennerDado);
  bennerDadoRef.current = bennerDado;
  useEffect(() => {
    if (bennerDado) {
      const initial = buildBennerExtra(bennerDado);
      // NUNCA sobrescrever o que o usuário já digitou: mescla a carga do
      // banco preservando os campos marcados como "dirty".
      setBennerExtra((prev) => {
        const next = { ...initial };
        for (const k of bennerDirtyRef.current) next[k] = (prev as any)[k];
        return next;
      });
      setBennerExtraInitial(initial);
      setBennerExtraLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bennerDado?.id]);

  useEffect(() => {
    const persisted = extractPersistedIaFields((dado as any)?.observacao_advogado);
    if (persisted.size === 0) return;
    setIaFields((prev) => new Set([...Array.from(prev), ...Array.from(persisted)]));
  }, [dado?.id, (dado as any)?.observacao_advogado]);

  const setExtra = (field: string, value: any) => {
    bennerDirtyRef.current.add(field);
    setBennerExtra((prev) => ({ ...prev, [field]: value }));
  };

  // Destaque verde "Judit" somente nos campos preenchidos nesta consulta (ou
  // já marcados no registro), evitando pintar campos manuais só pelo flag geral.
  const isJuditFilled = (field: string, value: any) => {
    const hasVisibleValue =
      typeof value === "boolean" ||
      (value !== null && value !== undefined && String(value).trim() !== "");
    return hasVisibleValue && (juditSessionFields.has(field) || isCampoJuditPersistido(field, value));
  };
  const juditClass = (field: string, value: any) =>
    isJuditFilled(field, value)
      ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 rounded-md transition-all"
      : "";
  const JuditBadge = ({ show }: { show: boolean }) =>
    show ? (
      <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4 font-normal border-emerald-500 text-emerald-600 dark:text-emerald-400">
        Judit
      </Badge>
    ) : null;

  const isIaFilled = (field: string, value: any) =>
    iaFields.has(field) && value !== null && value !== undefined && (typeof value === "boolean" || String(value).trim() !== "");
  const iaClass = (field: string, value: any) =>
    isIaFilled(field, value)
      ? "ring-2 ring-sky-500 bg-sky-50 dark:bg-sky-950/30 rounded-md transition-all"
      : "";
  const fieldClass = (field: string, value: any) =>
    iaClass(field, value) || juditClass(field, value);
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
        filled.add("transito_julgado");
      }
      // Campos estruturais da Judit só são preservados quando já há valor real.
      // Se estiverem vazios, a IA pode sugerir preenchimento visual no formulário.
      const PREFER_JUDIT = new Set(["relator", "turma", "tipo_recurso_reclamante", "tipo_recurso_terceiro"]);
      const isJuditField = (k: string) => {
        if (PREFER_JUDIT.has(k)) {
          const v = (prev as any)?.[k] ?? (dado as any)?.[k];
          if (v !== null && v !== undefined && String(v).trim() !== "") return true;
        }
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
        const vNorm = normalizeIaValueForField(k, v, String(prev.reclamante || ""), String(prev.reclamada || ""));
        if (vNorm === null || vNorm === undefined) continue;
        // Regra: IA NUNCA substitui campos já preenchidos pela advogada
        // (ou vindos da planilha/registro salvo). Só preenche em branco.
        const cur = (prev as any)[k];
        const curEmpty =
          cur === null ||
          cur === undefined ||
          (typeof cur === "string" && cur.trim() === "") ||
          (Array.isArray(cur) && cur.length === 0);
        if (!curEmpty) continue;
        next[k] = vNorm;
        filled.add(k);
      }
      setIaFields(filled);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(iaSugestao || {}), dado?.id]);

  // A aba principal também contém campos exclusivos do Dados Benner; aplica as
  // sugestões neles e marca como dirty para que o próximo Salvar persista.
  useEffect(() => {
    if (!iaSugestao || Object.keys(iaSugestao).length === 0) return;
    const updates: Record<string, any> = {};
    for (const k of BENNER_EXTRA_FIELDS) {
      const v = (iaSugestao as any)?.[k];
      if (v === null || v === undefined) continue;
      // Só sugere em campos Benner vazios — nunca sobrescreve o que já está
      // preenchido (no form atual, no snapshot inicial do banco ou no bennerDado).
      const curForm = (form as any)?.[k];
      const curExtra = (bennerExtraRef.current as any)?.[k];
      const curBenner = (bennerDadoRef.current as any)?.[k];
      const isEmpty = (x: any) =>
        x === null ||
        x === undefined ||
        (typeof x === "string" && x.trim() === "") ||
        (Array.isArray(x) && x.length === 0);
      if (!isEmpty(curForm) || !isEmpty(curExtra) || !isEmpty(curBenner)) continue;
      updates[k] = normalizeIaValueForField(k, v, String(form.reclamante || ""), String(form.reclamada || ""));
    }
    const keys = Object.keys(updates);
    if (keys.length === 0) return;
    for (const k of keys) bennerDirtyRef.current.add(k);
    setBennerExtra((prev) => ({ ...prev, ...updates }));
    setIaFields((prev) => new Set([...Array.from(prev), ...keys]));
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
        const filled = new Set<string>();
        const iaSituacao = String((iaSugestao as any)?.situacao_processo || "");
        const iaBaixado = String((iaSugestao as any)?.processo_baixado || "").toUpperCase();
        if (/ativ|active|em\s*curso|em\s*tramita|andamento/i.test(iaSituacao) || iaBaixado === "N") {
          base.transito_julgado = false;
          base.data_transito_julgado = null;
          filled.add("transito_julgado");
        }
        const PREFER_JUDIT = new Set(["relator", "turma", "tipo_recurso_reclamante", "tipo_recurso_terceiro"]);
        for (const [k, v] of Object.entries(iaSugestao)) {
          if (v === null || v === undefined) continue;
          if (PREFER_JUDIT.has(k)) {
            const existing = base[k] ?? (dado as any)?.[k];
            if (existing !== null && existing !== undefined && String(existing).trim() !== "") continue;
          }
          if ((dado as any)?.judit_preenchido) {
            const dv = (dado as any)?.[k];
            if (dv !== null && dv !== undefined && String(dv).trim() !== "") continue;
          }
          // Nunca sobrescreve valor já persistido no registro (planilha/edição anterior).
          const existingBase = base[k];
          if (
            existingBase !== null &&
            existingBase !== undefined &&
            !(typeof existingBase === "string" && existingBase.trim() === "") &&
            !(Array.isArray(existingBase) && existingBase.length === 0)
          ) continue;
          const vNorm = normalizeIaValueForField(k, v, String(base.reclamante || ""), String(base.reclamada || ""));
          if (vNorm === null || vNorm === undefined) continue;
          base[k] = vNorm; filled.add(k);
        }
        if (filled.size > 0) setIaFields((prev) => new Set([...Array.from(prev), ...Array.from(filled)]));
      }
      setForm(base as DistribuicaoTstInsert);
      loadResponsaveis(dado.id);
    } else {
      setResponsaveisLoaded(true);
      const base: any = { ...emptyForm };
      if (iaSugestao && Object.keys(iaSugestao).length > 0) {
        const filled = new Set<string>();
        const iaSituacao = String((iaSugestao as any)?.situacao_processo || "");
        const iaBaixado = String((iaSugestao as any)?.processo_baixado || "").toUpperCase();
        if (/ativ|active|em\s*curso|em\s*tramita|andamento/i.test(iaSituacao) || iaBaixado === "N") {
          base.transito_julgado = false;
          base.data_transito_julgado = null;
          filled.add("transito_julgado");
        }
        const PREFER_JUDIT = new Set(["relator", "turma", "tipo_recurso_reclamante", "tipo_recurso_terceiro"]);
        for (const [k, v] of Object.entries(iaSugestao)) {
          if (v === null || v === undefined) continue;
          if (PREFER_JUDIT.has(k)) {
            const existing = base[k];
            if (existing !== null && existing !== undefined && String(existing).trim() !== "") continue;
          }
          const vNorm = normalizeIaValueForField(k, v, String(base.reclamante || ""), String(base.reclamada || ""));
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
      const novoBloco = iaResumo.trim();
      if (atual.includes(novoBloco)) {
        lastIaResumoRef.current = iaResumo;
        return prev;
      }
      const anterior = lastIaResumoRef.current?.trim();
      let novo: string;
      if (anterior && atual.includes(anterior)) {
        novo = atual.replace(anterior, novoBloco).trim();
      } else {
        novo = atual ? `${atual}\n\n${iaResumo}` : iaResumo;
      }
      lastIaResumoRef.current = iaResumo;
      return { ...prev, observacao_advogado: novo };
    });
    setIaFields((prev) => new Set([...Array.from(prev), "observacao_advogado"]));
  }, [iaResumo]);

  // Reporta ao pai a quantidade real de campos pintados pela IA (após filtros
  // de Judit/normalização), para que o resumo "N campo(s) Distribuição + M
  // campo(s) Benner." bata com o que aparece em azul no formulário.
  useEffect(() => {
    if (!onIaApplied || !iaSugestao) return;
    const benSet = new Set<string>(BENNER_EXTRA_FIELDS as readonly string[]);
    const distribuicaoFields: string[] = [];
    const bennerFields: string[] = [];
    let dist = 0;
    let ben = 0;
    for (const k of iaFields) {
      if (k === "observacao_advogado") continue;
      if (!(k in (iaSugestao as Record<string, any>))) continue;
      if (benSet.has(k)) {
        ben++;
        bennerFields.push(k);
      } else {
        dist++;
        distribuicaoFields.push(k);
      }
    }
    onIaApplied({ distribuicao: dist, benner: ben, distribuicaoFields, bennerFields });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iaFields, JSON.stringify(iaSugestao || {})]);

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
        const preResult = await onSave(prePayload, activeRecordIdRef.current);
        if (preResult && typeof preResult === "string") {
          activeRecordIdRef.current = preResult;
        }
        if (preResult && typeof preResult === "string" && !dado?.id) {
          // Novo registro: propaga o id para o parent para que `dado` seja
          // recarregado e o auto-save pós-Judit atualize a mesma linha.
          onJuditSync?.(preResult);
        }
      } catch (e) {
        console.warn("Pré-save antes da Judit falhou:", e);
      }
      const requestPayload = { numero_processo: numero, tribunal: "TST", com_anexos: comAnexosArg, force_refresh: forceRefresh };
      const t0Judit = Date.now();
      const ehErroDeRede = (msg: string) => {
        const m = (msg || "").toLowerCase();
        return (
          m.includes("failed to send a request") ||
          m.includes("timeout") ||
          m.includes("aborted") ||
          m.includes("network") ||
          m.includes("fetch")
        );
      };
      // A instância TST pode exigir crawler + retentativa (duas rodadas). Se a
      // primeira tentativa cair por rede/timeout, repetimos UMA vez em vez de
      // mostrar erro no primeiro tropeço — o resultado normalmente já está
      // pronto no cache da Judit na segunda chamada.
      let data: any = null;
      let error: any = null;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const resp = await supabase.functions.invoke("buscar-judit", { body: requestPayload });
        data = resp.data;
        error = resp.error;
        if (!error || !ehErroDeRede(error.message || "")) break;
        if (tentativa === 0) {
          toast.info("A Judit está demorando para responder — tentando mais uma vez...", { duration: 4000 });
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      // Persiste log da consulta (sucesso, erro de função ou erro retornado),
      // já com usuário, origem, duração e tipo de cobrança para o /consumo-judit.
      await logJudit({
        processoNumero: numero,
        tribunal: "TST",
        requestPayload: { ...requestPayload, numero_processo_original: numeroRaw },
        juditData: data ?? null,
        juditError: error ?? null,
        duracaoMs: Date.now() - t0Judit,
        origem: "distribuicao-tst",
      });
      if (error) {
        if (ehErroDeRede(error.message || "")) {
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

      {
        const m = (data as any)?._judit_meta;
        const tribSel = String(m?.tribunal_selecionado || "").toUpperCase();
        const semTst = m?.tst_indisponivel === true || m?.instancia_tst === false || (!!tribSel && tribSel !== "TST");
        setTstIndisponivel(semTst);
        if (semTst) {
          toast.warning(
            "A Judit ainda não indexou a instância TST deste processo — tipo de recurso e situação não podem ser preenchidos automaticamente.",
            { duration: 8000 },
          );
        } else if (m?.respondido_do_cache === true) {
          const em = m?.app_cache_consultado_em
            ? new Date(m.app_cache_consultado_em).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;
          toast.success(
            em
              ? `Já consultado hoje às ${em} — reaproveitado sem novo custo`
              : "Já consultado hoje — reaproveitado sem novo custo",
          );
        }
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
      let juditBennerPatch: Record<string, any> | null = null;
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
        // Para Tipo de Recurso, a Judit é fonte ÚNICA — mas só APAGA o valor
        // antigo quando ela efetivamente consultou a instância TST. Se o
        // processo não tem TST (ex.: só TRT), preservamos o valor existente
        // (que pode ter vindo da planilha) em vez de zerar.
        const juditConfirmouTst =
          ((data as any)?._judit_meta?.tribunal_selecionado || "")
            .toString()
            .toUpperCase() === "TST";
        const applyJuditOnly = (field: string, novo: any) => {
          if (hasValue(novo)) {
            next[field] = novo;
            filled.add(field);
          } else if (juditConfirmouTst) {
            next[field] = null;
            filled.delete(field);
          }
          // sem TST e sem valor novo: preserva o que já estava
        };
        apply("dossie", data.dossie);
        apply("data_distribuicao_real", data.data_distribuicao);
        // Tribunal — quando a Judit confirma a instância, marca o campo como
        // preenchido pela Judit para receber o destaque verde no formulário.
        // Antes ficava sem badge na sessão atual (só aparecia depois de salvar
        // e reabrir o registro via `isCampoJuditPersistido`).
        apply("tribunal", data.tribunal);
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
        // Estes dois campos aparecem no bloco unificado "Fechamento" (estado
        // bennerExtra). Sem marcá-los como dirty ali, o auto-save da Judit
        // atualizava só o estado invisível do form e não persistia no banco.
        if (situacao || baixado) {
          const extraPatch: Record<string, any> = {};
          if (situacao) extraPatch.situacao_processo = situacao;
          if (baixado) extraPatch.processo_baixado = baixado;
          juditBennerPatch = extraPatch;
          setBennerExtra((prev) => ({ ...prev, ...extraPatch }));
          for (const k of Object.keys(extraPatch)) bennerDirtyRef.current.add(k);
        }
        // Precedência: se a Edge Function detectou trânsito pelas
        // movimentações (código CNJ 848, texto "Transitado em Julgado" ou
        // "Remetidos os Autos para o TRT"), usa esse resultado. Só cai no
        // fallback antigo (heurística por situacao/baixado) quando a detecção
        // veio nula (sem steps para analisar).
        const transitoDet = (data as any)?.transito_julgado_detectado;
        const dataTransitoDet = (data as any)?.data_transito_julgado_detectada || null;
        // `data_transito_julgado` vive no estado bennerExtra (bloco
        // "Fechamento"). Escrever só em `next` não persistia nada — por isso a
        // data detectada pela Judit era descartada. Espelhamos no patch Benner.
        const aplicarExtraTransito = (patch: Record<string, any>) => {
          juditBennerPatch = { ...(juditBennerPatch || {}), ...patch };
          setBennerExtra((prev) => ({ ...prev, ...patch }));
          for (const k of Object.keys(patch)) bennerDirtyRef.current.add(k);
        };
        if (transitoDet === true) {
          next.transito_julgado = true;
          if (dataTransitoDet) {
            next.data_transito_julgado = dataTransitoDet;
            aplicarExtraTransito({ data_transito_julgado: dataTransitoDet });
          }
          filled.add("transito_julgado");
          if (dataTransitoDet) filled.add("data_transito_julgado");
        } else if (transitoDet === false) {
          next.transito_julgado = false;
          next.data_transito_julgado = null;
          aplicarExtraTransito({ data_transito_julgado: null });
          filled.delete("transito_julgado");
          filled.delete("data_transito_julgado");
        } else {
          const juditAtivo = /ativ|active|em\s*curso|em\s*tramita|andamento/i.test(situacao) || baixado === "N";
          const ehTransito = !juditAtivo && (/arquivad|baixad|tr[âa]nsito/i.test(situacao) || baixado === "S");
          if (juditAtivo) {
            next.transito_julgado = false;
            next.data_transito_julgado = null;
            aplicarExtraTransito({ data_transito_julgado: null });
            filled.delete("transito_julgado");
          } else if (ehTransito && next.transito_julgado !== true) {
            next.transito_julgado = true;
            filled.add("transito_julgado");
          }
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

      const preenchidos = contarCamposJuditVisiveis(nextForm, filled);
      if (filled.size > 0) {
        toast.success(
          preenchidos > 0
            ? `Judit preencheu ${preenchidos} campo(s). Salvando automaticamente...`
            : "Judit atualizou dados. Salvando automaticamente...",
        );
        try {
          const extraTargetId = (bennerDadoRef.current as any)?.id || activeRecordIdRef.current || dado?.id;
          if (onSaveBennerExtra && extraTargetId && juditBennerPatch) {
            await onSaveBennerExtra(juditBennerPatch, extraTargetId);
          }
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
          const result = await onSave(payload, activeRecordIdRef.current);
          if (result) {
            toast.success("Distribuição TST e Dados Benner sincronizados com Judit");
            // Se foi um insert novo, `result` é o id recém-criado; propaga para
            // o container habilitar as abas dependentes imediatamente.
            if (typeof result === "string") activeRecordIdRef.current = result;
            const newId = typeof result === "string" ? result : (activeRecordIdRef.current || dado?.id || undefined);
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
    getValues: () => form,
    getBennerExtra: () => bennerExtraRef.current || {},
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
        // Coordenação responsável = coordenação do usuário que está cadastrando
        // (o gatilho no banco também resolve, mas enviamos explicitamente para
        // que a tela já reflita o valor correto).
        const { data: coordAutor } = await supabase.rpc(
          "get_user_coordenacao" as any,
          { _user_id: sessionData.session.user.id }
        );
        const { data: newProc, error } = await supabase
          .from("processos")
          .insert({
            numero: form.processo_numero.trim(),
            status: "ativo",
            area: "trabalhista",
            coordenacao_id: (coordAutor as string | null) || null,
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
    const payloadJudit: DistribuicaoTstInsert = juditSessionFields.size > 0
      ? {
          ...payloadBase,
          judit_preenchido: true,
          judit_preenchido_em: new Date().toISOString(),
        }
      : payloadBase;

    // Deriva campos LEGADOS (aparelhamento_*, recurso_*_aparelhado,
    // posicao_turma_*, posicao_relator_*) a partir da nova lista por matéria.
    // A planilha Benner e relatórios antigos continuam lendo esses campos —
    // mantemos compatibilidade sem precisar mexer no template.
    const matRecl = (bennerExtraRef.current as any).materias_analise_reclamante as MateriaAnaliseItem[] | null;
    const matBanco = (bennerExtraRef.current as any).materias_analise_banco as MateriaAnaliseItem[] | null;
    const aggRecl = derivarAgregadosDeMaterias(matRecl);
    const aggBanco = derivarAgregadosDeMaterias(matBanco);
    const payload: DistribuicaoTstInsert = { ...payloadJudit };
    if (aggRecl.aparelhamento !== null) (payload as any).aparelhamento_reclamante = aggRecl.aparelhamento;
    if (aggBanco.aparelhamento !== null) (payload as any).aparelhamento_banco = aggBanco.aparelhamento;

    // Booleans agregados em dados_benner — apenas escreve quando há lista.
    const derivedBenner: Record<string, any> = {};
    if ((matRecl && matRecl.length) || (matBanco && matBanco.length)) {
      derivedBenner.recurso_bem_aparelhado = aggRecl.bem || aggBanco.bem;
      derivedBenner.recurso_mal_aparelhado = aggRecl.mal || aggBanco.mal;
      derivedBenner.posicao_turma_favoravel = aggRecl.turma_favoravel || aggBanco.turma_favoravel;
      derivedBenner.posicao_turma_desfavoravel = aggRecl.turma_desfavoravel || aggBanco.turma_desfavoravel;
      derivedBenner.posicao_relator_favoravel = aggRecl.relator_favoravel || aggBanco.relator_favoravel;
      derivedBenner.posicao_relator_desfavoravel = aggRecl.relator_desfavoravel || aggBanco.relator_desfavoravel;
      for (const k of Object.keys(derivedBenner)) bennerDirtyRef.current.add(k);
      setBennerExtra((prev) => ({ ...prev, ...derivedBenner }));
    }

    // Computa o diff dos campos Benner unificados: envia SOMENTE os campos
    // que o usuário tocou nesta sessão (dirty). Isso é seguro mesmo que o
    // registro Benner ainda não tenha terminado de carregar em segundo plano
    // — campos não tocados nunca entram no patch, então nada é apagado.
    const buildBennerDiff = (): Record<string, any> | null => {
      const diff: Record<string, any> = {};
      const norm = (v: any) => (v === undefined || v === "" ? null : v);
      // Lê SEMPRE dos refs (valores atuais), nunca da closure — o save pode
      // ser disparado pelo botão externo via ref imperativa com closure velha.
      const extra = { ...bennerExtraRef.current, ...derivedBenner };
      const extraInitial = bennerExtraInitialRef.current;
      const extraLoaded = bennerExtraLoadedRef.current;
      for (const k of bennerDirtyRef.current) {
        const cur = (extra as any)[k];
        // Se a carga inicial concluiu, pula campos que voltaram ao valor
        // original; sem carga concluída, persiste tudo que foi tocado.
        if (extraLoaded) {
          const prev = (extraInitial as any)[k];
          if (norm(cur) === norm(prev)) continue;
        }
        diff[k] = norm(cur);
      }
      return Object.keys(diff).length > 0 ? diff : null;
    };
    const bennerDiff = buildBennerDiff();

    // DEBUG (temporário): log do Tipo de Recurso do Banco no momento do
    // salvamento, para investigar reports de "campo volta vazio ao salvar".
    // Mostra o valor que está indo no payload E o valor atual do state.
    try {
      // eslint-disable-next-line no-console
      console.info("[DistribuicaoTst][save] tipo_recurso_banco →", {
        formValue: (form as any).tipo_recurso_banco,
        payloadValue: (payload as any).tipo_recurso_banco,
        parte_recorrente: (payload as any).parte_recorrente,
        recordId: activeRecordIdRef.current || dado?.id || null,
        processo: payload.processo_numero,
      });
    } catch {}

    // IMPORTANTE: persistir PRIMEIRO os campos exclusivos do Dados Benner
    // (Análise/Risco, Julgamento, Resultado, etc.) e SÓ DEPOIS salvar a
    // Distribuição. A save da distribuição aciona um reloadSavedRow no parent
    // que remonta este form (bump em saveVersion). Se o extra-save vier
    // depois, o form remonta com a snapshot anterior do bennerDado e a UI
    // mostra os valores antigos (parecendo que a alteração não foi salva),
    // mesmo com o banco já atualizado na sequência.
    const extraTargetId = (bennerDadoRef.current as any)?.id || activeRecordIdRef.current || dado?.id;
    if (onSaveBennerExtra && extraTargetId && bennerDiff) {
      try {
        await onSaveBennerExtra(bennerDiff, extraTargetId);
      } catch (e: any) {
        console.error("Falha ao salvar campos Benner unificados:", e);
      }
    }
    const ok = await onSave(payload, activeRecordIdRef.current || dado?.id);
    if (ok && typeof ok === "string") activeRecordIdRef.current = ok;
    // Se for um INSERT (sem id prévio), o extra-save acima não tinha alvo.
    // Salva agora usando o id retornado pelo insert.
    if (ok && onSaveBennerExtra && !extraTargetId && bennerDiff) {
      const newId = typeof ok === "string" ? ok : undefined;
      if (newId) {
        try {
          await onSaveBennerExtra(bennerDiff, newId);
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
    <div id="dtst-form-root" className="space-y-6">
      {tstIndisponivel && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">A Judit ainda não indexou a instância TST deste processo</p>
          <p className="mt-1">
            Tipo de recurso, relator, turma e situação não podem ser preenchidos automaticamente
            enquanto a instância do TST não aparecer na base da Judit. Preencha manualmente ou tente
            novamente com “Forçar atualização”.
          </p>
        </div>
      )}
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
              <Label>Data Distribuição Planilha (D)</Label>
              <Input type="date" value={form.data_distribuicao_planilha || ""} onChange={e => set("data_distribuicao_planilha", e.target.value || null)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("data_distribuicao_real", form.data_distribuicao_real))}>
              <Label className="flex items-center">Data Distribuição Real (D)<ReqMark /> <JuditBadge show={isJuditFilled("data_distribuicao_real", form.data_distribuicao_real)} /></Label>
              <Input type="date" value={form.data_distribuicao_real || ""} onChange={e => set("data_distribuicao_real", e.target.value || null)} />
              <p className="text-[10px] text-muted-foreground">Preenchida via Judit ou manualmente</p>
            </div>
            <div className="space-y-2">
              <Label>Número do Processo<ReqMark /></Label>
              <Input value={form.processo_numero || ""} onChange={e => set("processo_numero", e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dossiê (A)<ReqMark /></Label>
              <Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tribunal", (form as any).tribunal))}>
              <Label className="flex items-center">Tribunal (B)<ReqMark /> <JuditBadge show={isJuditFilled("tribunal", (form as any).tribunal)} /></Label>
              <Select
                value={(form as any).tribunal || "TST"}
                onValueChange={v => set("tribunal", v)}
              >
                <SelectTrigger><SelectValue placeholder="TST" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TST">TST</SelectItem>
                  <SelectItem value="STF">STF</SelectItem>
                  <SelectItem value="STJ">STJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Equipe<ReqMark /></Label>
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
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("reclamante", form.reclamante))}>
              <Label className="flex items-center">Reclamante<ReqMark /> <JuditBadge show={isJuditFilled("reclamante", form.reclamante)} /></Label>
              <Textarea
                value={form.reclamante || ""}
                onChange={e => set("reclamante", e.target.value || null)}
                rows={2}
                className="min-h-[76px] resize-y"
              />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("reclamada", form.reclamada))}>
              <Label className="flex items-center">Reclamada<ReqMark /> <JuditBadge show={isJuditFilled("reclamada", form.reclamada)} /></Label>
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
              <Label className="flex items-center">Relator (F)<ReqMark /> <JuditBadge show={isJuditFilled("relator", form.relator)} /><IaBadge field="relator" value={form.relator} /></Label>
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
              <Label className="flex items-center">Relator (+ ou -) (AD/AE) <JuditBadge show={isJuditFilled("relator_favorabilidade", form.relator_favorabilidade)} /><IaBadge field="relator_favorabilidade" value={form.relator_favorabilidade} /></Label>
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
              <Label className="flex items-center">Turma (E)<ReqMark /> <JuditBadge show={isJuditFilled("turma", form.turma)} /><IaBadge field="turma" value={form.turma} /></Label>
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
              <Label className="flex items-center">Turma (+ ou -) (AB/AC) <JuditBadge show={isJuditFilled("turma_favorabilidade", form.turma_favorabilidade)} /><IaBadge field="turma_favorabilidade" value={form.turma_favorabilidade} /></Label>
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
              <Label className="flex items-center">Parte Recorrente (AA)<ReqMark /> <JuditBadge show={isJuditFilled("parte_recorrente", form.parte_recorrente)} /><IaBadge field="parte_recorrente" value={form.parte_recorrente} /></Label>
              <Select value={form.parte_recorrente || "__none__"} onValueChange={v => set("parte_recorrente", v === "__none__" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="Reclamante">Reclamante</SelectItem>
                  <SelectItem value="Reclamada">Reclamada</SelectItem>
                  <SelectItem value="Reclamante e Reclamada">Reclamante e Reclamada</SelectItem>
                  <SelectItem value="Terceiro">Terceiro</SelectItem>
                  <SelectItem value="Reclamante e Terceiro">Reclamante e Terceiro</SelectItem>
                  <SelectItem value="Reclamada e Terceiro">Reclamada e Terceiro</SelectItem>
                  <SelectItem value="Reclamante, Reclamada e Terceiro">Reclamante, Reclamada e Terceiro</SelectItem>
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
          {/* Asterisco condicional: só obrigatório quando o Reclamante figura como Parte Recorrente. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tipo_recurso_reclamante", form.tipo_recurso_reclamante))}>
              <Label className="flex items-center">
                Tipo de Recurso do Reclamante (C){recorrenteEnvolveReclamante(form) && <ReqMark />}
                <JuditBadge show={isJuditFilled("tipo_recurso_reclamante", form.tipo_recurso_reclamante)} />
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
            <div className={cn("space-y-2 p-2 -m-2", iaClass("tem_chance_exito_reclamante", bennerExtra.tem_chance_exito_reclamante))}>
              <Label className="flex items-center">
                Tem chance de êxito?{recorrenteEnvolveReclamante(form) && <ReqMark />}
                <IaBadge field="tem_chance_exito_reclamante" value={bennerExtra.tem_chance_exito_reclamante} />
              </Label>
              <Select
                value={bennerExtra.tem_chance_exito_reclamante || "__none__"}
                onValueChange={(v) => setExtra("tem_chance_exito_reclamante", v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={cn("space-y-2 p-2 -m-2", fieldClass("materias_recurso_reclamante", form.materias_recurso_reclamante))}>
            <Label className="flex items-center">Matérias Recurso Reclamante{recorrenteEnvolveReclamante(form) && <ReqMark />} <IaBadge field="materias_recurso_reclamante" value={form.materias_recurso_reclamante} /></Label>
            <MateriasMultiSelect
              value={form.materias_recurso_reclamante || null}
              onChange={(v) => set("materias_recurso_reclamante", v)}
            />
          </div>
          <MateriasAnaliseList
            title="Análise por matéria (Reclamante)"
            fieldKey="materias_analise_reclamante"
            materias={form.materias_recurso_reclamante || null}
            value={(bennerExtra.materias_analise_reclamante as MateriaAnaliseItem[] | null) || null}
            onChange={(next) => setExtra("materias_analise_reclamante", next)}
          />
        </div>
      </div>

      {/* SEÇÃO 4 - Recurso Banco */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso Banco" color="bg-[#B6D7A8] !text-black" />
        <div className="p-4 space-y-4">
          {/* Asterisco condicional: só obrigatório quando a Reclamada (banco) figura como Parte Recorrente. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tipo_recurso_banco", form.tipo_recurso_banco))}>
              <Label className="flex items-center">
                Tipo de Recurso do Banco (C){recorrenteEnvolveBanco(form) && <ReqMark />}
                <JuditBadge show={isJuditFilled("tipo_recurso_banco", form.tipo_recurso_banco)} />
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
            <div className={cn("space-y-2 p-2 -m-2", iaClass("tem_chance_exito_banco", bennerExtra.tem_chance_exito_banco))}>
              <Label className="flex items-center">
                Tem chance de êxito?
                <IaBadge field="tem_chance_exito_banco" value={bennerExtra.tem_chance_exito_banco} />
              </Label>
              <Select
                value={bennerExtra.tem_chance_exito_banco || "__none__"}
                onValueChange={(v) => setExtra("tem_chance_exito_banco", v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={cn("space-y-2 p-2 -m-2", fieldClass("materias_recurso_banco", form.materias_recurso_banco))}>
            <Label className="flex items-center">Matérias Recurso do Banco{recorrenteEnvolveBanco(form) && <ReqMark />} <IaBadge field="materias_recurso_banco" value={form.materias_recurso_banco} /></Label>
            <MateriasMultiSelect
              value={form.materias_recurso_banco || null}
              onChange={(v) => set("materias_recurso_banco", v)}
            />
          </div>
          <MateriasAnaliseList
            title="Análise por matéria (Banco)"
            fieldKey="materias_analise_banco"
            materias={form.materias_recurso_banco || null}
            value={(bennerExtra.materias_analise_banco as MateriaAnaliseItem[] | null) || null}
            onChange={(next) => setExtra("materias_analise_banco", next)}
          />
        </div>
      </div>

      {/* SEÇÃO 4B - Recurso de terceiro (*preenchimento IA - não preencher) */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso de terceiro (*preenchimento IA - não preencher)" color="bg-[#A4C2F4] !text-black" />
        <div className="p-4 space-y-4">
          {/* Asterisco condicional: só obrigatório quando Parte Recorrente = Terceiro. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tipo_recurso_terceiro", (form as any).tipo_recurso_terceiro))}>
              <Label className="flex items-center">
                Tipo de Recurso (Terceiro) (C){recorrenteEhTerceiro(form) && <ReqMark />}
                <JuditBadge show={isJuditFilled("tipo_recurso_terceiro", (form as any).tipo_recurso_terceiro)} />
                <IaBadge field="tipo_recurso_terceiro" value={(form as any).tipo_recurso_terceiro} />
              </Label>
              <MultiTipoRecurso
                value={(form as any).tipo_recurso_terceiro}
                onChange={(v) => set("tipo_recurso_terceiro", v)}
              />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("aparelhamento_terceiro", (form as any).aparelhamento_terceiro))}>
              <Label className="flex items-center">Aparelhamento (AF/AG) <IaBadge field="aparelhamento_terceiro" value={(form as any).aparelhamento_terceiro} /></Label>
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
          <div className={cn("space-y-2 p-2 -m-2", fieldClass("materias_recurso_terceiro", (form as any).materias_recurso_terceiro))}>
            <Label className="flex items-center">Matérias Recurso (Terceiro) <IaBadge field="materias_recurso_terceiro" value={(form as any).materias_recurso_terceiro} /></Label>
            <MateriasMultiSelect
              value={(form as any).materias_recurso_terceiro || null}
              onChange={(v) => set("materias_recurso_terceiro", v)}
            />
          </div>
          <div className={cn("space-y-2 p-2 -m-2", fieldClass("chance_exito_terceiro", (form as any).chance_exito_terceiro))}>
            <Label className="flex items-center">Chance de Êxito (AH) <IaBadge field="chance_exito_terceiro" value={(form as any).chance_exito_terceiro} /></Label>
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
          <div className={cn("space-y-2 p-2 -m-2", iaClass("tem_chance_exito_terceiro", bennerExtra.tem_chance_exito_terceiro))}>
            <Label className="flex items-center">
              Tem chance de êxito?{recorrenteEhTerceiro(form) && <ReqMark />}
              <IaBadge field="tem_chance_exito_terceiro" value={bennerExtra.tem_chance_exito_terceiro} />
            </Label>
            <Select
              value={bennerExtra.tem_chance_exito_terceiro || "__none__"}
              onValueChange={(v) => setExtra("tem_chance_exito_terceiro", v === "__none__" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                <SelectItem value="SIM">SIM</SelectItem>
                <SelectItem value="NÃO">NÃO</SelectItem>
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
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("honra", form.honra))}>
              <Label className="flex items-center">Matéria de Honra (O)<ReqMark /> <IaBadge field="honra" value={form.honra} /></Label>
              <Select value={form.honra || "__none__"} onValueChange={v => set("honra", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("tema", form.tema))}>
              <Label className="flex items-center">Tema IRR <IaBadge field="tema" value={form.tema} /></Label>
              <Input value={form.tema || ""} onChange={e => set("tema", e.target.value)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("execucao", form.execucao))}>
              <Label className="flex items-center">Execução<ReqMark /> <IaBadge field="execucao" value={form.execucao} /></Label>
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
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("midia_negativa", form.midia_negativa))}>
              <Label className="flex items-center">Mídia Negativa (H)<ReqMark /> <IaBadge field="midia_negativa" value={form.midia_negativa} /></Label>
              <Select value={form.midia_negativa || "__none__"} onValueChange={v => set("midia_negativa", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldClass("recurso_terceiros", form.recurso_terceiros))}>
              <Label className="flex items-center">Recurso de Terceiros<ReqMark /> <IaBadge field="recurso_terceiros" value={form.recurso_terceiros} /></Label>
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
          {/* Campos migrados de Dados Benner — Análise / Risco */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", iaClass("risco_nivel", bennerExtra.risco_nivel))}>
              <Label className="flex items-center">
                Risco — Nível
                {eq(form.midia_negativa, "SIM", "S") && <ReqMark />}
                <IaBadge field="risco_nivel" value={bennerExtra.risco_nivel} />
              </Label>
              <Select
                value={bennerExtra.risco_nivel || "__none__"}
                onValueChange={(v) => setExtra("risco_nivel", v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="ALTO">ALTO</SelectItem>
                  <SelectItem value="MÉDIO">MÉDIO</SelectItem>
                  <SelectItem value="BAIXO">BAIXO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("risco_descricao", bennerExtra.risco_descricao))}>
              <Label className="flex items-center">
                Risco (descrição) (I)
                {eq(form.midia_negativa, "SIM", "S") && <ReqMark />}
                <IaBadge field="risco_descricao" value={bennerExtra.risco_descricao} />
              </Label>
              <Input value={bennerExtra.risco_descricao || ""} onChange={e => setExtra("risco_descricao", e.target.value)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("provas_digitais", bennerExtra.provas_digitais))}>
              <Label className="flex items-center">Provas Digitais (J)<ReqMark /> <IaBadge field="provas_digitais" value={bennerExtra.provas_digitais} /></Label>
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
          {/* Decisão - Análise do Quarteirizado (G) — movido para o FIM do quadro Análise */}
          <div className={cn("space-y-2 p-2 -m-2", fieldClass("decisao_quarteirizado", form.decisao_quarteirizado))}>
            <Label className="flex items-center">Decisão - Análise do Quarteirizado (G)<ReqMark /> <IaBadge field="decisao_quarteirizado" value={form.decisao_quarteirizado} /></Label>
            {(() => {
              const OPCOES_QUARTEIRIZADO = [
                "Desistir - Falha Processual",
                "Desistir - Fatos e Provas",
                "Desistir - Jurisprudência consolidada",
                "Desistir - Mídia Negativa",
                "Desistir Súmula 266 C. TST",
                "Prosseguir",
              ];
              const valor = form.decisao_quarteirizado || "";
              const isPredef = OPCOES_QUARTEIRIZADO.includes(valor);
              const foraDaLista = !isPredef && !!valor.trim();
              return (
                <div className="space-y-2">
                  <Select
                    value={isPredef ? valor : (foraDaLista ? valor : "__none__")}
                    onValueChange={(v) => {
                      if (v === "__none__") set("decisao_quarteirizado", null);
                      else set("decisao_quarteirizado", v);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione</SelectItem>
                      {OPCOES_QUARTEIRIZADO.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                      {foraDaLista && (
                        <SelectItem value={valor} className="text-destructive">
                          {valor} (NÃO PODE ENVIAR BENNER)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {foraDaLista && (
                    <p className="text-xs text-destructive">
                      Valor fora da lista permitida — NÃO PODE ENVIAR BENNER.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* SE\u00c7\u00c3O - Dados Benner / Julgamento */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Julgamento" color="bg-[#0E7490]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", iaClass("tem_data_julgamento", bennerExtra.tem_data_julgamento))}>
              <Label className="flex items-center">Data Julgamento? (K)<ReqMark /> <IaBadge field="tem_data_julgamento" value={bennerExtra.tem_data_julgamento} /></Label>
              <Select value={bennerExtra.tem_data_julgamento || "__none__"} onValueChange={v => setExtra("tem_data_julgamento", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("data_julgamento", bennerExtra.data_julgamento))}>
              <Label className="flex items-center">
                Data Julgamento (L)
                {eq(bennerExtra.tem_data_julgamento, "S", "SIM") && <ReqMark />}
                <IaBadge field="data_julgamento" value={bennerExtra.data_julgamento} />
              </Label>
              <Input type="date" value={bennerExtra.data_julgamento || ""} onChange={e => setExtra("data_julgamento", e.target.value || null)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("horario_julgamento", bennerExtra.horario_julgamento))}>
              <Label className="flex items-center">
                Horário (M)
                {eq(bennerExtra.tem_data_julgamento, "S", "SIM") && <ReqMark />}
                <IaBadge field="horario_julgamento" value={bennerExtra.horario_julgamento} />
              </Label>
              <Input type="time" value={bennerExtra.horario_julgamento || ""} onChange={e => setExtra("horario_julgamento", e.target.value || null)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("tipo_julgamento", bennerExtra.tipo_julgamento))}>
              <Label className="flex items-center">
                Tipo Julgamento (N)
                {eq(bennerExtra.tem_data_julgamento, "S", "SIM") && <ReqMark />}
                <IaBadge field="tipo_julgamento" value={bennerExtra.tipo_julgamento} />
              </Label>
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
            <div className={cn("space-y-2 p-2 -m-2", iaClass("entrega_memoriais", bennerExtra.entrega_memoriais))}>
              <Label className="flex items-center">Entrega Memoriais (P) <IaBadge field="entrega_memoriais" value={bennerExtra.entrega_memoriais} /></Label>
              <Select value={bennerExtra.entrega_memoriais || "__none__"} onValueChange={v => setExtra("entrega_memoriais", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("sustentacao_oral", bennerExtra.sustentacao_oral))}>
              <Label className="flex items-center">Sustentação Oral (Q) <IaBadge field="sustentacao_oral" value={bennerExtra.sustentacao_oral} /></Label>
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
        <SectionHeader title="Resultado" color="bg-green-600" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              ["resultado_sem_transcendencia", "Sem Transcendência (R)"],
              ["resultado_nao_conhecido", "Não Conhecido (S)"],
              ["resultado_conhecido_provido", "Conhecido e Provido (T)"],
              ["resultado_conhecido_nao_provido", "Conhecido e Não Provido (U)"],
            ] as const).map(([field, label]) => (
              <div key={field} className={cn("flex items-center gap-2 p-2 -m-2", iaClass(field, bennerExtra[field]))}>
                <Checkbox
                  id={`be-${field}`}
                  checked={!!bennerExtra[field]}
                  onCheckedChange={v => setExtra(field, !!v)}
                />
                <Label htmlFor={`be-${field}`} className="text-sm cursor-pointer flex items-center">{label}<IaBadge field={field} value={bennerExtra[field]} /></Label>
              </div>
            ))}
          </div>
          <div className={cn("space-y-2 p-2 -m-2", iaClass("resultado_outra", bennerExtra.resultado_outra))}>
            <Label className="flex items-center">Outra (descrição) (V) <IaBadge field="resultado_outra" value={bennerExtra.resultado_outra} /></Label>
            <Input value={bennerExtra.resultado_outra || ""} onChange={e => setExtra("resultado_outra", e.target.value)} />
          </div>
          <div className={cn("space-y-2 p-2 -m-2", iaClass("observacoes", bennerExtra.observacoes))}>
            <Label className="flex items-center">Observações (W) <IaBadge field="observacoes" value={bennerExtra.observacoes} /></Label>
            <Textarea value={bennerExtra.observacoes || ""} onChange={e => setExtra("observacoes", e.target.value)} rows={3} />
          </div>
          <div className={cn("space-y-2 p-2 -m-2", iaClass("notas", bennerExtra.notas))}>
            <Label className="flex items-center">Notas <IaBadge field="notas" value={bennerExtra.notas} /></Label>
            <Textarea value={bennerExtra.notas || ""} onChange={e => setExtra("notas", e.target.value)} rows={3} placeholder="Anotações livres sobre este registro..." />
          </div>
        </div>
      </div>

      {/* SE\u00c7\u00c3O - Dados Benner / Fechamento */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Fechamento" color="bg-yellow-500 !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div className={cn("flex items-center gap-2 p-2 -m-2 h-10", iaClass("ganhamos", bennerExtra.ganhamos))}>
              <Checkbox id="be-ganhamos" checked={!!bennerExtra.ganhamos} onCheckedChange={v => setExtra("ganhamos", !!v)} />
              <Label htmlFor="be-ganhamos" className="cursor-pointer flex items-center">Ganhamos (X) <IaBadge field="ganhamos" value={bennerExtra.ganhamos} /></Label>
            </div>
            <div className={cn("flex items-center gap-2 p-2 -m-2 h-10", iaClass("perdemos", bennerExtra.perdemos))}>
              <Checkbox id="be-perdemos" checked={!!bennerExtra.perdemos} onCheckedChange={v => setExtra("perdemos", !!v)} />
              <Label htmlFor="be-perdemos" className="cursor-pointer flex items-center">Perdemos (Y) <IaBadge field="perdemos" value={bennerExtra.perdemos} /></Label>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("processo_baixado", bennerExtra.processo_baixado))}>
              <Label className="flex items-center">Processo Baixado (Z)<ReqMark /> <IaBadge field="processo_baixado" value={bennerExtra.processo_baixado} /></Label>
              <Select value={bennerExtra.processo_baixado || "__none__"} onValueChange={v => setExtra("processo_baixado", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("situacao_processo", bennerExtra.situacao_processo))}>
              <Label className="flex items-center">Situação do Processo <IaBadge field="situacao_processo" value={bennerExtra.situacao_processo} /></Label>
              <Input value={bennerExtra.situacao_processo || ""} onChange={e => setExtra("situacao_processo", e.target.value)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", iaClass("chance_exito", bennerExtra.chance_exito))}>
              <Label className="flex items-center">Chance de Êxito (geral) <IaBadge field="chance_exito" value={bennerExtra.chance_exito} /></Label>
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
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn("flex items-center gap-3 p-2 -m-2", fieldClass("transito_julgado", form.transito_julgado))}>
            <Switch checked={!!form.transito_julgado} onCheckedChange={v => set("transito_julgado", v)} />
            <Label className="flex items-center">Trânsito em Julgado <IaBadge field="transito_julgado" value={form.transito_julgado} /></Label>
          </div>
          <div className={cn("space-y-2 p-2 -m-2", iaClass("data_transito_julgado", bennerExtra.data_transito_julgado))}>
            <Label className="flex items-center">Data Trânsito em Julgado <IaBadge field="data_transito_julgado" value={bennerExtra.data_transito_julgado} /></Label>
            <Input type="date" value={bennerExtra.data_transito_julgado || ""} onChange={e => setExtra("data_transito_julgado", e.target.value || null)} />
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
