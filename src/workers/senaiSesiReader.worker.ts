import * as XLSX from "xlsx";
import { extractHiddenRows } from "./xlsxHiddenRows";

interface ValidationError {
  campo: string;
  mensagem: string;
}

interface ProcessoImport {
  numero: string;
  assunto: string | null;
  situacao: string | null;
  responsavel: string | null;
  parteAtiva: string | null;
  partePassiva: string | null;
  area: string | null;
  valorAcao: number | null;
  dataDistribuicao: string | null;
  orgaoJulgador: string | null;
  status: "pendente" | "valido" | "invalido" | "sucesso" | "erro";
  erros: ValidationError[];
  erroImport?: string;
  linhaOriginal: number;
  abaOrigem?: string;
  senaiData?: {
    pasta: string | null;
    jurisdicaoAtual: string | null;
    tipoProcesso: string | null;
    calculoValidado: string | null;
    partesProcesso: string | null;
    faseAtual: string | null;
    objeto: string | null;
    valorPedido: number | null;
    prognostico: string | null;
    dataCalculo: string | null;
    naturezaFinanceira: string | null;
    entidade: string | null;
    valorPerdaRemota: number | null;
    valorPerdaPossivel: number | null;
    valorPerdaProvavel: number | null;
    rateio: string | null;
    observacoes: string | null;
    entidade2: string | null;
    advogadoCliente: string | null;
  };
}

type IncomingMessage = {
  type: "parse";
  buffer: ArrayBuffer;
  id: number;
};

const ctx: any = self as any;

