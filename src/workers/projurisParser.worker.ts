import * as XLSX from "xlsx";

type IncomingMessage = {
  arrayBuffer: ArrayBuffer;
};

type OutgoingMessage =
  | { type: "progress"; progress: number }
  | { type: "result"; rows: any[] }
  | { type: "error"; message: string };

const ctx = self as any;

function post(message: OutgoingMessage) {
  ctx.postMessage(message);
}

function safeString(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

ctx.onmessage = (ev: MessageEvent<IncomingMessage>) => {
  try {
    const { arrayBuffer } = ev.data;

    post({ type: "progress", progress: 5 });

    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    post({ type: "progress", progress: 25 });

    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) throw new Error("Planilha sem abas (SheetNames vazio)");

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error("Aba principal não encontrada");

    post({ type: "progress", progress: 40 });

    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      range: 2, // começa na linha 3 (índice 2) para pular cabeçalhos do Projuris
    });

    post({ type: "progress", progress: 80 });

    const rows = (jsonData as any[]).filter((row) => {
      const numeroCNJ = safeString(row?.["Número CNJ"] || row?.["Numero CNJ"]);
      const trimmed = numeroCNJ.trim();
      return trimmed.length >= 5 && !trimmed.includes("Número CNJ") && !trimmed.includes("Numero CNJ");
    });

    post({ type: "progress", progress: 100 });
    post({ type: "result", rows });
  } catch (err: any) {
    post({ type: "error", message: err?.message ? String(err.message) : String(err) });
  }
};
