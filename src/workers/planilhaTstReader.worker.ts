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

function parseWorkbook(data: ArrayBuffer, allSheets: boolean): ParsedSheet[] {
  const wb = XLSX.read(new Uint8Array(data), { type: "array", cellDates: true });
  const sheetNames = allSheets ? wb.SheetNames : [wb.SheetNames[0]];
  const results: ParsedSheet[] = [];

  for (let si = 0; si < sheetNames.length; si++) {
    const sheetName = sheetNames[si];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, rawNumbers: false }) as any[][];

    let headerIdx = 0;
    for (let i = 0; i < Math.min(json.length, 10); i++) {
      const row = json[i];
      if (row && row.some((c: any) => c && String(c).toLowerCase().includes("processo"))) {
        headerIdx = i;
        break;
      }
    }

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
          const d = val.getDate().toString().padStart(2, "0");
          const m = (val.getMonth() + 1).toString().padStart(2, "0");
          const y = val.getFullYear();
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
