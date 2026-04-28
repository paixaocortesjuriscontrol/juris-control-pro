import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight,
} from "lucide-react";

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
];

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

function normalizeCNJ(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 15 ? digits.padStart(20, "0") : digits;
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

function deriveFavoravel(val: string | null): string {
  if (!val) return "";
  const n = normalizeText(val);
  if (n.includes("positiv")) return "Favorável";
  if (n.includes("negativ")) return "Desfavorável";
  return "";
}

function deriveAparelhamento(val: string | null): string {
  if (!val) return "";
  const n = normalizeText(val);
  if (n.includes("bem") || n.includes("sim")) return "Bem aparelhado";
  if (n.includes("mal") || n.includes("nao") || n.includes("não")) return "Mal aparelhado";
  return val;
}

const SIGLA_TO_FULL: Record<string, string> = {
  "RR": "Recurso de Revista", "AIRR": "Agravo de Instrumento", "RRAG": "Recurso de Revista",
  "ROT": "Recurso Ordinário", "RCL": "Reclamação", "AG": "Agravo", "AR": "Agravo Regimental",
  "EMB": "Embargos de Declaração", "AGRAVO INTERNO": "Agravo Interno", "EMB-AG-RRAG": "Embargos SDI",
  "AIAP": "Agravo de Instrumento", "AIR": "Agravo de Instrumento",
};

function expandSigla(val: string): string {
  if (!val.trim()) return "";
  if (/^n[aã]o\s+tem$/i.test(val.trim())) return "";
  if (/^[_\s]+$/.test(val)) return "";
  const upper = val.trim().toUpperCase().replace(/[-–]/g, "-");
  if (SIGLA_TO_FULL[upper]) return SIGLA_TO_FULL[upper];
  if (upper.includes("-")) {
    const parts = upper.split("-").map(p => SIGLA_TO_FULL[p] || p.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
    return [...new Set(parts.filter(Boolean))].join(" - ");
  }
  return val.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const MINISTRO_TURMA: Record<string, string> = {
  "scheuermann": "1ª Turma", "dezena": "1ª Turma", "amaury": "1ª Turma",
  "delaide": "2ª Turma", "delaíde": "2ª Turma", "liana chaib": "2ª Turma", "silvestrin": "2ª Turma",
  "lelio": "3ª Turma", "lélio": "3ª Turma", "godinho delgado": "3ª Turma", "balazeiro": "3ª Turma",
  "ives gandra": "4ª Turma", "peduzzi": "4ª Turma", "alexandre luiz ramos": "4ª Turma",
  "douglas alencar": "5ª Turma", "breno medeiros": "5ª Turma", "morgana": "5ª Turma",
  "katia magalhaes": "6ª Turma", "kátia magalhães": "6ª Turma", "augusto cesar": "6ª Turma", "augusto césar": "6ª Turma", "fabricio de matos": "6ª Turma", "fabrício de matos": "6ª Turma",
  "agra belmonte": "7ª Turma", "mascarenhas brandao": "7ª Turma", "mascarenhas brandão": "7ª Turma", "camargo rodrigues": "7ª Turma",
  "mallmann": "8ª Turma", "valadao": "8ª Turma", "valadão": "8ª Turma", "sergio pinto": "8ª Turma", "sérgio pinto": "8ª Turma",
};

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
  nomeParte?: string;
  mesAno?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface Props {
  onClose?: () => void;
  filters?: CargaFilters;
  selectedProcessNumbers?: string[];
}

export function CargaBennerFromDb({ onClose, filters = {}, selectedProcessNumbers }: Props) {
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [outputData, setOutputData] = useState<Record<string, any>[] | null>(null);
  const [rejectedData, setRejectedData] = useState<RejeicaoRow[]>([]);

  const isManualSelection = !!(selectedProcessNumbers && selectedProcessNumbers.length > 0);

  const processData = async () => {
    setProcessing(true);
    setProgress(0);
    setStats(null);
    setOutputData(null);
    setRejectedData([]);

    try {
      // Phase 1: Fetch distribuicoes_tst
      setPhase("Carregando distribuições do banco...");
      setProgress(10);

      const allDist: any[] = [];
      let page = 0;
      const pageSize = 1000;

      // Lê de dados_benner filtrando aba_origem (escopo distribuições TST). Mapeia campos para o
      // formato esperado adiante (parte_recorrente <- recorrente; favorabilidade textual derivada).
      const mapBennerToDist = (b: any) => ({
        ...b,
        processo_numero: b.processo,
        parte_recorrente: b.recorrente ?? null,
        relator_favorabilidade: b.posicao_relator_favoravel ? "POSITIVO" : b.posicao_relator_desfavoravel ? "NEGATIVO" : null,
        turma_favorabilidade: b.posicao_turma_favoravel ? "POSITIVA" : b.posicao_turma_desfavoravel ? "NEGATIVA" : null,
      });

      if (selectedProcessNumbers && selectedProcessNumbers.length > 0) {
        for (let i = 0; i < selectedProcessNumbers.length; i += 100) {
          const batch = selectedProcessNumbers.slice(i, i + 100);
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .select("*")
            .in("processo", batch)
            .not("aba_origem", "is", null)
            .order("created_at", { ascending: false });
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

      setProgress(30);
      setPhase("Carregando dados Benner para cruzamento...");

      // Phase 2: Fetch dados_benner for pauta matching
      const allBenner: any[] = [];
      page = 0;
      while (true) {
        const { data, error } = await supabase
          .from("dados_benner")
          .select("processo, dossie, data_julgamento, horario_julgamento, tipo_julgamento, sustentacao_oral, entrega_memoriais, provas_digitais, processo_baixado, observacoes, ganhamos, perdemos, resultado_sem_transcendencia, resultado_nao_conhecido, resultado_conhecido_provido, resultado_conhecido_nao_provido, resultado_outra, chance_exito, recurso_bem_aparelhado, recurso_mal_aparelhado, posicao_turma_favoravel, posicao_turma_desfavoravel, posicao_relator_favoravel, posicao_relator_desfavoravel, recorrente, risco_midia, risco_descricao, materia_honra")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allBenner.push(...data);
        if (data.length < pageSize) break;
        page++;
      }

      // Build lookup by processo number
      const bennerByProcesso = new Map<string, any>();
      const bennerByDossie = new Map<string, any>();
      for (const b of allBenner) {
        if (b.processo) {
          const key = normalizeCNJ(b.processo);
          if (key.length >= 10) bennerByProcesso.set(key, b);
        }
        if (b.dossie) bennerByDossie.set(String(b.dossie).toLowerCase().trim(), b);
      }

      setProgress(50);
      setPhase("Gerando Layout Carga...");

      // Phase 3: Process each distribuicao
      const output: Record<string, any>[] = [];
      const rejected: RejeicaoRow[] = [];
      let matched = 0;
      const warningsByType: Record<string, number> = {};
      let warningsTotal = 0;

      // Count by aba
      const abaCount = new Map<string, number>();

      for (let i = 0; i < allDist.length; i++) {
        const d = allDist[i];
        const numProcesso = d.processo_numero || "";
        const dossie = String(d.dossie ?? "").trim();
        const cnj = normalizeCNJ(numProcesso);
        const aba = d.aba_origem || "Sem aba";
        abaCount.set(aba, (abaCount.get(aba) || 0) + 1);

        // Resolve turma from relator
        const relatorNorm = normalizeText(d.relator || "");
        let turmaFromRelator = "";
        for (const [frag, turma] of Object.entries(MINISTRO_TURMA)) {
          if (relatorNorm.includes(frag)) { turmaFromRelator = turma; break; }
        }

        let turmaRaw = turmaFromRelator || String(d.turma ?? "").trim();
        if (/^[-–—_\s]+$/.test(turmaRaw)) turmaRaw = "";

        // Validate
        let motivo = getMotivoRejeicaoDossie(dossie, numProcesso);
        if (!motivo && !turmaRaw) motivo = "Turma não preenchida";
        if (motivo) {
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
              "Data Distribuição": formatDateDDMMYYYY(d.data_distribuicao),
              "Turma": d.turma || "",
              "Relator": d.relator || "",
              "Motivo": motivo,
            });
            continue;
          }
        }

        // Match with dados_benner
        let benner: any = undefined;
        if (cnj.length >= 10) benner = bennerByProcesso.get(cnj);
        if (!benner && dossie) benner = bennerByDossie.get(dossie.toLowerCase());

        const hasJulg = !!benner?.data_julgamento;
        if (hasJulg) matched++;

        // Build tipo recurso from distribuicao fields
        const tipoRecursoParts = [d.tipo_recurso_reclamante, d.tipo_recurso_banco]
          .filter(v => v && !/^[-–—\s]+$/.test(v))
          .map(v => expandSigla(v!));
        const tipoRecursoDedup = [...new Set(tipoRecursoParts.filter(Boolean))];

        // Turma formatting
        let turmaVal = turmaRaw;
        const turmaLower = normalizeText(turmaVal);
        if (turmaLower.includes("presidencia") || turmaLower.includes("presidência")) {
          turmaVal = "Presidência";
        } else if (turmaVal && !turmaLower.includes("turma") && !turmaLower.includes("pleno")) {
          turmaVal = turmaVal + " Turma";
        }

        // Midia negativa
        const midiaRaw = String(d.midia_negativa ?? "").trim();
        const midiaNorm = normalizeText(midiaRaw);
        let midiaH = "", risco = "";
        if (midiaNorm.startsWith("sim")) {
          midiaH = "S";
          risco = midiaRaw.replace(/^[Ss][Ii][Mm]\s*[-–—,.:;]*\s*/, "").trim();
        } else if (midiaNorm === "nao" || midiaNorm === "n" || midiaNorm === "não" || midiaNorm === "") {
          midiaH = midiaRaw ? "N" : "";
        } else {
          midiaH = "N";
        }

        // Favorabilidade from distribuicao fields
        const turmaFav = deriveFavoravel(d.turma_favorabilidade);
        const relatorFav = deriveFavoravel(d.relator_favorabilidade);
        const aparelhamento = deriveAparelhamento(d.aparelhamento_banco);

        const outRow: Record<string, any> = {};
        outRow[LAYOUT_COLS[0]] = dossie;
        outRow[LAYOUT_COLS[1]] = "TST";
        outRow[LAYOUT_COLS[2]] = tipoRecursoDedup.join(" - ");
        outRow[LAYOUT_COLS[3]] = formatDateDDMMYYYY(d.data_distribuicao);
        outRow[LAYOUT_COLS[4]] = turmaVal;
        outRow[LAYOUT_COLS[5]] = String(d.relator ?? "").trim();
        outRow[LAYOUT_COLS[6]] = String(d.decisao_quarteirizado ?? "");
        outRow[LAYOUT_COLS[7]] = midiaH;
        outRow[LAYOUT_COLS[8]] = risco;
        outRow[LAYOUT_COLS[9]] = benner?.provas_digitais ? toSN(benner.provas_digitais) : "N";
        outRow[LAYOUT_COLS[10]] = hasJulg ? "S" : "N";
        outRow[LAYOUT_COLS[11]] = hasJulg ? formatDateDDMMYYYY(benner.data_julgamento) : "";
        outRow[LAYOUT_COLS[12]] = hasJulg ? String(benner?.horario_julgamento ?? "") : "";
        outRow[LAYOUT_COLS[13]] = hasJulg ? String(benner?.tipo_julgamento ?? "") : "";
        outRow[LAYOUT_COLS[14]] = d.honra ? toSN(d.honra) : (benner?.materia_honra ? toSN(benner.materia_honra) : "");
        outRow[LAYOUT_COLS[15]] = benner?.entrega_memoriais ? toSN(benner.entrega_memoriais) : "";
        outRow[LAYOUT_COLS[16]] = benner?.sustentacao_oral ? toSN(benner.sustentacao_oral) : "";
        outRow[LAYOUT_COLS[17]] = benner?.resultado_sem_transcendencia ? "X" : "";
        outRow[LAYOUT_COLS[18]] = benner?.resultado_nao_conhecido ? "X" : "";
        outRow[LAYOUT_COLS[19]] = benner?.resultado_conhecido_provido ? "X" : "";
        outRow[LAYOUT_COLS[20]] = benner?.resultado_conhecido_nao_provido ? "X" : "";
        outRow[LAYOUT_COLS[21]] = benner?.resultado_outra || "";
        outRow[LAYOUT_COLS[22]] = benner?.observacoes || "";
        outRow[LAYOUT_COLS[23]] = benner?.ganhamos ? "X" : "";
        outRow[LAYOUT_COLS[24]] = benner?.perdemos ? "X" : "";
        outRow[LAYOUT_COLS[25]] = benner?.processo_baixado ? toSN(benner.processo_baixado) : (d.execucao && normalizeText(d.execucao).includes("sim") ? "S" : "");
        outRow[LAYOUT_COLS[26]] = d.parte_recorrente || benner?.recorrente || "";
        outRow[LAYOUT_COLS[27]] = turmaFav === "Favorável" ? "X" : (benner?.posicao_turma_favoravel ? "X" : "");
        outRow[LAYOUT_COLS[28]] = turmaFav === "Desfavorável" ? "X" : (benner?.posicao_turma_desfavoravel ? "X" : "");
        outRow[LAYOUT_COLS[29]] = relatorFav === "Favorável" ? "X" : (benner?.posicao_relator_favoravel ? "X" : "");
        outRow[LAYOUT_COLS[30]] = relatorFav === "Desfavorável" ? "X" : (benner?.posicao_relator_desfavoravel ? "X" : "");
        outRow[LAYOUT_COLS[31]] = aparelhamento === "Bem aparelhado" ? "X" : (benner?.recurso_bem_aparelhado ? "X" : "");
        outRow[LAYOUT_COLS[32]] = aparelhamento === "Mal aparelhado" ? "X" : (benner?.recurso_mal_aparelhado ? "X" : "");
        outRow[LAYOUT_COLS[33]] = d.chance_exito_banco || benner?.chance_exito || "";
        outRow["__numProcesso"] = numProcesso;

        // Sanitize dash-only values
        for (const key of Object.keys(outRow)) {
          if (!key.startsWith("__") && typeof outRow[key] === "string" && /^[-–—\s]+$/.test(outRow[key])) {
            outRow[key] = "";
          }
        }
        output.push(outRow);

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
      const warningSuffix = isManualSelection && warningsTotal > 0
        ? `, ${warningsTotal} aviso(s)`
        : "";
      toast.success(`Layout gerado com ${outputFinal.length} linha(s), ${transitoFiltered.length} trânsito em julgado e ${rejected.length} rejeição(ões)${warningSuffix}.`);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
      console.error("[CargaBennerFromDb] Error:", err);
    } finally {
      setProcessing(false);
    }
  };

  const downloadXlsx = async (fullMode: "full" | "aq" | "ag") => {
    if (!outputData) return;
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

      const maxCol = fullMode === "full" ? LAYOUT_COLS.length : fullMode === "ag" ? 7 : 17;

      let stylesXml = await zip.file("xl/styles.xml")!.async("string");
      const cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">/);
      let centeredStyleId = 0;
      if (cellXfsMatch) {
        const cnt = parseInt(cellXfsMatch[1]);
        stylesXml = stylesXml.replace(/<\/cellXfs>/, `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>`);
        stylesXml = stylesXml.replace(`<cellXfs count="${cnt}">`, `<cellXfs count="${cnt + 1}">`);
        centeredStyleId = cnt;
        zip.file("xl/styles.xml", stylesXml);
      }

      let dataRowsXml = "";
      for (let i = 0; i < outputData.length; i++) {
        const row = outputData[i];
        const rowNum = i + 3;
        let cellsXml = "";
        for (let c = 0; c < maxCol; c++) {
          const val = String(row[LAYOUT_COLS[c]] ?? "");
          if (!val) continue;
          const ref = colToLetter(c) + rowNum;
          const idx = getStringIndex(val);
          cellsXml += c <= 5 && centeredStyleId > 0
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
        const row2 = allContent.match(/<row r="2"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? "";
        sheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${row1}${row2}${dataRowsXml}</sheetData>`);
      }
      zip.file("xl/worksheets/sheet1.xml", sheetXml);

      zip.file("xl/sharedStrings.xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${newStrings.length}" uniqueCount="${newStrings.length}">${newStrings.map(s => `<si><t>${escXml(s)}</t></si>`).join("")}</sst>`
      );

      const suffix = fullMode === "full" ? "" : fullMode === "ag" ? "_ate_analise" : "_ate_recurso";
      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Layout_Carga_TST_Supabase${suffix}_${getTimestamp()}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Planilha baixada!");
    } catch (err: any) {
      toast.error("Erro ao gerar planilha: " + (err?.message || String(err)));
    }
  };

  const downloadRejectedXlsx = () => {
    if (rejectedData.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rejectedData);
    ws["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, ws, "Rejeições");
    XLSX.writeFile(wb, `Rejeicoes_Carga_Supabase_${getTimestamp()}.xlsx`);
    toast.success("Rejeições baixadas!");
  };

  const downloadConferenciaXlsx = async () => {
    if (!outputData) return;
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
        stylesXml = stylesXml.replace(/<\/cellXfs>/, `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>`);
        stylesXml = stylesXml.replace(`<cellXfs count="${cnt}">`, `<cellXfs count="${cnt + 1}">`);
        centeredStyleId = cnt;
        zip.file("xl/styles.xml", stylesXml);
      }

      let sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
      const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
      let headerRows = "";
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
          const cellRegex = /<c\s[^>]*r="([A-Z]+)\d+"[^>]*>[\s\S]*?<\/c>|<c\s[^>]*r="([A-Z]+)\d+"[^\/]*\/>/g;
          let cm: RegExpExecArray | null;
          while ((cm = cellRegex.exec(rowXml)) !== null) {
            const colLetter = cm[1] || cm[2];
            const colIdx = colLetterToIndex(colLetter);
            const newColIdx = colIdx >= 1 ? colIdx + 1 : colIdx;
            const newRef = colToLetter(newColIdx) + rowNum;
            cells.push({ col: newColIdx, xml: cm[0].replace(/ r="[A-Z]+\d+"/, ` r="${newRef}"`) });
          }
          if (insertCell) cells.push({ col: 1, xml: insertCell });
          cells.sort((a, b) => a.col - b.col);
          const rowTag = rowXml.match(/<row [^>]*>/)?.[0] || `<row r="${rowNum}">`;
          return rowTag + cells.map(c => c.xml).join("") + "</row>";
        }

        let h1 = row1Match?.[0] ?? "";
        let h2 = row2Match?.[0] ?? "";
        h1 = shiftRow(h1, 1);
        const npIdx = getStrIdx("Processo");
        h2 = shiftRow(h2, 2, `<c r="B2" t="s"${centeredStyleId > 0 ? ` s="${centeredStyleId}"` : ""}><v>${npIdx}</v></c>`);
        headerRows = h1 + h2;
      }

      let dataRowsXml = "";
      for (let i = 0; i < outputData.length; i++) {
        const row = outputData[i];
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
          cellsXml += c + 1 <= 6 && centeredStyleId > 0
            ? `<c r="${ref}" t="s" s="${centeredStyleId}"><v>${getStrIdx(val)}</v></c>`
            : `<c r="${ref}" t="s"><v>${getStrIdx(val)}</v></c>`;
        }
        dataRowsXml += `<row r="${rowNum}" spans="1:${totalCols}">${cellsXml}</row>`;
      }

      const lastRow = outputData.length + 2;
      sheetXml = sheetXml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${colToLetter(totalCols - 1)}${lastRow}"/>`);
      sheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${headerRows}${dataRowsXml}</sheetData>`);
      sheetXml = setWorksheetColumnWidth(sheetXml, 28, 60);
      zip.file("xl/worksheets/sheet1.xml", sheetXml);

      zip.file("xl/sharedStrings.xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${newStrings.length}" uniqueCount="${newStrings.length}">${newStrings.map(s => `<si><t>${escXml(s)}</t></si>`).join("")}</sst>`
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
      {/* Generate Button */}
      {!stats && !processing && (
        <div className="flex justify-center">
          <Button size="lg" onClick={processData} className="px-8">
            <ArrowRight className="w-5 h-5 mr-2" />
            Gerar Layout Carga Benner
          </Button>
        </div>
      )}

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