function postProgress(id: number, progress: number, message: string) {
  ctx.postMessage({ type: "progress", id, progress: Math.max(0, Math.min(100, progress)), message });
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(dateValue: unknown): string | null {
  if (!dateValue) return null;

  if (typeof dateValue === "number") {
    const d = new Date((dateValue - 25569) * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  if (typeof dateValue === "string") {
    const t = dateValue.trim();
    if (!t) return null;

    const isoMatch = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;

    const brMatch = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[R$\s]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  }

  return null;
}

function detectHeaderRow(rows: unknown[][]): number {
  const headerHints = [
    "numero atual do processo",
    "numero do processo",
    "processo",
    "status",
    "natureza",
    "partes do processo",
    "entidade",
    "fase atual",
  ];

  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i] ?? [];
    const normalized = row.map(normalizeKey).filter(Boolean);
    if (!normalized.length) continue;

    const score = normalized.reduce((total, cell) => {
      if (headerHints.some((hint) => cell.includes(hint))) return total + 3;
      return total + 0.05;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function createRowGetter(headerRow: string[]) {
  const normalizedHeaders = headerRow.map(normalizeKey);
  const cache = new Map<string, number>();

  const getColumnIndex = (keys: string[]) => {
    const cacheKey = keys.join("||");
    if (cache.has(cacheKey)) return cache.get(cacheKey) ?? -1;

    let index = -1;

    for (const key of keys) {
      const normalizedKey = normalizeKey(key);
      index = normalizedHeaders.findIndex((header) => header === normalizedKey);
      if (index >= 0) break;
    }

    if (index < 0) {
      for (const key of keys) {
        const normalizedKey = normalizeKey(key);
        index = normalizedHeaders.findIndex((header) => header.includes(normalizedKey));
        if (index >= 0) break;
      }
    }

    cache.set(cacheKey, index);
    return index;
  };

  return (row: unknown[], keys: string[]) => {
    const index = getColumnIndex(keys);
    return index >= 0 ? row[index] : "";
  };
}

function estimateTotalRows(workbook: XLSX.WorkBook, sheetNames: string[]) {
  let total = 0;

  for (const sheetName of sheetNames) {
    const ref = workbook.Sheets[sheetName]?.["!ref"];
    if (!ref) continue;

    try {
      const range = XLSX.utils.decode_range(ref);
      total += Math.max(range.e.r - range.s.r, 1);
    } catch {
      total += 1;
    }
  }

  return Math.max(total, 1);
}

async function parseWorkbook(buffer: ArrayBuffer, id: number) {
  postProgress(id, 12, "Abrindo planilha...");
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
  const sheetNames = workbook.SheetNames ?? [];

  if (!sheetNames.length) {
    throw new Error("A planilha não possui abas válidas.");
  }

  postProgress(id, 18, `Mapeando ${sheetNames.length} aba(s)...`);
  const hiddenRowsMap = await extractHiddenRows(buffer, sheetNames);
  const totalRowsEstimate = estimateTotalRows(workbook, sheetNames);
  const processos: ProcessoImport[] = [];
  let processedRows = 0;

  for (let sheetIndex = 0; sheetIndex < sheetNames.length; sheetIndex++) {
    const sheetName = sheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    postProgress(
      id,
      20 + (sheetIndex / Math.max(sheetNames.length, 1)) * 70,
      `Lendo aba \"${sheetName}\" (${sheetIndex + 1}/${sheetNames.length})...`
    );

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
      rawNumbers: false,
    }) as unknown[][];

    if (!rows.length) continue;

    const hiddenRows = hiddenRowsMap[sheetName] ?? new Set<number>();
    const headerRowIndex = detectHeaderRow(rows);
    const headerRow = (rows[headerRowIndex] ?? []).map((cell) => String(cell ?? "").trim());
    const get = createRowGetter(headerRow);

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      if (hiddenRows.has(rowIndex)) continue;

      const row = rows[rowIndex] ?? [];
      if (row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "")) continue;

      const numeroRaw = String(get(row, ["Numero atual do processo", "Numero do processo", "Processo"]) ?? "").trim();
      const linhaOriginal = rowIndex + 1;

      if (!numeroRaw || numeroRaw.length < 5) {
        processos.push({
          numero: numeroRaw,
          assunto: null,
          situacao: null,
          responsavel: null,
          parteAtiva: null,
          partePassiva: null,
          area: null,
          valorAcao: null,
          dataDistribuicao: null,
          orgaoJulgador: null,
          status: "invalido",
          erros: [
            {
              campo: "numero",
              mensagem: !numeroRaw ? "Número do processo vazio" : `Número muito curto (${numeroRaw.length} chars)`,
            },
          ],
          linhaOriginal,
          abaOrigem: sheetName,
        });
        processedRows++;
        continue;
      }

      const partesProcesso = String(get(row, ["Partes do Processo"]) ?? "").trim();
      const clientePrincipal = String(get(row, ["Cliente Principal"]) ?? "").trim();
      const adversoPrincipal = String(get(row, ["Adverso Principal"]) ?? "").trim();

      let poloAtivo: string | null = null;
      let poloPassivo: string | null = null;

      if (partesProcesso) {
        if (clientePrincipal || adversoPrincipal) {
          poloPassivo = clientePrincipal || null;
          poloAtivo = adversoPrincipal || null;
        } else {
          poloPassivo = partesProcesso;
        }
      }

      const processo: ProcessoImport = {
        numero: numeroRaw,
        assunto: String(get(row, ["Objeto"]) ?? "").trim() || null,
        situacao: String(get(row, ["status"]) ?? "").trim() || null,
        responsavel: String(get(row, ["Advogado do Cliente", "Advogado principal do Cliente"]) ?? "").trim() || null,
        parteAtiva: poloAtivo,
        partePassiva: poloPassivo,
        area: String(get(row, ["Natureza"]) ?? "").trim() || "trabalhista",
        valorAcao: parseNumber(get(row, ["Valor Pedido", "Valor da Garantia"])),
        dataDistribuicao: parseDate(get(row, ["Data de Início", "Data de Inclusão"])),
        orgaoJulgador: String(get(row, ["Jurisdição Atual", "Jurisdicao Atual"]) ?? "").trim() || null,
        status: "valido",
        erros: [],
        linhaOriginal,
        abaOrigem: sheetName,
        senaiData: {
          pasta: String(get(row, ["Pasta"]) ?? "").trim() || null,
          jurisdicaoAtual: String(get(row, ["Jurisdição Atual", "Jurisdicao Atual"]) ?? "").trim() || null,
          tipoProcesso: String(get(row, ["Tipo de Processo"]) ?? "").trim() || null,
          calculoValidado: String(get(row, ["CALCULO VALIDADO"]) ?? "").trim() || null,
          partesProcesso: partesProcesso || null,
          faseAtual: String(get(row, ["Fase Atual"]) ?? "").trim() || null,
          objeto: String(get(row, ["Objeto"]) ?? "").trim() || null,
          valorPedido: parseNumber(get(row, ["Valor Pedido"])),
          prognostico: String(get(row, ["Prognóstico", "Prognostico"]) ?? "").trim() || null,
          dataCalculo:
            parseDate(get(row, ["Data Cálculo", "Data Calculo"])) ||
            String(get(row, ["Data Cálculo", "Data Calculo"]) ?? "").trim() ||
            null,
          naturezaFinanceira: String(get(row, ["Natureza Financeira"]) ?? "").trim() || null,
          entidade: String(get(row, ["Entidade"]) ?? "").trim() || null,
          valorPerdaRemota: parseNumber(get(row, ["Valor Perda Remota Corrigido"])),
          valorPerdaPossivel: parseNumber(
            get(row, ["Valor Perda Possível Objeto Corrigido", "Valor Perda Possivel Objeto Corrigido"])
          ),
          valorPerdaProvavel: parseNumber(
            get(row, ["Valor Perda Provável Objeto Corrigido", "Valor Perda Provavel Objeto Corrigido"])
          ),
          rateio: String(get(row, ["Rateio"]) ?? "").trim() || null,
          observacoes: String(get(row, ["Observações", "Observacoes", "Detalhes"]) ?? "").trim() || null,
          entidade2: null,
          advogadoCliente: String(get(row, ["Advogado do Cliente", "Advogado principal do Cliente"]) ?? "").trim() || null,
        },
      };

      if (sheetName.toLowerCase().includes("garantia")) {
        const garantiaTipo = String(get(row, ["Garantia"]) ?? "").trim();
        const liberada = String(get(row, ["Liberada"]) ?? "").trim();
        processo.senaiData!.observacoes = [
          garantiaTipo ? `Garantia: ${garantiaTipo}` : null,
          liberada ? `Liberada: ${liberada}` : null,
          processo.senaiData!.observacoes,
        ]
          .filter(Boolean)
          .join(" | ");
      }

      processos.push(processo);
      processedRows++;

      if (processedRows % 50 === 0) {
        postProgress(
          id,
          20 + (processedRows / totalRowsEstimate) * 75,
          `Lendo aba \"${sheetName}\"... (${processedRows} linhas úteis)`
        );
      }
    }
  }

  return { processos, totalSheets: sheetNames.length };
}

ctx.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  if (event.data.type !== "parse") return;

  try {
    const { buffer, id } = event.data;
    const result = await parseWorkbook(buffer, id);
    postProgress(id, 100, "Planilha carregada.");
    ctx.postMessage({ type: "result", id, ...result });
  } catch (error: any) {
    ctx.postMessage({
      type: "error",
      id: event.data.id,
      error: error?.message || "Falha ao processar a planilha.",
    });
  }
};
