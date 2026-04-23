import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, XCircle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

function norm(val: unknown): string {
  return String(val ?? "").trim();
}

function normalizeName(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

// Apelidos curtos -> nome completo na coordenação Dra. Renata
const NAME_ALIASES: Record<string, string> = {
  "anna": "anna luiza brandao",
  "priscila": "priscila brandt",
};

function parseDateBR(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  // Date object nativo (quando cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const raw = String(val).trim();
  if (!raw) return null;
  // Remove parte de hora se houver (ex: "01/12/2024 14:30:00")
  const t = raw.split(/[\sT]/)[0];
  // dd/mm/yyyy ou dd-mm-yyyy ou dd.mm.yyyy
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) {
    const dia = m[1].padStart(2, "0");
    const mes = m[2].padStart(2, "0");
    let ano = m[3];
    if (ano.length === 2) {
      const n = Number(ano);
      ano = (n >= 70 ? 1900 + n : 2000 + n).toString();
    }
    return `${ano}-${mes}-${dia}`;
  }
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // Serial Excel
  const n = Number(raw);
  if (!isNaN(n) && n > 30000 && n < 100000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function toBool(val: unknown): boolean {
  const t = String(val ?? "").trim().toUpperCase();
  return t === "S" || t === "SIM" || t === "X" || t === "TRUE";
}

function normalizeDossie(val: unknown): string {
  return norm(val).replace(/\s+/g, " ");
}

function isValidDossie(val: unknown): boolean {
  const raw = normalizeDossie(val);
  if (!raw) return false;

  const normalized = normalizeName(raw);
  if (!normalized) return false;

  const invalidPatterns = [
    "dossie nao localizado",
    "nao localizado",
    "não localizado",
    "nao encontrado",
    "não encontrado",
    "n/localizado",
    "sem acesso ao benner",
    "caso encerrado no benner",
    "dossie nao localizado sem acesso ao benner",
    "dossie nao localizado nao encontrado no benner",
  ];

  return !invalidPatterns.some((pattern) => normalized.includes(normalizeName(pattern)));
}

function isExplicitNoResponsavel(val: unknown): boolean {
  const normalized = normalizeName(val);
  return normalized === "sem responsavel" || normalized === "s responsavel";
}

function isMoreRecentRow(
  next: { hasValidDossie: boolean; sortKey: number; sheetOrder: number; rowIndex: number },
  current: { hasValidDossie: boolean; sortKey: number; sheetOrder: number; rowIndex: number }
): boolean {
  if (next.hasValidDossie !== current.hasValidDossie) return next.hasValidDossie;
  if (next.sortKey !== current.sortKey) return next.sortKey > current.sortKey;
  if (next.sheetOrder !== current.sheetOrder) return next.sheetOrder > current.sheetOrder;
  return next.rowIndex > current.rowIndex;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m${s > 0 ? ` ${s}s` : ""}`;
}

interface Props {
  onImported: () => void;
}

const BATCH_SIZE = 500;
const EXISTING_CHECK_BATCH_SIZE = 80;

interface DuplicateRow {
  sheetName: string;
  rowIndex: number;
  processo: string;
  dossie: string;
  row: string[];
}

interface ImportPlanRow {
  sheetName: string;
  sheetOrder: number;
  rowIndex: number;
  processoNumero: string;
  row: string[];
  responsavelRaw: string;
}

export function DistribuicaoTstImport({ onImported }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [detailText, setDetailText] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateRow[]>([]);
  const [duplicatesHeader, setDuplicatesHeader] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const startTimeRef = useRef(0);

  const resetState = () => {
    setImporting(false);
    setProgress(0);
    setStatusText("");
    setDetailText("");
    cancelRef.current = false;
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadDuplicates = () => {
    if (duplicates.length === 0) return;
    const wb = XLSX.utils.book_new();
    const aoa: any[][] = [
      ["Aba", "Linha na planilha", "Processo", "Dossiê", ...duplicatesHeader],
      ...duplicates.map(d => [d.sheetName, d.rowIndex + 1, d.processo, d.dossie, ...d.row]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Duplicados");
    XLSX.writeFile(wb, `duplicados-tst-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cancelRef.current = false;
    setImporting(true);
    setProgress(0);
    setDuplicates([]);
    setDuplicatesHeader([]);
    startTimeRef.current = Date.now();
    setStatusText("Lendo planilha...");

    try {
      // === STEP 0: Auth ===
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado para importar.");
        resetState();
        return;
      }

      // === STEP 1: Parse Excel ===
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

      const allRows: ImportPlanRow[] = [];
      let capturedHeader: string[] = [];
      for (const [sheetOrder, sheetName] of wb.SheetNames.entries()) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];
        let headerIdx = -1;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          if (json[i]?.some(c => /n[uú]mero.*processo/i.test(String(c ?? "")) || /dossi[eê]/i.test(String(c ?? "")))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) continue;
        if (capturedHeader.length === 0) capturedHeader = (json[headerIdx] || []).map(c => String(c ?? ""));
        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
          if (!r || r.every(c => !String(c ?? "").trim())) continue;
          const num = norm(r[1]);
          if (!num || num.length < 7) continue;
          // Coluna AB = índice 27 (Responsável)
          const responsavelRaw = norm(r[27]);
          allRows.push({ sheetName, sheetOrder, rowIndex: i, processoNumero: num, row: r, responsavelRaw });
        }
      }

      if (allRows.length === 0) {
        toast.warning("Nenhum registro válido encontrado na planilha");
        resetState();
        return;
      }

      // === Carregar membros da coordenação Dra. Renata para resolver responsáveis ===
      const { data: membrosRows } = await supabase
        .from("membros_coordenacao" as any)
        .select("usuario_id")
        .eq("coordenacao_id", RENATA_COORDENACAO_ID);
      const membroIds = ((membrosRows as any[]) || []).map(m => m.usuario_id);
      const nameToUserId = new Map<string, string>();
      if (membroIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_basic")
          .select("id, nome")
          .in("id", membroIds);
        ((profs as any[]) || []).forEach(p => {
          const key = normalizeName(p.nome);
          if (key) nameToUserId.set(key, p.id);
        });
      }

      const resolveResponsavel = (raw: string): string | null => {
        if (!raw) return null;
        const key = normalizeName(raw);
        if (!key) return null;
        // Match exato pelo nome completo
        if (nameToUserId.has(key)) return nameToUserId.get(key)!;
        // Apelido (primeiro nome) -> nome completo
        const aliasTarget = NAME_ALIASES[key];
        if (aliasTarget && nameToUserId.has(aliasTarget)) return nameToUserId.get(aliasTarget)!;
        // Tenta casar primeiro nome único na coordenação
        const firstName = key.split(" ")[0];
        const candidates: string[] = [];
        for (const [fullName, id] of nameToUserId.entries()) {
          if (fullName.split(" ")[0] === firstName) candidates.push(id);
        }
        if (candidates.length === 1) return candidates[0];
        return null;
      };

      const responsavelNaoEncontrados = new Set<string>();
      const latestResponsavelByProcess = new Map<string, { raw: string; userId: string | null; clear: boolean }>();

      for (const rec of allRows) {
        const raw = rec.responsavelRaw;
        if (!raw) continue;

        const sortKey = Date.parse(String(rec.row[0] ?? "")) || 0;
        const nextMeta = {
          hasValidDossie: isValidDossie(rec.row[2]),
          sortKey,
          sheetOrder: rec.sheetOrder,
          rowIndex: rec.rowIndex,
        };

        const current = latestResponsavelByProcess.get(rec.processoNumero) as any;
        if (current && !isMoreRecentRow(nextMeta, current.meta)) continue;

        let userId: string | null = null;
        let clear = false;
        if (isExplicitNoResponsavel(raw)) {
          clear = true;
        } else {
          userId = resolveResponsavel(raw);
          if (!userId) responsavelNaoEncontrados.add(raw);
        }

        latestResponsavelByProcess.set(rec.processoNumero, { raw, userId, clear, meta: nextMeta } as any);
      }

      // === Detectar duplicados (mesmo processo+dossie aparecendo mais de uma vez) ===
      const counts = new Map<string, number>();
      for (const rec of allRows) {
        const dossie = norm(rec.row[2]);
        const key = `${rec.processoNumero}||${dossie}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const dupRows: DuplicateRow[] = allRows
        .filter(rec => {
          const dossie = norm(rec.row[2]);
          return (counts.get(`${rec.processoNumero}||${dossie}`) || 0) > 1;
        })
        .map(rec => ({
          sheetName: rec.sheetName,
          rowIndex: rec.rowIndex,
          processo: rec.processoNumero,
          dossie: norm(rec.row[2]),
          row: rec.row.map(c => String(c ?? "")),
        }));
      if (dupRows.length > 0) {
        setDuplicates(dupRows);
        setDuplicatesHeader(capturedHeader);
        toast.warning(`${dupRows.length} linhas duplicadas detectadas. Use o botão "Baixar Duplicados" para revisar.`, { duration: 10000 });
      }

      // === STEP 2: Upsert processos (bulk, no lookup needed) ===
      const latestRowByProcess = new Map<string, ImportPlanRow>();
      for (const rec of allRows) {
        const current = latestRowByProcess.get(rec.processoNumero);
        if (!current) {
          latestRowByProcess.set(rec.processoNumero, rec);
          continue;
        }

        const nextMeta = {
          hasValidDossie: isValidDossie(rec.row[2]),
          sortKey: Date.parse(String(rec.row[0] ?? "")) || 0,
          sheetOrder: rec.sheetOrder,
          rowIndex: rec.rowIndex,
        };
        const currentMeta = {
          hasValidDossie: isValidDossie(current.row[2]),
          sortKey: Date.parse(String(current.row[0] ?? "")) || 0,
          sheetOrder: current.sheetOrder,
          rowIndex: current.rowIndex,
        };
        if (isMoreRecentRow(nextMeta, currentMeta)) latestRowByProcess.set(rec.processoNumero, rec);
      }

      const uniqueNumeros = [...latestRowByProcess.keys()];
      const firstOcc = new Map<string, string[]>();
      for (const [processoNumero, rec] of latestRowByProcess.entries()) {
        firstOcc.set(processoNumero, rec.row);
      }

      // Step 1: Lookup existing processos to know which are new vs updated
      setStatusText("Etapa 1/3: Verificando processos existentes");
      startTimeRef.current = Date.now();

      const processoIdMap = new Map<string, string>();
      const existingNumeros = new Set<string>();

      for (let i = 0; i < uniqueNumeros.length; i += BATCH_SIZE) {
        if (cancelRef.current) { toast.info("Cancelado."); resetState(); return; }
        const batch = uniqueNumeros.slice(i, i + BATCH_SIZE);
        const { data } = await supabase.from("processos").select("id, numero").in("numero", batch);
        (data || []).forEach((p: any) => {
          processoIdMap.set(p.numero, p.id);
          existingNumeros.add(p.numero);
        });
        const done = Math.min(i + BATCH_SIZE, uniqueNumeros.length);
        setProgress(Math.round((done / uniqueNumeros.length) * 10));
        setDetailText(`${done}/${uniqueNumeros.length} verificados`);
      }

      // Step 2: Upsert all processos (creates new, updates existing)
      const processosToUpsert = uniqueNumeros.map(num => {
        const r = firstOcc.get(num)!;
        return {
          numero: num,
          status: "ativo" as const,
          area: "trabalhista",
          polo_ativo: norm(r[4]) || null,
          polo_passivo: norm(r[5]) || null,
          dossie_tst: norm(r[2]) || null,
          relator_tst: norm(r[6]) || null,
          turma_tst: norm(r[8]) || null,
        };
      });

      let newProcessos = 0;
      let updatedProcessos = 0;

      setStatusText(`Etapa 2/3: Salvando ${uniqueNumeros.length} processos`);
      startTimeRef.current = Date.now();

      for (let i = 0; i < processosToUpsert.length; i += BATCH_SIZE) {
        if (cancelRef.current) { toast.info("Cancelado."); resetState(); return; }
        const batch = processosToUpsert.slice(i, i + BATCH_SIZE);
        const { data, error } = await (supabase.from("processos") as any)
          .upsert(batch, { onConflict: "numero", ignoreDuplicates: false })
          .select("id, numero");

        if (error) {
          console.error("Erro upsert processos:", error);
        } else if (data) {
          for (const p of data as any[]) {
            processoIdMap.set(p.numero, p.id);
            if (existingNumeros.has(p.numero)) {
              updatedProcessos++;
            } else {
              newProcessos++;
            }
          }
        }

        const done = Math.min(i + BATCH_SIZE, processosToUpsert.length);
        setProgress(10 + Math.round((done / processosToUpsert.length) * 20));
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const eta = done > 0 ? ((processosToUpsert.length - done) * elapsed / done) : 0;
        setDetailText(`${done}/${processosToUpsert.length} processos · ${newProcessos} novos · ${updatedProcessos} atualizados${eta > 2 ? ` · ~${formatDuration(eta)} restante` : ""}`);
      }

      // === STEP 3: Upsert distribuições direto em dados_benner (tabela única) ===
      setStatusText("Etapa 3/3: Salvando distribuições em Dados Benner");
      startTimeRef.current = Date.now();

      const upsertRecords = [...latestRowByProcess.values()]
        .filter(rec => processoIdMap.has(rec.processoNumero) && rec.processoNumero)
        .map(({ sheetName, processoNumero, row: r }) => {
          const relatorFav = norm(r[7]).toLowerCase();
          const turmaFav = norm(r[9]).toLowerCase();
          const dossieVal = isValidDossie(r[2]) ? normalizeDossie(r[2]) : null;
          const dataPlanilha = parseDateBR(r[0]);
          return {
            processo: processoNumero,
            tribunal: "TST",
            aba_origem: sheetName,
            data_distribuicao_planilha: dataPlanilha,
            dossie: dossieVal || null,
            equipe: norm(r[3]) || null,
            reclamante: norm(r[4]) || null,
            reclamada: norm(r[5]) || null,
            relator: norm(r[6]) || null,
            posicao_relator_favoravel: relatorFav.includes("positiv") ? true : null,
            posicao_relator_desfavoravel: relatorFav.includes("negativ") ? true : null,
            turma: norm(r[8]) || null,
            posicao_turma_favoravel: turmaFav.includes("positiv") ? true : null,
            posicao_turma_desfavoravel: turmaFav.includes("negativ") ? true : null,
            recorrente: norm(r[10]) || null,
            tipo_recurso_reclamante: norm(r[11]) || null,
            materias_recurso_reclamante: norm(r[12]) || null,
            aparelhamento_reclamante: norm(r[13]) || null,
            chance_exito_reclamante: norm(r[14]) || null,
            tipo_recurso_banco: norm(r[15]) || null,
            materias_recurso_banco: norm(r[16]) || null,
            aparelhamento_banco: norm(r[17]) || null,
            chance_exito_banco: norm(r[18]) || null,
            honra: norm(r[19]) || null,
            tema: norm(r[20]) || null,
            execucao: norm(r[21]) || null,
            midia_negativa: norm(r[22]) || null,
            decisao_quarteirizado: norm(r[23]) || null,
            recurso_terceiros: norm(r[24]) || null,
            transito_julgado: toBool(r[25]),
            benner_atualizado: toBool(r[26]),
            status: "rascunho",
            user_id: user.id,
            coordenacao_id: "3e47fc83-3539-4fa7-9fcf-33825120e1b7", // Sempre Coordenação Dra. Renata Santander
            data_distribuicao_real: dataPlanilha,
          };
        });

      const existingRowsByProcess = new Map<string, { id: string; dossie: string | null; judit_preenchido: boolean | null }[]>();
      for (let i = 0; i < uniqueNumeros.length; i += EXISTING_CHECK_BATCH_SIZE) {
        const batch = uniqueNumeros.slice(i, i + EXISTING_CHECK_BATCH_SIZE);
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("id, processo, dossie, judit_preenchido")
          .eq("tribunal", "TST")
          .in("processo", batch);
        if (error) throw error;
        (data || []).forEach((row: any) => {
          const list = existingRowsByProcess.get(row.processo) || [];
          list.push(row);
          existingRowsByProcess.set(row.processo, list);
        });
      }

      const recordsToPersist = upsertRecords.filter((record) => {
        const existingRows = existingRowsByProcess.get(record.processo) || [];
        if (existingRows.some((row) => row.judit_preenchido === true)) return false;
        if (!record.dossie && existingRows.some((row) => !!row.dossie)) return false;
        return true;
      });

      const existingPairs = new Set<string>();
      const juditPairs = new Set<string>(); // pares processo||dossie com judit_preenchido=true (não sobrescrever)
      const recordKeys = recordsToPersist.map(record => `${record.processo}||${record.dossie ?? ""}`);

      recordsToPersist.forEach((record) => {
        const key = `${record.processo}||${record.dossie ?? ""}`;
        if ((existingRowsByProcess.get(record.processo) || []).some((row) => normalizeDossie(row.dossie) === normalizeDossie(record.dossie))) {
          existingPairs.add(key);
        }
      });
      existingRowsByProcess.forEach((rows, processo) => {
        rows.filter((row) => row.judit_preenchido === true).forEach((row) => {
          juditPairs.add(`${processo}||${row.dossie ?? ""}`);
        });
      });

      let totalUpserted = 0;
      let totalErrors = 0;
      let firstError: string | null = null;
      const totalRecords = recordsToPersist.length;

      const processBatch = async (records: any[], mode: "insert" | "upsert") => {
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          if (cancelRef.current) return false;
          const batch = records.slice(i, i + BATCH_SIZE);

          let error: any;
          if (mode === "upsert") {
            const res = await (supabase.from("dados_benner" as any) as any)
              .upsert(batch, { onConflict: "processo,dossie", ignoreDuplicates: false });
            error = res.error;
          } else {
            const res = await supabase.from("dados_benner" as any).insert(batch as any);
            error = res.error;
          }

          if (error) {
            console.error("Erro ao salvar dados_benner:", error, "Sample record:", batch[0]);
            if (!firstError) firstError = `${error.message}${error.details ? ` | ${error.details}` : ""}${error.hint ? ` | ${error.hint}` : ""}`;
            totalErrors += batch.length;
          } else {
            totalUpserted += batch.length;
          }

          const done = totalUpserted + totalErrors;
          const pct = totalRecords > 0 ? 30 + Math.round((done / totalRecords) * 70) : 100;
          setProgress(pct);
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const eta = done > 0 ? ((totalRecords - done) * elapsed / done) : 0;
          setDetailText(`${done}/${totalRecords} distribuições · ${totalErrors > 0 ? `${totalErrors} erros · ` : ""}${formatDuration(elapsed)}${eta > 2 ? ` · ~${formatDuration(eta)} restante` : ""}`);
        }
        return true;
      };

      const okPersist = await processBatch(recordsToPersist, "upsert");
      if (!okPersist) {
        toast.info(`Cancelado. ${totalUpserted} registros processados.`);
        onImported();
        resetState();
        return;
      }

      // === STEP 4: Atualizar responsável (coluna AB) ===
      // Constrói mapa (processo||dossie) -> responsavel_user_id a partir das linhas da planilha
      // Apenas linhas com célula AB preenchida e nome resolvido entram (vazio = mantém o que está no Supabase)
      setStatusText("Atualizando responsáveis");
      let respAtualizados = 0;
      if (latestResponsavelByProcess.size > 0) {
        const processosComResponsavel = [...latestResponsavelByProcess.keys()];
        const processToBennerId = new Map<string, string>();
        const LOOKUP_BATCH = 100;
        for (let i = 0; i < processosComResponsavel.length; i += LOOKUP_BATCH) {
          if (cancelRef.current) break;
          const batchProc = processosComResponsavel.slice(i, i + LOOKUP_BATCH);
          const { data, error } = await (supabase.from("dados_benner") as any)
            .select("id, processo, dossie, updated_at, created_at")
            .eq("tribunal", "TST")
            .in("processo", batchProc);
          if (error) {
            console.error("Erro ao buscar IDs dados_benner para responsáveis:", error);
            continue;
          }
          const grouped = new Map<string, any[]>();
          (data || []).forEach((row: any) => {
            const list = grouped.get(row.processo) || [];
            list.push(row);
            grouped.set(row.processo, list);
          });
          grouped.forEach((rows, processo) => {
            rows.sort((a, b) => {
              const aValid = !!a.dossie;
              const bValid = !!b.dossie;
              if (aValid !== bValid) return aValid ? -1 : 1;
              return String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at));
            });
            processToBennerId.set(processo, rows[0].id);
          });
        }

        const bennerIdsParaLimpar: string[] = [];
        const insertRows: { dados_benner_id: string; usuario_id: string }[] = [];
        for (const [processo, payload] of latestResponsavelByProcess.entries()) {
          const bennerId = processToBennerId.get(processo);
          if (!bennerId) continue;
          bennerIdsParaLimpar.push(bennerId);
          if (!payload.clear && payload.userId) {
            insertRows.push({ dados_benner_id: bennerId, usuario_id: payload.userId });
          }
        }

        const DEL_BATCH = 200;
        for (let i = 0; i < bennerIdsParaLimpar.length; i += DEL_BATCH) {
          if (cancelRef.current) break;
          const ids = bennerIdsParaLimpar.slice(i, i + DEL_BATCH);
          const { error: delErr } = await (supabase.from("dados_benner_responsaveis" as any) as any)
            .delete()
            .in("dados_benner_id", ids);
          if (delErr) { console.error("Erro ao limpar responsáveis:", delErr); continue; }
        }

        for (let i = 0; i < insertRows.length; i += DEL_BATCH) {
          if (cancelRef.current) break;
          const slice = insertRows.slice(i, i + DEL_BATCH);
          const { error: insErr } = await (supabase.from("dados_benner_responsaveis" as any) as any)
            .insert(slice as any);
          if (insErr) { console.error("Erro ao inserir responsáveis:", insErr); continue; }
          respAtualizados += slice.length;
        }
      }

      setProgress(100);
      setStatusText("Concluído!");

      if (totalUpserted > 0) {
        const parts: string[] = [`${totalUpserted} distribuições salvas`];
        if (newProcessos > 0) parts.push(`${newProcessos} processos novos`);
        if (updatedProcessos > 0) parts.push(`${updatedProcessos} processos atualizados`);
        if (juditPairs.size > 0) parts.push(`${juditPairs.size} preservados (Judit)`);
        if (respAtualizados > 0) parts.push(`${respAtualizados} responsáveis atualizados`);
        if (totalErrors > 0) parts.push(`${totalErrors} erros`);
        toast.success(parts.join(", ") + "!");
        if (responsavelNaoEncontrados.size > 0) {
          const lista = [...responsavelNaoEncontrados].slice(0, 10).join(", ");
          toast.warning(
            `Responsáveis não encontrados na coordenação Dra. Renata: ${lista}${responsavelNaoEncontrados.size > 10 ? "..." : ""}`,
            { duration: 15000 }
          );
        }
        onImported();
      } else {
        toast.error(
          `Nenhum registro importado. ${totalErrors} com erro. ${firstError ? `Causa: ${firstError}` : "Verifique o console (F12)."}`,
          { duration: 20000 }
        );
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setTimeout(resetState, 2000);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          Importar Planilha
        </Button>
        {duplicates.length > 0 && (
          <Button
            variant="outline"
            onClick={downloadDuplicates}
            className="border-warning text-warning hover:bg-warning/10"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Baixar Duplicados ({duplicates.length})
          </Button>
        )}
        {importing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cancelRef.current = true;
              setStatusText("Cancelando... aguarde o lote atual finalizar");
              toast.info("Cancelamento solicitado. Aguardando lote atual...");
            }}
            disabled={cancelRef.current}
            className="text-destructive hover:text-destructive"
          >
            <XCircle className="w-4 h-4 mr-1" /> Cancelar
          </Button>
        )}
      </div>

      {importing && statusText && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3 max-w-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{statusText}</span>
            <span className="text-muted-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          {detailText && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{detailText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
