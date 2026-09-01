import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import JSZip from "jszip";
import { ajustarGrupoChanceExito, addMergeCell } from "@/utils/cargaBennerHeader";
import * as XLSX from "xlsx";
import {
  Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight, Mail,
} from "lucide-react";
import { useCriarRemessa } from "@/hooks/useRemessasBenner";
import { useNavigate } from "react-router-dom";
import { deriveRecorrenteFromRecursos, normalizeRecorrenteBenner, splitRecursoValues } from "@/utils/recorrenteFromRecursos";
import { isOutraMateria, normalizeMateriaNome } from "@/utils/outraMateria";
import { applyParteRecorrenteFilter } from "@/hooks/useDistribuicoesTst";
import { getPendencias } from "@/utils/distribuicaoTstPendencias";
import { getMotivoRecursoForaLista, MOTIVO_RECURSO_FORA_LISTA } from "@/utils/tipoRecursoOficial";
import { getDataDistribuicaoReal } from "@/utils/dataDistribuicaoBenner";

// --- Types ---
interface Stats {
  totalDistribuicoes: number;
  matched: number;
  unmatched: number;
  rejected: number;
  transitoJulgado: number;
  outputRows: number;
  sheetsBreakdown: { name: string; count: number }[];
  rejectionsByType: Record<string, number>;
  warnings?: number;
  warningsByType?: Record<string, number>;
}

interface RejeicaoRow {
  "Dossiê": string;
  "Número do Processo": string;
  "Data Distribuição": string;
  "Turma": string;
  "Relator": string;
  "Motivo": string;
  "Sem chance de êxito"?: string;
}


// --- Layout columns ---
const LAYOUT_COLS = [
  "Dossiê", "Tribunal (TST, STF ou STJ)", "Tipo de Recurso",
  "Data da distribuição no TST/STF", "Turma", "Relator",
  "Análise do quarteirizado", "Há risco de mídia negativa? (S/N)", "Risco",
  "Há discussão sobre provas digitais? (S/N)", "Temos data de julgamento? (S/N)",
  "Data Julgamento", "Horário", "Julgamento (Virtual, Telepresencial, Híbrido ou Presencial)",
  "Matéria de Honra (S/N)", "Entrega de Memoriais (S/N)", "Sustentação Oral (S/N/ Não cabe)",
  "Sem transcendência", "Recurso não conhecido", "Recurso conhecido e provido",
  "Recurso conhecido e não provido", "Outra", "Observações", "Ganhamos", "Perdemos",
  "Processo baixado do TST/STF (S/N)", "Recorrente", "Favorável (turma)",
  "Desfavorável (turma)", "Favorável (relator)", "Desfavorável (relator)",
  "Bem aparelhado", "Mal aparelhado", "Com chances de êxito",
  "Sem chance de êxito",
];

/** Índice (0-based) da nova coluna final "Sem chance de êxito". */
const COL_SEM_EXITO = LAYOUT_COLS.length - 1;


const DOSSIE_INVALIDO_PATTERNS = [
  /nao\s*(encontrad|localizad)/i, /inv[aá]lid/i, /sem\s*dossie/i,
  /caso\s+encerrado/i, /em\s+andamento\s+no\s+benner/i,
];
const DOSSIE_VALIDO_REGEX = /^\d{2}\.\d{2}\.\d{3}\.\d{6,12}\/\d{2}$/;

