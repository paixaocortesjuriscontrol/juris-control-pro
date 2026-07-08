import * as XLSX from "xlsx";

export interface ProcessoBusca {
  processo_original: string;
  processo_digitos: string;
  valido: boolean;
}

const PROC_HEADERS = [
  "processo", "numero do processo", "numero processo", "n processo", "nº processo",
  "cnj", "numero cnj", "número do processo", "número processo", "n° processo",
];

const normalizeHeader = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function parsePlanilhaProcessos(file: File): Promise<ProcessoBusca[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: false });

  const out = new Map<string, ProcessoBusca>();
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    // Tenta cabeçalho na linha 1 e 3 (planilhas Projuris)
    const rows1 = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false });
    const rows3 = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false, range: 2 });
    const candidates: any[][] = [rows1, rows3];

    for (const rows of candidates) {
      if (!rows || rows.length === 0) continue;
      const headers = Object.keys(rows[0]);
      const procKey = headers.find((h) => PROC_HEADERS.includes(normalizeHeader(h)));
      if (!procKey) {
        // Fallback: se só há uma coluna, usa ela
        if (headers.length === 1) {
          for (const r of rows) coletar(r[headers[0]], out);
        }
        continue;
      }
      for (const r of rows) coletar(r[procKey], out);
      break;
    }
  }
  return Array.from(out.values());
}

function coletar(v: unknown, out: Map<string, ProcessoBusca>) {
  const original = String(v ?? "").trim();
  if (!original) return;
  const digitos = original.replace(/\D/g, "");
  if (!digitos) return;
  if (out.has(digitos)) return;
  out.set(digitos, {
    processo_original: original,
    processo_digitos: digitos,
    valido: digitos.length === 20,
  });
}

// ----- Relatório -----

export interface ResultadoBusca {
  processo_digitos: string;
  processo_original: string;
  tribunal: string | null;
  data_disponibilizacao: string | null; // ISO
  data_publicacao: string | null;       // YYYY-MM-DD
  orgao: string | null;
  tipo_comunicacao: string | null;
  conteudo: string | null;
}

const fmtDate = (iso: string | null): string => {
  if (!iso) return "";
  const ymd = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
};

export function gerarRelatorioBuscaPublicacao(
  processos: ProcessoBusca[],
  resultados: ResultadoBusca[],
): Blob {
  // Agrupa por processo
  const porProcesso = new Map<string, ResultadoBusca[]>();
  for (const r of resultados) {
    const arr = porProcesso.get(r.processo_digitos) || [];
    arr.push(r);
    porProcesso.set(r.processo_digitos, arr);
  }

  // Aba Resumo
  const resumo: any[] = [];
  for (const p of processos) {
    const rs = (porProcesso.get(p.processo_digitos) || []).slice().sort((a, b) =>
      String(a.data_disponibilizacao || "").localeCompare(String(b.data_disponibilizacao || ""))
    );
    const datas = Array.from(new Set(rs.map((r) => fmtDate(r.data_disponibilizacao)).filter(Boolean)));
    const tribunais = Array.from(new Set(rs.map((r) => String(r.tribunal || "").toUpperCase()).filter(Boolean)));
    resumo.push({
      "Processo": p.processo_original,
      "Processo (só dígitos)": p.processo_digitos,
      "Válido CNJ": p.valido ? "Sim" : "Não",
      "Qtd Publicações": rs.length,
      "1ª Data": datas[0] || "",
      "Última Data": datas[datas.length - 1] || "",
      "Datas Encontradas": datas.join("; "),
      "Tribunais": tribunais.join("; "),
    });
  }

  // Aba Detalhe
  const detalhe = resultados
    .slice()
    .sort((a, b) => {
      const p = a.processo_digitos.localeCompare(b.processo_digitos);
      if (p !== 0) return p;
      return String(a.data_disponibilizacao || "").localeCompare(String(b.data_disponibilizacao || ""));
    })
    .map((r) => ({
      "Processo": r.processo_original || r.processo_digitos,
      "Data Disponibilização": fmtDate(r.data_disponibilizacao),
      "Data Publicação": fmtDate(r.data_publicacao),
      "Tribunal": String(r.tribunal || "").toUpperCase(),
      "Órgão": r.orgao || "",
      "Tipo Comunicação": r.tipo_comunicacao || "",
      "Conteúdo": (r.conteudo || "").slice(0, 32000),
    }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(resumo);
  const ws2 = XLSX.utils.json_to_sheet(detalhe);
  XLSX.utils.book_append_sheet(wb, ws1, "Resumo");
  XLSX.utils.book_append_sheet(wb, ws2, "Detalhe");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}