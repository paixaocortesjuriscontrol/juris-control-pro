import * as XLSX from "xlsx";

function normalizeText(val: unknown): string {
  return String(val ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
  headerRowIndex: number;
  sheetName: string;
  sheetIndex: number;
}

function scoreHeaderRow(row: any[], keys: string[]): number {
  let score = 0;
  for (const cell of row || []) {
    const text = normalizeText(cell);
    if (!text) continue;
    for (const key of keys) {
      if (text.includes(key)) { score++; break; }
    }
  }
  return score;
}

function detectHeaderRow(json: any[][], keys: string[]): number {
  const maxScan = Math.min(json.length, 60);
  let bestIdx = 0, bestScore = -1;
  for (let i = 0; i < maxScan; i++) {
    const row = json[i];
    if (!row || row.every((c: any) => !String(c ?? "").trim())) continue;
    const score = scoreHeaderRow(row, keys);
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestScore >= 2 ? bestIdx : 0;
}

function formatDate(val: any): string {
  if (val instanceof Date && !isNaN(val.getTime())) {
    const d = val.getUTCDate().toString().padStart(2, "0");
    const m = (val.getUTCMonth() + 1).toString().padStart(2, "0");
    const y = val.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }
  return String(val ?? "");
}

function parseWorkbook(data: ArrayBuffer, allSheets: boolean, keys: string[]): ParsedSheet[] {
  const wb = XLSX.read(new Uint8Array(data), { type: "array", cellDates: true });
  const sheetNames = allSheets ? wb.SheetNames : [wb.SheetNames[0]];
  const results: ParsedSheet[] = [];

  for (let si = 0; si < sheetNames.length; si++) {
    const ws = wb.Sheets[sheetNames[si]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, rawNumbers: false, defval: "", blankrows: false }) as any[][];
    const headerIdx = detectHeaderRow(json, keys);
    const headers = (json[headerIdx] || []).map((h: any) => String(h || ""));
    const rows: Record<string, any>[] = [];

    for (let i = headerIdx + 1; i < json.length; i++) {
      const row = json[i];
      if (!row || row.every((c: any) => !c && c !== 0)) continue;
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => { obj[h] = formatDate(row[idx]); });
      // positional columns
      for (let ci = 0; ci < Math.min(row.length, 30); ci++) {
        obj[`__col${ci}`] = formatDate(row[ci]);
      }
      rows.push(obj);
    }

    results.push({ headers, rows, headerRowIndex: headerIdx, sheetName: sheetNames[si], sheetIndex: si });
  }
  return results;
}

self.onmessage = (event: MessageEvent) => {
  const { type, buffer, allSheets, keys, id, inputType } = event.data;
  if (type === "parse") {
    try {
      const sheets = parseWorkbook(buffer, allSheets, keys || ["processo", "dossie", "dossiê", "relator", "turma", "recurso", "julgamento", "pauta"]);
      self.postMessage({ type: "result", id, sheets, inputType });
    } catch (err: any) {
      self.postMessage({ type: "error", id, error: err?.message || String(err), inputType });
    }
  }
};