function normalizeText(val: unknown): string {
  return String(val ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function escXml(s: string): string {
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Grava (ou substitui) uma célula de cabeçalho de texto em uma linha XML já
 * existente, mantendo as demais células. Usado para acrescentar a coluna final
 * "Sem chance de êxito", ausente nos templates originais.
 */
function setHeaderCell(
  rowXml: string,
  rowNum: number,
  colIdx: number,
  strIdx: number,
  styleId: number,
  totalCols: number,
): string {
  const letter = colToLetter(colIdx);
  const cellXml = `<c r="${letter}${rowNum}" t="s"${styleId > 0 ? ` s="${styleId}"` : ""}><v>${strIdx}</v></c>`;
  if (!rowXml) {
    return `<row r="${rowNum}" spans="1:${totalCols}">${cellXml}</row>`;
  }
  const existing = new RegExp(`<c\\b[^>]*\\br="${letter}${rowNum}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  let out = existing.test(rowXml) ? rowXml.replace(existing, cellXml) : rowXml.replace(/<\/row>\s*$/, `${cellXml}</row>`);
  out = out.replace(/spans="[^"]*"/, `spans="1:${totalCols}"`);
  return out;
}



function isCnjLike(val: string): boolean {
  const s = String(val ?? "").trim();
  const digits = s.replace(/\D/g, "");
  return /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(s) || digits.length === 20;
}

function getMotivoRejeicaoDossie(dossie: string, numProcesso: string): string | null {
  const raw = String(dossie ?? "").trim();
  const normalized = normalizeText(raw);
  const procDigits = String(numProcesso ?? "").replace(/\D/g, "");
  const dossieDigits = raw.replace(/\D/g, "");
  if (!raw) return "Dossiê vazio";
  if (DOSSIE_INVALIDO_PATTERNS.some(p => p.test(normalized))) return "Dossiê não localizado";
  if (procDigits && dossieDigits === procDigits) return "Dossiê igual ao número do processo";
  if (isCnjLike(raw)) return "Dossiê preenchido com número do processo";
  if (/[a-z]/i.test(normalized)) return "Dossiê contém texto inválido";
  if (!DOSSIE_VALIDO_REGEX.test(raw)) return "Dossiê fora do padrão esperado";
  return null;
}

function isFlagOn(v: unknown): boolean {
  if (v === true) return true;
  const n = normalizeText(v);
  return n === "sim" || n === "s" || n === "true";
}

/**
 * Bloqueios que sempre rejeitam a linha na Carga Benner (mesmo em seleção
 * manual): situações impeditivas marcadas no registro ou campos obrigatórios
 * em aberto (pendências).
 */
function getMotivoBloqueioCarga(d: any): string | null {
  if (isFlagOn(d?.transito_julgado)) return "Trânsito em julgado";
  if (isFlagOn(d?.processo_outro_escritorio)) return "Processo em outro escritório";
  if (isFlagOn(d?.segredo_justica)) return "Segredo de justiça";
  // "Problema Judit" NÃO é motivo de rejeição na Carga Benner.
  if (isFlagOn(d?.cejusc)) return "CEJUSC";
  // Tipo de recurso preenchido com valor fora da lista de seleção oficial
  // (típico de preenchimento automático inventado pela Judit).
  const motivoRecurso = getMotivoRecursoForaLista(d);
  if (motivoRecurso) return motivoRecurso;
  if (isFlagOn(d?.acordo)) return "Acordo";
  // "Recurso de terceiro" NÃO é motivo de rejeição na Carga Benner.
  const pend = getPendencias(d);
  if (pend.length > 0) {
    const amostra = pend.slice(0, 3).map(p => p.label).join(", ");
    const resto = pend.length > 3 ? ` (+${pend.length - 3})` : "";
    return `Pendências: ${amostra}${resto}`;
  }
  return null;
}

function formatDateDDMMYYYY(val: unknown): string {
  if (val == null) return "";
  const s = String(val).trim();
  if (!s) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${String(Number(iso[3])).padStart(2, "0")}/${String(Number(iso[2])).padStart(2, "0")}/${iso[1]}`;
  return s;
}

function toSN(val: string): string {
  const n = normalizeText(val);
  if (n === "sim" || n === "s") return "S";
  if (n === "nao" || n === "não" || n === "n") return "N";
  return val;
}

// Normalizações de saída solicitadas pela advogada:
// 1) "Vice-Presiência" / variantes -> "Vice-Presidência"
// 2) "Análise do quarteirizado" só com a primeira letra maiúscula
// 3) "Tipo de Recurso" cada item só com a primeira letra maiúscula
// 4) "Relator" sem a palavra "Ministro/Ministra"
function fixVicePresidencia(s: string): string {
  return String(s ?? "")
    .replace(/Vice[\s\-]*Presi[eêEÊ]ncia/gi, "Vice-Presidência")
    .replace(/Vice[\s\-]*Presid[eê]ncia/gi, "Vice-Presidência");
}
function toSentenceCase(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
// Opções exatas exibidas na tela (Decisão - Análise do Quarteirizado).
// A planilha deve respeitar exatamente esse texto, incluindo "C. TST".
const OPCOES_QUARTEIRIZADO_SAIDA = [
  "Desistir - Falha Processual",
  "Desistir - Fatos e Provas",
  "Desistir - Jurisprudência consolidada",
  "Desistir - Mídia Negativa",
  "Desistir Súmula 266 C. TST",
  "Prosseguir",
];
function canonQuarteirizado(s: string): string | null {
  const norm = (v: string) =>
    normalizeText(v).replace(/[\s.]+/g, " ").replace(/\s*-\s*/g, " - ").trim();
  const n = norm(s);
  return OPCOES_QUARTEIRIZADO_SAIDA.find(opt => norm(opt) === n) || null;
}
// Para "Análise do quarteirizado": se houver '-', capitalizar a primeira
// letra de cada lado do hífen (mantendo o restante em minúsculas).
function toSentenceCaseDash(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const canon = canonQuarteirizado(t);
  if (canon) return canon;
  if (!t.includes("-")) return toSentenceCase(t);
  return t
    .split("-")
    .map(part => {
      const p = part.trim().toLowerCase();
      if (!p) return "";
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .filter(Boolean)
    .join(" - ");
}
const SMALL_WORDS_PT = new Set(["de","da","do","das","dos","e","du","del","la","los","las"]);
function toTitleCasePt(s: string): string {
  const t = String(s ?? "").trim().toLowerCase();
  if (!t) return "";
  return t.split(/\s+/).map((w, i) => {
    if (i > 0 && SMALL_WORDS_PT.has(w)) return w;
    // preserva hifenizadas: Vice-Presidência
    return w.split("-").map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join("-");
  }).join(" ");
}
function formatTipoRecurso(s: string): string {
  return String(s ?? "")
    .split(",")
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => toTitleCasePt(p))
    .join(", ");
}
function cleanRelator(s: string): string {
  const cleaned = String(s ?? "")
    .replace(/\b(Ministr[oa]s?)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return toTitleCasePt(cleaned);
}
function parseDateAny(s: any): number {
  const v = String(s ?? "").trim();
  if (!v) return Number.POSITIVE_INFINITY;
  const dm = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dm) {
    const y = +dm[3] < 100 ? 2000 + +dm[3] : +dm[3];
    return Date.UTC(y, +dm[2] - 1, +dm[1]);
  }
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const t = Date.parse(v);
  return isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function getTimestamp() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}_${String(n.getHours()).padStart(2,"0")}${String(n.getMinutes()).padStart(2,"0")}`;
}

function colToLetter(c: number): string {
  let s = "", n = c;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

function setWorksheetColumnWidth(sheetXml: string, colIndex1Based: number, width: number): string {
  const colXml = `<col min="${colIndex1Based}" max="${colIndex1Based}" width="${width}" customWidth="1"/>`;
  const existingExactCol = new RegExp(`<col min="${colIndex1Based}" max="${colIndex1Based}"[^>]*/>`);

  if (existingExactCol.test(sheetXml)) {
    return sheetXml.replace(existingExactCol, colXml);
  }

  if (sheetXml.includes("<cols>")) {
    return sheetXml.replace("</cols>", `${colXml}</cols>`);
  }

  if (sheetXml.includes("<sheetData>")) {
    return sheetXml.replace("<sheetData>", `<cols>${colXml}</cols><sheetData>`);
  }

  return sheetXml;
}

interface CargaFilters {
  aba_origem?: string;
  benner?: "todos" | "sim" | "nao";
  processo?: string;
  dossie?: string;
  turma?: string;
  relator?: string;
  parte?: string;
  parteRecorrente?: string;
  nomeParte?: string;
  mesAno?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface Props {
  onClose?: () => void;
  filters?: CargaFilters;
  selectedRecordIds?: string[];
  distribuicoes?: any[];
  idsAllowed?: string[];
}

export function CargaBennerFromDb({ onClose, filters = {}, selectedRecordIds, distribuicoes, idsAllowed }: Props) {
  const [processing, setProcessing] = useState(true);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [outputData, setOutputData] = useState<Record<string, any>[] | null>(null);
  const [rejectedData, setRejectedData] = useState<RejeicaoRow[]>([]);
  const [conferenciaData, setConferenciaData] = useState<Record<string, any>[] | null>(null);
  const criarRemessa = useCriarRemessa();
  const navigate = useNavigate();

  const isManualSelection = !!(selectedRecordIds && selectedRecordIds.length > 0);
  const hasPreFilteredData = !!(distribuicoes && distribuicoes.length > 0);
  const hasIdsAllowed = !!(idsAllowed && idsAllowed.length > 0);

  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    processData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processData = async () => {
    setProcessing(true);
    setProgress(0);
    setStats(null);
    setOutputData(null);
    setRejectedData([]);
    setConferenciaData(null);

    try {
      // Phase 0: lista oficial de pedidos (Santander). Somente matérias
      // presentes nessa lista podem ir para a planilha de Carga Benner.
      setPhase("Carregando lista oficial de pedidos...");
      setProgress(5);
      const materiasOficiaisSet = new Set<string>();
      {
        const PAGE_OFICIAL = 1000;
        let pg = 0;
        while (true) {
          const { data, error } = await supabase
            .from("materias_pedidos_oficiais" as any)
            .select("nome")
            .eq("ativo", true)
            .range(pg * PAGE_OFICIAL, (pg + 1) * PAGE_OFICIAL - 1);
          if (error) throw error;
          const rows = (data as any[]) || [];
          for (const r of rows) {
            const k = normalizeMateriaNome(r?.nome);
            if (k) materiasOficiaisSet.add(k);
          }
          if (rows.length < PAGE_OFICIAL) break;
          pg++;
        }
      }
      if (materiasOficiaisSet.size === 0) {
        throw new Error(
          "Lista oficial de pedidos (materias_pedidos_oficiais) está vazia — não é possível gerar a carga.",
        );
      }
      const isMateriaOficial = (nome: any) =>
        materiasOficiaisSet.has(normalizeMateriaNome(String(nome ?? "")));

      // Phase 1: Fetch distribuicoes_tst
      setPhase("Carregando distribuições do banco...");
      setProgress(10);


      const allDist: any[] = [];
      let page = 0;
      const pageSize = 1000;

      // Lê de dados_benner filtrando aba_origem (escopo distribuições TST).
      // O Layout Carga deve usar exclusivamente os campos da aba/tabela Dados Benner.
      const mapBennerToDist = (b: any) => ({
        ...b,
        processo_numero: b.processo,
      });

      if (hasPreFilteredData) {
        // Usa dados já filtrados pela tela (respeita 100% dos filtros aplicados)
        allDist.push(...distribuicoes!.map(mapBennerToDist));
      } else if (hasIdsAllowed) {
        // Carrega exatamente o conjunto de IDs filtrado pela tela, em lotes,
        // com feedback de progresso para evitar "Carregando..." sem retorno.
        const ids = idsAllowed!;
        const BATCH = 500;
        for (let i = 0; i < ids.length; i += BATCH) {
          const batch = ids.slice(i, i + BATCH);
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .select("*")
            .in("id", batch);
          if (error) throw error;
          if (data) allDist.push(...((data as any[]).map(mapBennerToDist)));
          const pct = 10 + Math.round(((i + batch.length) / ids.length) * 40);
          setProgress(Math.min(pct, 50));
          setPhase(`Carregando distribuições do banco... (${Math.min(i + batch.length, ids.length)}/${ids.length})`);
        }
      } else if (selectedRecordIds && selectedRecordIds.length > 0) {
        for (let i = 0; i < selectedRecordIds.length; i += 500) {
          const batch = selectedRecordIds.slice(i, i + 500);
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .select("*")
            .in("id", batch);
          if (error) throw error;
          if (data) allDist.push(...((data as any[]).map(mapBennerToDist)));
        }
      } else {
        while (true) {
          let query = supabase
            .from("dados_benner" as any)
            .select("*")
            .not("aba_origem", "is", null)
            .order("created_at", { ascending: false });

          if (filters.aba_origem && filters.aba_origem !== "todas") {
            query = query.eq("aba_origem", filters.aba_origem);
          }
          if (filters.benner === "sim") {
            query = query.eq("benner_atualizado", true);
          } else if (filters.benner === "nao") {
            query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
          }
          if (filters.processo) {
            query = query.ilike("processo", `%${filters.processo}%`);
          }
          if (filters.dossie) {
            query = query.ilike("dossie", `%${filters.dossie}%`);
          }
          if (filters.turma) {
            query = query.ilike("turma", `%${filters.turma}%`);
          }
          if (filters.relator) {
            query = query.ilike("relator", `%${filters.relator}%`);
          }
          if (filters.parte) {
            query = query.ilike("recorrente", `%${filters.parte}%`);
          }
          query = applyParteRecorrenteFilter(query, filters.parteRecorrente);
          if (filters.nomeParte) {
            const escaped = filters.nomeParte.replace(/[,()]/g, " ").trim();
            query = query.or(`reclamante.ilike.%${escaped}%,reclamada.ilike.%${escaped}%`);
          }
          if (filters.mesAno && filters.mesAno !== "todos") {
            const start = `${filters.mesAno}-01`;
            const [y, m] = filters.mesAno.split("-").map(Number);
            const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
            query = query.gte("data_distribuicao", start).lt("data_distribuicao", nextMonth);
          }
          if (filters.dataInicio) {
            query = query.gte("data_distribuicao", filters.dataInicio);
          }
          if (filters.dataFim) {
            query = query.lte("data_distribuicao", filters.dataFim);
          }

          const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allDist.push(...((data as any[]).map(mapBennerToDist)));
          if (data.length < pageSize) break;
          page++;
        }
      }

      if (allDist.length === 0) throw new Error("Nenhuma distribuição encontrada no banco");

      // Ordenação obrigatória: Data da Distribuição no TST/STF (menor para maior)
      allDist.sort((a, b) => parseDateAny(getDataDistribuicaoReal(a)) - parseDateAny(getDataDistribuicaoReal(b)));

      setProgress(50);
      setPhase("Gerando Layout Carga exclusivamente com Dados Benner...");

      // Phase 3: Process each distribuicao
      const output: Record<string, any>[] = [];
      const rejected: RejeicaoRow[] = [];
      const conferenciaOutput: Record<string, any>[] = [];
      let matched = 0;
      const warningsByType: Record<string, number> = {};
      let warningsTotal = 0;

      // Count by aba
      const abaCount = new Map<string, number>();

      for (let i = 0; i < allDist.length; i++) {
        const d = allDist[i];
        const rejStartIdx = rejected.length;
        const numProcesso = String(d.processo ?? d.processo_numero ?? "").trim();
        const dossie = String(d.dossie ?? "").trim();
        const aba = d.aba_origem || "Sem aba";
        abaCount.set(aba, (abaCount.get(aba) || 0) + 1);


        let turmaRaw = String(d.turma ?? "").trim();
        if (/^[-–—_\s]+$/.test(turmaRaw)) turmaRaw = "";

        // Validate
        let motivo = getMotivoRejeicaoDossie(dossie, numProcesso);
        if (!motivo && !turmaRaw) motivo = "Turma não preenchida";
        let isRejected = false;
        // Bloqueios impeditivos (situação do processo / pendências) rejeitam
        // sempre, inclusive em seleção manual.
        const motivoBloqueio = getMotivoBloqueioCarga(d);
        if (motivoBloqueio) {
          rejected.push({
            "Dossiê": dossie,
            "Número do Processo": numProcesso,
            "Data Distribuição": formatDateDDMMYYYY(getDataDistribuicaoReal(d)),
            "Turma": d.turma || "",
            "Relator": d.relator || "",
            "Motivo": motivoBloqueio,
          });
          isRejected = true;
        } else if (motivo) {
          // Em modo "seleção manual" o usuário escolheu cada linha conscientemente:
          // não descartamos a linha; apenas registramos um aviso e seguimos preenchendo
          // todos os campos (Tribunal, Tipo de Recurso, Data, Turma, Relator, etc.).
          // Em modo "filtros em massa" mantemos o comportamento de rejeição original.
          if (isManualSelection) {
            warningsByType[motivo] = (warningsByType[motivo] || 0) + 1;
            warningsTotal++;
            // Continua o fluxo abaixo (não há "continue").
          } else {
            rejected.push({
              "Dossiê": dossie,
              "Número do Processo": numProcesso,
              "Data Distribuição": formatDateDDMMYYYY(getDataDistribuicaoReal(d)),
              "Turma": d.turma || "",
              "Relator": d.relator || "",
              "Motivo": motivo,
            });
            isRejected = true;
            // Não usar "continue": precisamos construir a linha para a
            // Planilha de Conferência mesmo quando a linha é rejeitada
            // (dossiê vazio, turma ausente etc.).
          }
        }

        const hasJulg = !!String(d.data_julgamento ?? "").trim();
        if (hasJulg) matched++;

        const outRow: Record<string, any> = {};
        outRow[LAYOUT_COLS[0]] = dossie;
        outRow[LAYOUT_COLS[1]] = String(d.tribunal ?? "").trim() || "TST";
        outRow[LAYOUT_COLS[2]] = formatTipoRecurso([
          ...splitRecursoValues((d as any).tipo_recurso_reclamante),
          ...splitRecursoValues((d as any).tipo_recurso_banco),
        ].join(", "));
        outRow[LAYOUT_COLS[3]] = formatDateDDMMYYYY(getDataDistribuicaoReal(d));
        outRow[LAYOUT_COLS[4]] = fixVicePresidencia(turmaRaw);
        outRow[LAYOUT_COLS[5]] = cleanRelator(String(d.relator ?? "").trim());
        outRow[LAYOUT_COLS[6]] = toSentenceCaseDash(String(d.decisao_quarteirizado ?? "").trim());
        // Campos unificados: a aba Distribuição TST (Análise) é a fonte
        // autoritativa. `risco_midia`/`materia_honra` são apenas fallback
        // para registros legados (campo removido da aba Confere Benner).
        const midiaSN = (d.midia_negativa || d.risco_midia)
          ? toSN(String(d.midia_negativa || d.risco_midia)) : "";
        outRow[LAYOUT_COLS[7]] = midiaSN;
        // Se não há risco de mídia negativa (N), a coluna "Risco" fica vazia.
        outRow[LAYOUT_COLS[8]] = midiaSN === "N" ? "" : String(d.risco_descricao ?? "").trim();
        outRow[LAYOUT_COLS[9]] = d.provas_digitais ? toSN(String(d.provas_digitais)) : "";
        outRow[LAYOUT_COLS[10]] = d.tem_data_julgamento ? toSN(String(d.tem_data_julgamento)) : "";
        outRow[LAYOUT_COLS[11]] = formatDateDDMMYYYY(d.data_julgamento);
        outRow[LAYOUT_COLS[12]] = String(d.horario_julgamento ?? "").trim();
        outRow[LAYOUT_COLS[13]] = String(d.tipo_julgamento ?? "").trim();
        outRow[LAYOUT_COLS[14]] = (d.honra || d.materia_honra)
          ? toSN(String(d.honra || d.materia_honra)) : "";
        outRow[LAYOUT_COLS[15]] = d.entrega_memoriais ? toSN(String(d.entrega_memoriais)) : "";
        outRow[LAYOUT_COLS[16]] = d.sustentacao_oral ? toSN(String(d.sustentacao_oral)) : "";
        outRow[LAYOUT_COLS[17]] = d.resultado_sem_transcendencia ? "X" : "";
        outRow[LAYOUT_COLS[18]] = d.resultado_nao_conhecido ? "X" : "";
        outRow[LAYOUT_COLS[19]] = d.resultado_conhecido_provido ? "X" : "";
        outRow[LAYOUT_COLS[20]] = d.resultado_conhecido_nao_provido ? "X" : "";
        outRow[LAYOUT_COLS[21]] = String(d.resultado_outra ?? "").trim();
        outRow[LAYOUT_COLS[22]] = String(d.observacoes ?? "").trim();
        outRow[LAYOUT_COLS[23]] = d.ganhamos ? "X" : "";
        outRow[LAYOUT_COLS[24]] = d.perdemos ? "X" : "";
        outRow[LAYOUT_COLS[25]] = d.processo_baixado ? toSN(String(d.processo_baixado)) : "";
        outRow[LAYOUT_COLS[26]] = normalizeRecorrenteBenner(
          deriveRecorrenteFromRecursos(
            (d as any).tipo_recurso_reclamante,
            (d as any).tipo_recurso_banco
          ) || (d as any).parte_recorrente || (d as any).recorrente
        );
        outRow["__numProcesso"] = numProcesso;
        outRow["__dadoBennerId"] = d.id || null;

        // Colunas AB..AH: listas de matérias filtradas pelo critério da coluna.
        // Quando `parte_recorrente` tem mais de uma parte (ex.: "Reclamante e Reclamada",
        // "Reclamante e Terceiro", "Reclamante, Reclamada e Terceiro"), duplicamos a
        // linha por parte e cada linha mostra apenas as matérias daquela parte.
        const normMat = (s: any) =>
          String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const joinUniqueMat = (items: any[]) => {
          const seen = new Set<string>();
          const out: string[] = [];
          for (const it of items) {
            const k = normMat(it.materia);
            if (!k || seen.has(k)) continue;
            seen.add(k);
            out.push(String(it.materia).trim());
          }
          return out.join(",");
        };
        // "Outra Matéria" nunca vai para a planilha de carga. Além disso, só
        // podem ser exportadas matérias que constem na lista oficial de pedidos
        // do Santander (`materias_pedidos_oficiais`).
        let materiasSelecionadasCount = 0;
        let materiasForaListaCount = 0;
        const filtrarMateriasExportaveis = (arr: any[]) => {
          const itens = (Array.isArray(arr) ? arr : []).filter(
            (it: any) => it && it.materia && String(it.materia).trim(),
          );
          materiasSelecionadasCount += itens.length;
          const validas: any[] = [];
          for (const it of itens) {
            if (isOutraMateria(it.materia)) {
              materiasForaListaCount++;
              continue;
            }
            if (!isMateriaOficial(it.materia)) {
              materiasForaListaCount++;
              continue;
            }
            validas.push(it);
          }
          return validas;
        };
        const materiasPorParte: Record<string, any[]> = {
          reclamante: filtrarMateriasExportaveis((d as any).materias_analise_reclamante),
          banco: filtrarMateriasExportaveis((d as any).materias_analise_banco),
          terceiro: filtrarMateriasExportaveis((d as any).materias_analise_terceiro),
        };
        const materiasValidasCount =
          materiasPorParte.reclamante.length +
          materiasPorParte.banco.length +
          materiasPorParte.terceiro.length;
        const MOTIVO_MATERIAS_FORA_LISTA =
          "Matérias fora da lista oficial de pedidos";
        if (
          materiasSelecionadasCount > 0 &&
          materiasValidasCount === 0 &&
          !isRejected
        ) {
          rejected.push({
            "Dossiê": dossie,
            "Número do Processo": numProcesso,
            "Data Distribuição": formatDateDDMMYYYY(getDataDistribuicaoReal(d)),
            "Turma": d.turma || "",
            "Relator": d.relator || "",
            "Motivo": MOTIVO_MATERIAS_FORA_LISTA,
          });
          isRejected = true;
        } else if (materiasForaListaCount > 0) {
          const label = "Matérias descartadas fora da lista oficial";
          warningsByType[label] = (warningsByType[label] || 0) + 1;
          warningsTotal++;
        }
        // Detecta as partes recorrentes.
        // Regra: o campo `parte_recorrente` da aba Distribuição TST é a fonte
        // autoritativa. Quando ele está preenchido, respeitamos ESTRITAMENTE
        // o que a advogada informou (mesmo que existam `tipo_recurso_*` de
        // outras partes preenchidos por engano/legado). Só usamos os campos
        // `tipo_recurso_*` como fallback quando `parte_recorrente` está vazio.
        const parteRecorrenteNorm = normalizeText((d as any).parte_recorrente);
        const partesSet = new Set<"reclamante" | "banco" | "terceiro">();
        if (parteRecorrenteNorm) {
          if (/reclamante/.test(parteRecorrenteNorm)) partesSet.add("reclamante");
          if (/reclamad[ao]/.test(parteRecorrenteNorm)) partesSet.add("banco");
          if (/terceiro/.test(parteRecorrenteNorm)) partesSet.add("terceiro");
        } else {
          if (splitRecursoValues((d as any).tipo_recurso_reclamante).length > 0) partesSet.add("reclamante");
          if (splitRecursoValues((d as any).tipo_recurso_banco).length > 0) partesSet.add("banco");
          if (splitRecursoValues((d as any).tipo_recurso_terceiro).length > 0) partesSet.add("terceiro");
        }
        // Mantém ordem estável: reclamante → banco → terceiro
        const partes: Array<"reclamante" | "banco" | "terceiro"> = (
          ["reclamante", "banco", "terceiro"] as const
        ).filter((p) => partesSet.has(p));

        const preencherMateriasCols = (row: Record<string, any>, materias: any[]) => {
          row[LAYOUT_COLS[27]] = joinUniqueMat(materias.filter((i: any) => normMat(i.chance_turma).startsWith("FAVOR")));
          row[LAYOUT_COLS[28]] = joinUniqueMat(materias.filter((i: any) => normMat(i.chance_turma).startsWith("DESF")));
          row[LAYOUT_COLS[29]] = joinUniqueMat(materias.filter((i: any) => normMat(i.chance_relator).startsWith("FAVOR")));
          row[LAYOUT_COLS[30]] = joinUniqueMat(materias.filter((i: any) => normMat(i.chance_relator).startsWith("DESF")));
          row[LAYOUT_COLS[31]] = joinUniqueMat(materias.filter((i: any) => normMat(i.aparelhamento).startsWith("BEM")));
          row[LAYOUT_COLS[32]] = joinUniqueMat(materias.filter((i: any) => normMat(i.aparelhamento).startsWith("MAL")));
          row[LAYOUT_COLS[33]] = joinUniqueMat(materias.filter((i: any) => normMat(i.chance_exito) === "SIM"));
          // Nova coluna final: matérias marcadas com Êxito = NÃO
          row[LAYOUT_COLS[COL_SEM_EXITO]] = joinUniqueMat(
            materias.filter((i: any) => normMat(i.chance_exito) === "NAO"),
          );
        };


        // Mapeia a chave interna da parte para o rótulo exibido em "Recorrente"
        // (coluna AA) e para o campo `tipo_recurso_*` correspondente.
        const labelParte: Record<string, string> = {
          reclamante: "Reclamante",
          banco: "Reclamada",
          // Regra da planilha Carga Benner: a coluna "Recorrente" nunca exibe
          // "Terceiro" — sempre "Outra".
          terceiro: "Outra",
        };
        const tipoRecursoDaParte = (p: "reclamante" | "banco" | "terceiro"): string => {
          const raw = p === "reclamante"
            ? (d as any).tipo_recurso_reclamante
            : p === "banco"
              ? (d as any).tipo_recurso_banco
              : (d as any).tipo_recurso_terceiro;
          return formatTipoRecurso(splitRecursoValues(raw).join(", "));
        };

        const emitirLinha = (
          materiasDaLinha: any[],
          parte?: "reclamante" | "banco" | "terceiro",
        ) => {
          const rowClone: Record<string, any> = { ...outRow };
          if (parte) {
            // Sobrescreve o Recorrente (AA) e o Tipo de Recurso (C) para
            // refletir apenas a parte desta linha, garantindo que as
            // matérias das colunas AB..AH batam com o Recorrente exibido.
            rowClone[LAYOUT_COLS[26]] = normalizeRecorrenteBenner(labelParte[parte]);
            rowClone[LAYOUT_COLS[2]] = tipoRecursoDaParte(parte);
          }
          preencherMateriasCols(rowClone, materiasDaLinha);
          for (const key of Object.keys(rowClone)) {
            if (!key.startsWith("__") && typeof rowClone[key] === "string" && /^[-–—\s]+$/.test(rowClone[key])) {
              rowClone[key] = "";
            }
          }
          // Conferência inclui todas as linhas (inclusive dossiê vazio /
          // turma ausente). Layout Carga oficial só recebe não-rejeitadas.
          conferenciaOutput.push(rowClone);
          if (!isRejected) output.push(rowClone);
        };

        if (partes.length >= 2) {
          for (const p of partes) emitirLinha(materiasPorParte[p], p);
        } else if (partes.length === 1) {
          emitirLinha(materiasPorParte[partes[0]], partes[0]);
        } else {
          // Sem parte_recorrente preenchida: mantém comportamento anterior (combinado).
          emitirLinha([
            ...materiasPorParte.reclamante,
            ...materiasPorParte.banco,
            ...materiasPorParte.terceiro,
          ]);
        }

        // Coluna final "Sem chance de êxito" também na planilha de Rejeições.
        if (rejected.length > rejStartIdx) {
          const semExitoRej = joinUniqueMat(
            [
              ...materiasPorParte.reclamante,
              ...materiasPorParte.banco,
              ...materiasPorParte.terceiro,
            ].filter((it: any) => normMat(it.chance_exito) === "NAO"),
          );
          for (let r = rejStartIdx; r < rejected.length; r++) {
            rejected[r]["Sem chance de êxito"] = semExitoRej;
          }
        }



        if (i % 500 === 0) {
          setProgress(50 + Math.floor((i / allDist.length) * 40));
          await new Promise(r => setTimeout(r, 0));
        }
      }

      // Filter trânsito em julgado
      const transitoFiltered = output.filter(row => {
        const colG = normalizeText(row[LAYOUT_COLS[6]]);
        return colG.includes("transito em julgado") || colG.includes("trânsito em julgado") || colG === "transito julgado";
      });
      const outputFinal = output.filter(row => {
        const colG = normalizeText(row[LAYOUT_COLS[6]]);
        return !(colG.includes("transito em julgado") || colG.includes("trânsito em julgado") || colG === "transito julgado");
      });

      // Rejection stats
      const rejByType: Record<string, number> = {};
      for (const r of rejected) {
        rejByType[r["Motivo"]] = (rejByType[r["Motivo"]] || 0) + 1;
      }

      const sheetsBreakdown = [...abaCount.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setOutputData(outputFinal);
      setRejectedData(rejected);
      setConferenciaData(conferenciaOutput);
      setStats({
        totalDistribuicoes: allDist.length,
        matched,
        unmatched: outputFinal.length - matched,
        rejected: rejected.length,
        transitoJulgado: transitoFiltered.length,
        outputRows: outputFinal.length,
        sheetsBreakdown,
        rejectionsByType: rejByType,
        warnings: warningsTotal,
        warningsByType,
      });

      setPhase("Concluído!");
      setProgress(100);
      const warningSuffix = warningsTotal > 0
        ? `, ${warningsTotal} aviso(s)`
        : "";
      toast.success(`Layout gerado com ${outputFinal.length} linha(s), ${transitoFiltered.length} trânsito em julgado e ${rejected.length} rejeição(ões)${warningSuffix}.`);
      const rejRecursoForaLista = rejected.filter(r => String(r["Motivo"] ?? "").startsWith(MOTIVO_RECURSO_FORA_LISTA)).length;
      if (rejRecursoForaLista > 0) {
        toast.error(
          `${rejRecursoForaLista} processo(s) rejeitado(s): tipo de recurso fora da lista oficial de seleção (preenchimento inválido/automático). Corrija na Distribuição TST — detalhes no arquivo de rejeições.`,
          { duration: 12000 },
        );
      }
      const rejForaLista = rejByType["Matérias fora da lista oficial de pedidos"] || 0;
      if (rejForaLista > 0) {
        toast.warning(
          `${rejForaLista} processo(s) rejeitado(s): todas as matérias estão fora da lista oficial de pedidos. Corrija as matérias na Distribuição TST.`,
          { duration: 10000 },
        );
      }
      const avisoParcial = warningsByType["Matérias descartadas fora da lista oficial"] || 0;
      if (avisoParcial > 0) {
        toast.info(
          `${avisoParcial} processo(s) exportado(s) com matérias descartadas por não constarem na lista oficial de pedidos.`,
          { duration: 8000 },
        );
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
      console.error("[CargaBennerFromDb] Error:", err);
    } finally {
      setProcessing(false);
    }
  };

  const buildXlsxBlob = async (fullMode: "full" | "aq" | "ag"): Promise<{ blob: Blob; filename: string } | null> => {
    if (!outputData) return null;
    try {
      const resp = await fetch("/templates/layout_carga_tst_template.xlsx");
      if (!resp.ok) throw new Error("Template não encontrado");
      const templateBuf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(templateBuf);

      const sstXml = await zip.file("xl/sharedStrings.xml")!.async("string");
      const existingStrings: string[] = [];
      const siRegex = /<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g;
      let m: RegExpExecArray | null;
      while ((m = siRegex.exec(sstXml)) !== null) existingStrings.push(unescXml(m[1]));
      const stringMap = new Map<string, number>();
      existingStrings.forEach((s, i) => stringMap.set(s, i));
      const newStrings = [...existingStrings];
      function getStringIndex(val: string): number {
        const clean = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
        if (stringMap.has(clean)) return stringMap.get(clean)!;
        const idx = newStrings.length;
        newStrings.push(clean);
        stringMap.set(clean, idx);
        return idx;
      }

      // Colunas exportadas: base do modo + a coluna final "Sem chance de êxito",
      // que deve constar em TODAS as planilhas geradas.
      const baseCols = fullMode === "full" ? LAYOUT_COLS.length - 1 : fullMode === "ag" ? 7 : 17;
      const colIdxs = [...Array(baseCols).keys(), COL_SEM_EXITO];
      const maxCol = colIdxs.length;

      let stylesXml = await zip.file("xl/styles.xml")!.async("string");
      const cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">/);
      let centeredStyleId = 0;
      if (cellXfsMatch) {
        const cnt = parseInt(cellXfsMatch[1]);
        stylesXml = stylesXml.replace(/<\/cellXfs>/, `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>`);
        stylesXml = stylesXml.replace(`<cellXfs count="${cnt}">`, `<cellXfs count="${cnt + 1}">`);
        centeredStyleId = cnt;
        zip.file("xl/styles.xml", stylesXml);
      }

      let dataRowsXml = "";
      for (let i = 0; i < outputData.length; i++) {
        const row = outputData[i];
        const rowNum = i + 3;
        let cellsXml = "";
        for (let p = 0; p < colIdxs.length; p++) {
          const c = colIdxs[p];
          const raw = String(row[LAYOUT_COLS[c]] ?? "");
          // Rede de segurança: coluna AA (Recorrente) nunca leva "Terceiro".
          const val = c === 26 ? normalizeRecorrenteBenner(raw) : raw;
          if (!val) continue;
          const ref = colToLetter(p) + rowNum;
          const idx = getStringIndex(val);
          cellsXml += centeredStyleId > 0
            ? `<c r="${ref}" t="s" s="${centeredStyleId}"><v>${idx}</v></c>`
            : `<c r="${ref}" t="s"><v>${idx}</v></c>`;
        }
        dataRowsXml += `<row r="${rowNum}" spans="1:${maxCol}">${cellsXml}</row>`;
      }

      let sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
      const lastRow = outputData.length + 2;
      sheetXml = sheetXml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${colToLetter(maxCol - 1)}${lastRow}"/>`);
      if (fullMode === "full") {
        sheetXml = setWorksheetColumnWidth(sheetXml, 27, 60);
      }
      const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
      if (sheetDataMatch) {
        const allContent = sheetDataMatch[1];
        const row1 = allContent.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? "";
        let row2 = allContent.match(/<row r="2"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? "";
        row2 = setHeaderCell(
          row2,
          2,
          maxCol - 1,
          getStringIndex(LAYOUT_COLS[COL_SEM_EXITO]),
          centeredStyleId,
          maxCol,
        );
        const ajuste = ajustarGrupoChanceExito({
          row1,
          row2,
          sheetXml,
          colIdx: maxCol - 1,
          strIdxTituloGrupo: getStringIndex("Chance de êxito"),
        });
        sheetXml = addMergeCell(sheetXml, ajuste.mergeRef);
        sheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${ajuste.row1}${ajuste.row2}${dataRowsXml}</sheetData>`);

      }

      zip.file("xl/worksheets/sheet1.xml", sheetXml);

      zip.file("xl/sharedStrings.xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${newStrings.length}" uniqueCount="${newStrings.length}">${newStrings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join("")}</sst>`
      );

      const suffix = fullMode === "full" ? "" : fullMode === "ag" ? "_ate_analise" : "_ate_recurso";
      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      return { blob, filename: `Layout_Carga_TST_Supabase${suffix}_${getTimestamp()}.xlsx` };
    } catch (err: any) {
      toast.error("Erro ao gerar planilha: " + (err?.message || String(err)));
      return null;
    }
  };

  const downloadXlsx = async (fullMode: "full" | "aq" | "ag") => {
    const res = await buildXlsxBlob(fullMode);
    if (!res) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(res.blob);
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Planilha baixada!");
  };

  const salvarComoRemessa = async () => {
    if (!outputData || outputData.length === 0) return;
    const res = await buildXlsxBlob("full");
    if (!res) return;
    try {
      const itens = outputData.map((row: any) => ({
        dossie: String(row[LAYOUT_COLS[0]] ?? ""),
        processo: String(row["__numProcesso"] ?? ""),
        turma: String(row[LAYOUT_COLS[4]] ?? ""),
        relator: String(row[LAYOUT_COLS[5]] ?? ""),
        tribunal: String(row[LAYOUT_COLS[1]] ?? ""),
        dado_benner_id: row["__dadoBennerId"] || null,
      }));
      const remessa = await criarRemessa.mutateAsync({
        arquivo: res.blob,
        arquivoNome: res.filename,
        filtros: { ...filters, selectedRecordIdsCount: selectedRecordIds?.length ?? null, idsAllowedCount: idsAllowed?.length ?? null },
        itens,
      });
      toast.success(`Remessa ${remessa.numero_sequencial} criada com ${itens.length} item(ns)!`);
      if (onClose) onClose();
      navigate("/remessas-benner");
    } catch (err: any) {
      toast.error("Erro ao salvar remessa: " + (err?.message || String(err)));
    }
  };

  const downloadRejectedXlsx = () => {
    if (rejectedData.length === 0) return;
    const wb = XLSX.utils.book_new();
    const rows = rejectedData.map((r) => ({
      ...r,
      "Sem chance de êxito": r["Sem chance de êxito"] ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 36 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Rejeições");
    XLSX.writeFile(wb, `Rejeicoes_Carga_Supabase_${getTimestamp()}.xlsx`);
    toast.success("Rejeições baixadas!");
  };


  const downloadConferenciaXlsx = async () => {
    const data = conferenciaData ?? outputData;
    if (!data || data.length === 0) {
      toast.error("Nenhum dado para gerar a conferência.");
      return;
    }
    try {
      const resp = await fetch("/templates/layout_carga_tst_template.xlsx");
      if (!resp.ok) throw new Error("Template não encontrado");
      const templateBuf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(templateBuf);

      const sstXml = await zip.file("xl/sharedStrings.xml")!.async("string");
      const existingStrings: string[] = [];
      const siRegex = /<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g;
      let m: RegExpExecArray | null;
      while ((m = siRegex.exec(sstXml)) !== null) existingStrings.push(unescXml(m[1]));
      const stringMap = new Map<string, number>();
      existingStrings.forEach((s, i) => stringMap.set(s, i));
      const newStrings = [...existingStrings];
      function getStrIdx(val: string): number {
        const clean = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
        if (stringMap.has(clean)) return stringMap.get(clean)!;
        const idx = newStrings.length;
        newStrings.push(clean);
        stringMap.set(clean, idx);
        return idx;
      }

      const totalCols = LAYOUT_COLS.length + 1;

      let stylesXml = await zip.file("xl/styles.xml")!.async("string");
      const cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">/);
      let centeredStyleId = 0;
      if (cellXfsMatch) {
        const cnt = parseInt(cellXfsMatch[1]);
        stylesXml = stylesXml.replace(/<\/cellXfs>/, `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>`);
        stylesXml = stylesXml.replace(`<cellXfs count="${cnt}">`, `<cellXfs count="${cnt + 1}">`);
        centeredStyleId = cnt;
        zip.file("xl/styles.xml", stylesXml);
      }

      let sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
      const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
      let headerRows = "";
      let mergeChanceExito: string | null = null;
      if (sheetDataMatch) {
        const allContent = sheetDataMatch[1];
        const row1Match = allContent.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/);
        const row2Match = allContent.match(/<row r="2"[^>]*>[\s\S]*?<\/row>/);

        function colLetterToIndex(letters: string): number {
          let idx = 0;
          for (let i = 0; i < letters.length; i++) idx = idx * 26 + (letters.charCodeAt(i) - 64);
          return idx - 1;
        }

        function shiftRow(rowXml: string, rowNum: number, insertCell?: string): string {
          const cells: Array<{col: number; xml: string}> = [];
          const cellRegex = /<c\b(?=[^>]*\br="[A-Z]+\d+")[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
          let cm: RegExpExecArray | null;
          while ((cm = cellRegex.exec(rowXml)) !== null) {
            const colLetter = cm[0].match(/\br="([A-Z]+)\d+"/)?.[1];
            if (!colLetter) continue;
            const colIdx = colLetterToIndex(colLetter);
            const newColIdx = colIdx >= 1 ? colIdx + 1 : colIdx;
            const newRef = colToLetter(newColIdx) + rowNum;
            cells.push({ col: newColIdx, xml: cm[0].replace(/ r="[A-Z]+\d+"/, ` r="${newRef}"`) });
          }
          if (insertCell) cells.push({ col: 1, xml: insertCell });
          cells.sort((a, b) => a.col - b.col);
          const rowTag = (rowXml.match(/<row [^>]*>/)?.[0] || `<row r="${rowNum}">`)
            .replace(/spans="[^"]*"/, `spans="1:${totalCols}"`);
          return rowTag + cells.map(c => c.xml).join("") + "</row>";
        }

        let h1 = row1Match?.[0] ?? "";
        let h2 = row2Match?.[0] ?? "";
        h1 = shiftRow(h1, 1);
        const npIdx = getStrIdx("Processo");
        h2 = shiftRow(h2, 2, `<c r="B2" t="s"${centeredStyleId > 0 ? ` s="${centeredStyleId}"` : ""}><v>${npIdx}</v></c>`);
        h2 = setHeaderCell(
          h2,
          2,
          totalCols - 1,
          getStrIdx(LAYOUT_COLS[COL_SEM_EXITO]),
          centeredStyleId,
          totalCols,
        );
        const ajuste = ajustarGrupoChanceExito({
          row1: h1,
          row2: h2,
          sheetXml,
          colIdx: totalCols - 1,
          strIdxTituloGrupo: getStrIdx("Chance de êxito"),
        });
        mergeChanceExito = ajuste.mergeRef;
        headerRows = ajuste.row1 + ajuste.row2;

      }


      let dataRowsXml = "";
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 3;
        let cellsXml = "";
        const dossieVal = String(row[LAYOUT_COLS[0]] ?? "");
        if (dossieVal) cellsXml += `<c r="A${rowNum}" t="s"${centeredStyleId > 0 ? ` s="${centeredStyleId}"` : ""}><v>${getStrIdx(dossieVal)}</v></c>`;
        const procVal = String(row["__numProcesso"] ?? "");
        if (procVal) cellsXml += `<c r="B${rowNum}" t="s"${centeredStyleId > 0 ? ` s="${centeredStyleId}"` : ""}><v>${getStrIdx(procVal)}</v></c>`;
        for (let c = 1; c < LAYOUT_COLS.length; c++) {
          const val = String(row[LAYOUT_COLS[c]] ?? "");
          if (!val) continue;
          const ref = colToLetter(c + 1) + rowNum;
          cellsXml += centeredStyleId > 0
            ? `<c r="${ref}" t="s" s="${centeredStyleId}"><v>${getStrIdx(val)}</v></c>`
            : `<c r="${ref}" t="s"><v>${getStrIdx(val)}</v></c>`;
        }
        dataRowsXml += `<row r="${rowNum}" spans="1:${totalCols}">${cellsXml}</row>`;
      }

      const lastRow = data.length + 2;
      sheetXml = sheetXml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${colToLetter(totalCols - 1)}${lastRow}"/>`);
      sheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${headerRows}${dataRowsXml}</sheetData>`);
      sheetXml = setWorksheetColumnWidth(sheetXml, 28, 60);

      // Shift mergeCells ranges to account for the inserted "Processo" column at B.
      // Cells originally at col >= B (index >= 1) are shifted +1, and A1 stays at A1.
      // A merge starting at A and extending across the shifted region must expand by 1
      // on the right side so it still covers the original cells in their new positions.
      function shiftColLetter(letters: string): string {
        let idx = 0;
        for (let i = 0; i < letters.length; i++) idx = idx * 26 + (letters.charCodeAt(i) - 64);
        idx -= 1;
        const shifted = idx >= 1 ? idx + 1 : idx;
        return colToLetter(shifted);
      }
      sheetXml = sheetXml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g,
        (_m, c1, r1, c2, r2) => {
          const newC1 = shiftColLetter(c1);
          // If the original left col was A and right col was >= B, extend right by 1
          // so the merge still covers the shifted cells. Otherwise shift right normally.
          let newC2: string;
          if (c1 === "A" && c2 !== "A") {
            // expand: right col gets shifted +1 as well (since orig col >= B)
            newC2 = shiftColLetter(c2);
          } else {
            newC2 = shiftColLetter(c2);
          }
          return `<mergeCell ref="${newC1}${r1}:${newC2}${r2}"/>`;
        }
      );

      // Mescla o título "Chance de êxito" sobre as duas últimas colunas.
      sheetXml = addMergeCell(sheetXml, mergeChanceExito);



      zip.file("xl/worksheets/sheet1.xml", sheetXml);

      zip.file("xl/sharedStrings.xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${newStrings.length}" uniqueCount="${newStrings.length}">${newStrings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join("")}</sst>`
      );

      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Conferencia_Carga_Supabase_${getTimestamp()}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Planilha de conferência baixada!");
    } catch (err: any) {
      toast.error("Erro ao gerar conferência: " + (err?.message || String(err)));
    }
  };

  return (
    <div className="space-y-4">

      {/* Progress */}
      {processing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{phase}</span>
                <span className="font-mono text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.totalDistribuicoes.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Distribuições</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-500">{stats.matched.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Com Julgamento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-500">{stats.unmatched.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Sem Julgamento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-orange-500">{stats.transitoJulgado.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Trânsito em Julgado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-destructive">{stats.rejected.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Rejeições</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats.outputRows.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Linhas no Layout</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-aba breakdown */}
          {stats.sheetsBreakdown.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-foreground mb-2">Linhas por aba (Distribuições)</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {stats.sheetsBreakdown.map(s => (
                    <div key={s.name} className="flex justify-between text-sm border rounded-md px-3 py-1.5">
                      <span className="text-muted-foreground">{s.name}</span>
                      <span className="font-mono font-medium text-foreground">{s.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejection breakdown */}
          {Object.keys(stats.rejectionsByType).length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-foreground mb-3">Rejeições por tipo de erro</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(stats.rejectionsByType).sort((a, b) => b[1] - a[1]).map(([motivo, count]) => (
                    <div key={motivo} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="text-xs text-muted-foreground truncate mr-2">{motivo}</span>
                      <span className="text-sm font-bold text-destructive">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avisos (linhas incluídas mesmo com pendência, em modo seleção manual) */}
          {stats.warnings && stats.warnings > 0 && stats.warningsByType ? (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Avisos (linhas incluídas em modo seleção manual)
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Estas linhas foram exportadas com todos os campos da tela, mesmo com dossiê/turma faltando ou inválido.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(stats.warningsByType).sort((a, b) => b[1] - a[1]).map(([motivo, count]) => (
                    <div key={motivo} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="text-xs text-muted-foreground truncate mr-2">{motivo}</span>
                      <span className="text-sm font-bold text-amber-500">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Download buttons */}
      {outputData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div>
                  <p className="font-semibold text-foreground">Layout Carga pronto!</p>
                  <p className="text-sm text-muted-foreground">
                    {outputData.length} linhas geradas{rejectedData.length > 0 ? ` • ${rejectedData.length} rejeições separadas` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={salvarComoRemessa} disabled={criarRemessa.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  {criarRemessa.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Salvar como Remessa
                </Button>
                {rejectedData.length > 0 && (
                  <Button variant="outline" onClick={downloadRejectedXlsx}>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Baixar Rejeições
                  </Button>
                )}
                <Button onClick={() => downloadXlsx("full")}>
                  <Download className="w-4 h-4 mr-2" />
                  Completa (A-AH)
                </Button>
                <Button variant="outline" onClick={() => downloadXlsx("aq")}>
                  <Download className="w-4 h-4 mr-2" />
                  Até Recurso (A-Q)
                </Button>
                <Button variant="outline" onClick={() => downloadXlsx("ag")}>
                  <Download className="w-4 h-4 mr-2" />
                  Até Análise quarteirizado (A-G)
                </Button>
                <Button variant="secondary" onClick={downloadConferenciaXlsx}>
                  <Download className="w-4 h-4 mr-2" />
                  Planilha de Conferência
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset */}
      {stats && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => { setStats(null); setOutputData(null); setRejectedData([]); }}>
            Gerar novamente
          </Button>
        </div>
      )}
    </div>
  );
}
