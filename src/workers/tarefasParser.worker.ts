// Web Worker for parsing Projuris task spreadsheets (Excel/CSV)

type IncomingMessage = {
  arrayBuffer: ArrayBuffer;
  fileType: "xlsx" | "csv";
};

type OutgoingMessage =
  | { type: "progress"; progress: number }
  | { type: "result"; rows: any[]; headers: string[] }
  | { type: "error"; message: string };

const ctx = self as any;

function post(message: OutgoingMessage) {
  ctx.postMessage(message);
}

function safeString(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// Parse CSV content
function parseCSV(text: string, delimiter: string = ";"): { headers: string[]; rows: any[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    rows.push(row);
  }

  return { headers, rows };
}

ctx.onmessage = async (ev: MessageEvent<IncomingMessage>) => {
  try {
    const { arrayBuffer, fileType } = ev.data;
    post({ type: "progress", progress: 5 });

    let headers: string[] = [];
    let rows: any[] = [];

    if (fileType === "csv") {
      // Decode CSV with proper encoding
      const decoder = new TextDecoder("utf-8");
      let text = decoder.decode(arrayBuffer);
      
      // Try latin1 if UTF-8 shows garbled characters
      if (text.includes("�")) {
        const latin1Decoder = new TextDecoder("iso-8859-1");
        text = latin1Decoder.decode(arrayBuffer);
      }

      post({ type: "progress", progress: 30 });
      
      const parsed = parseCSV(text, ";");
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      // Excel parsing using xlsx library (imported dynamically)
      // Note: xlsx library must be available in the worker context
      const XLSX = await import("xlsx");
      
      post({ type: "progress", progress: 20 });
      
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames?.[0];
      
      if (!sheetName) throw new Error("Planilha sem abas");
      
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) throw new Error("Aba principal não encontrada");
      
      post({ type: "progress", progress: 40 });
      
      // Skip first 2 rows (Projuris header pattern)
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 2 });
      
      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0] as object);
        rows = jsonData as any[];
      }
    }

    post({ type: "progress", progress: 70 });

    // Filter out empty rows (rows without identifier)
    const validRows = rows.filter((row) => {
      const id = safeString(row["Identificador da tarefa"]);
      return id.length > 0 && id !== "Identificador da tarefa";
    });

    post({ type: "progress", progress: 100 });
    post({ type: "result", rows: validRows, headers });
  } catch (err: any) {
    post({ type: "error", message: err?.message ? String(err.message) : String(err) });
  }
};
