import * as XLSX from "xlsx";

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  try {
    const wb = XLSX.read(e.data, { type: "array", cellDates: true });
    const ws = wb.Sheets["Processos"] ?? wb.Sheets[wb.SheetNames[0]];
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    const idx = matriz.findIndex((r) => r.some((c) => String(c).trim() === "Identificador"));
    if (idx < 0) throw new Error("Cabeçalho 'Identificador' não encontrado na planilha.");
    const cab = matriz[idx].map((c) => String(c).trim());
    const linhas = matriz.slice(idx + 1)
      .filter((r) => r.some((c) => String(c).trim()))
      .map((r) => Object.fromEntries(cab.map((c, i) => [c, r[i] ?? ""]).filter(([c]) => c)));
    (self as any).postMessage({ ok: true, linhas });
  } catch (err) {
    (self as any).postMessage({ ok: false, erro: err instanceof Error ? err.message : String(err) });
  }
};
