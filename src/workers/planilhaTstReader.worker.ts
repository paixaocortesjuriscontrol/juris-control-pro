// Web Worker for reading XLSX files to avoid freezing the main thread
import * as XLSX from "xlsx";

function normalizeText(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
  headerRowIndex: number;
  sheetName: string;
  sheetIndex: number;
  grayCellDossieRowIndices: number[];
}

function scoreHeaderRow(row: any[]): number {
  const keys = [
    "processo",
    "cnj",
    "dossie",
    "dossiê",
    "relator",
    "turma",
    "reclamante",
    "reclamada",
    "equipe",
    "distrib",
    "data",
  ];

  let score = 0;
  for (const cell of row || []) {
    const text = normalizeText(cell);
    if (!text) continue;
    for (const key of keys) {
      if (text.includes(key)) {
        score++;
        break;
      }
    }
  }
  return score;
}

function detectHeaderRow(json: any[][]): number {
  const maxScan = Math.min(json.length, 60);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i++) {
    const row = json[i];
    if (!row || row.every((c: any) => !String(c ?? "").trim())) continue;
    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore >= 2) return bestIdx;

  for (let i = 0; i < Math.min(json.length, 20); i++) {
    const row = json[i];
    if (!row) continue;
    const hasProcesso = row.some((c: any) => normalizeText(c).includes("processo") || normalizeText(c).includes("cnj"));
    if (hasProcesso) return i;
  }

  return 0;
}

function parseWorkbook(data: ArrayBuffer, allSheets: boolean): ParsedSheet[] {
  const wb = XLSX.read(new Uint8Array(data), { type: "array", cellDates: true });
  const sheetNames = allSheets ? wb.SheetNames : [wb.SheetNames[0]];
  const results: ParsedSheet[] = [];

  for (let si = 0; si < sheetNames.length; si++) {
    const sheetName = sheetNames[si];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, rawNumbers: false }) as any[][];

    const headerIdx = detectHeaderRow(json);
    const headers = (json[headerIdx] || []).map((h: any) => String(h || ""));

    // Find dossier column for "não localizado" detection
    const dossieColIdx = headers.findIndex((h: string) => {
      const lower = (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return lower.includes("dossie") || lower.includes("dossiê");
    });

    const grayCellDossieRowIndices: number[] = [];
    const rows: Record<string, any>[] = [];
    let rowCounter = 0;

    for (let i = headerIdx + 1; i < json.length; i++) {
      const row = json[i];
      if (!row || row.every((c: any) => !c && c !== 0)) continue;
      const obj: Record<string, any> = {};
      headers.forEach((h: string, idx: number) => {
        let val = row[idx];
        if (val instanceof Date && !isNaN(val.getTime())) {
          const d = val.getUTCDate().toString().padStart(2, "0");
          const m = (val.getUTCMonth() + 1).toString().padStart(2, "0");
          const y = val.getUTCFullYear();
          val = `${d}/${m}/${y}`;
        }
        obj[h] = val;
      });

      if (dossieColIdx >= 0) {
        const dossieVal = normalizeText(row[dossieColIdx]);
        if (
          dossieVal.includes("nao localizado") ||
          dossieVal.includes("não localizado") ||
          dossieVal.includes("n/localizado") ||
          dossieVal.includes("n/ localizado")
        ) {
          grayCellDossieRowIndices.push(rowCounter);
        }
      }

      rows.push(obj);
      rowCounter++;
    }

    results.push({
      headers,
      rows,
      headerRowIndex: headerIdx,
      sheetName,
      sheetIndex: allSheets ? si : 0,
      grayCellDossieRowIndices,
    });
  }

  return results;
}

self.onmessage = (event: MessageEvent) => {
  const { type, buffer, allSheets, id } = event.data;

  if (type === "parse") {
    try {
      const sheets = parseWorkbook(buffer, allSheets);
      self.postMessage({ type: "result", id, sheets });
    } catch (err: any) {
      self.postMessage({ type: "error", id, error: err?.message || String(err) });
    }
  }
};
