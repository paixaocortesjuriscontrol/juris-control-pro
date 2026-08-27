import * as XLSX from "xlsx";
import { formatProcessoNumero } from "@/lib/utils";

export interface PautaExcelRow {
  linha: number; // 1-based na planilha
  data_iso: string; // YYYY-MM-DD
  hora: string; // HH:MM
  processo_numero: string; // mascarado
  processo_digits: string; // 20 dígitos
  foro: string;
  vara_camara: string;
  local: string;
  comarca: string;
  uf: string;
  polo_ativo: string;
  cliente: string;
  terceirizada: string | null;
  tipo: string;
  modalidade: "Presencial" | "Virtual" | "";
  link_reuniao: string;
  observacoes: string;
  raw_telepresencial: string;
}

export interface PautaExcelParseError {
  linha: number;
  motivo: string;
  processo?: string;
}

export interface PautaExcelParseResult {
  linhas: PautaExcelRow[];
  erros: PautaExcelParseError[];
}

function s(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toString();
  return String(v).trim();
}

function normHeader(v: any): string {
  return s(v)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function parseDate(v: any): string {
  if (!v && v !== 0) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const str = s(v);
  // dd/mm/yyyy
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // yyyy-mm-dd
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return "";
}

function parseTime(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) {
    const h = String(v.getHours()).padStart(2, "0");
    const m = String(v.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof v === "number") {
    // Excel time fraction
    const total = Math.round(v * 24 * 60);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const str = s(v);
  const m1 = str.match(/^(\d{1,2}):(\d{2})/);
  if (m1) return `${m1[1].padStart(2, "0")}:${m1[2]}`;
  return "";
}

function extractUrl(text: string): string {
  const m = text.match(/https?:\/\/\S+/i);
  return m ? m[0] : "";
}

/**
 * Lê uma planilha de pautas (formato EQUIPE_..._PAUTA_...).
 * Aceita cabeçalhos: DATA, HORA, NUMERO DO PROCESSO, FORO, VT/CAMARA,
 * LOCAL, COMARCA, UF, POLO ATIVO, CLIENTE, TERCEIRIZADA, TIPO,
 * TELEPRESENCIAL, OBSERVAÇÕES/PROVIDÊNCIAS.
 */
export function parsePautaExcel(arrayBuffer: ArrayBuffer): PautaExcelParseResult {
  const wb = XLSX.read(arrayBuffer, { cellDates: true, cellNF: false });
  const erros: PautaExcelParseError[] = [];
  const linhas: PautaExcelRow[] = [];
  const vistos = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const parcial = parsePautaSheet(ws);
    for (const l of parcial.linhas) {
      const chave = `${l.processo_digits}|${l.data_iso}|${l.hora}|${l.tipo}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      linhas.push(l);
    }
    // Só reporta erros de abas que realmente parecem pautas (têm linhas válidas
    // ou cabeçalho reconhecido), evitando ruído de abas auxiliares.
    if (parcial.linhas.length > 0) erros.push(...parcial.erros);
  }

  return { linhas, erros };
}

function parsePautaSheet(ws: XLSX.WorkSheet): PautaExcelParseResult {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: true,
  });

  const erros: PautaExcelParseError[] = [];
  const linhas: PautaExcelRow[] = [];

  if (rows.length === 0) return { linhas, erros };

  // Localizar linha do cabeçalho (procura por "NUMERO DO PROCESSO" nas primeiras linhas)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const norm = (rows[i] || []).map(normHeader);
    if (
      norm.some((c) =>
        ["NUMERODOPROCESSO", "NDOPROCESSO", "NUMEROPROCESSO", "NUMERODOPROC", "PROCESSO"].includes(c),
      )
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { linhas, erros };


  const header = (rows[headerIdx] || []).map(normHeader);
  const idx = (aliases: string[]) => header.findIndex((h) => aliases.includes(h));

  const iData = idx(["DATA", "DATAAUDIENCIA", "DATADAAUDIENCIA"]);
  const iHora = idx(["HORA", "HORARIO", "HORAAUDIENCIA"]);
  const iProc = idx(["NUMERODOPROCESSO", "NDOPROCESSO", "NUMEROPROCESSO", "NUMERODOPROC", "PROCESSO"]);
  const iForo = idx(["FORO", "TRIBUNAL", "TRT"]);
  const iVara = idx(["VTCAMARA", "VTCAMARATURMA", "VARACAMARA", "VARA", "ORGAOJULGADOR"]);
  const iLocal = idx(["LOCAL", "ENDERECO", "LOCALAUDIENCIA"]);
  const iComarca = idx(["COMARCA", "CIDADE"]);
  const iUf = idx(["UF", "ESTADO"]);
  const iPolo = idx(["POLOATIVO", "RECLAMANTE", "PARTECONTRARIA", "AUTOR"]);
  const iCliente = idx(["CLIENTE", "RECLAMADA", "POLOPASSIVO"]);
  const iTerc = idx(["TERCEIRIZADA", "TERCEIRIZADO"]);
  const iTipo = idx(["TIPO", "TIPODEAUDIENCIA", "TIPOAUDIENCIA"]);
  const iTele = idx(["TELEPRESENCIAL", "MODALIDADE", "VIRTUAL"]);
  const iObs = idx([
    "OBSERVACOESPROVIDENCIAS",
    "OBSERVACOESPROVIDENCIA",
    "OBSERVACOES",
    "OBSERVACAO",
    "PROVIDENCIAS",
    "OBS",
  ]);


  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    // pular linhas totalmente vazias
    if (row.every((c) => s(c) === "")) continue;

    const linhaExcel = r + 1;
    const procRaw = s(row[iProc]);
    const dataRaw = row[iData];
    const horaRaw = row[iHora];

    const procDigits = procRaw.replace(/\D/g, "");
    const dataIso = parseDate(dataRaw);
    const hora = parseTime(horaRaw);

    if (!procDigits) {
      erros.push({ linha: linhaExcel, motivo: "Número do processo ausente" });
      continue;
    }
    if (procDigits.length !== 20) {
      erros.push({
        linha: linhaExcel,
        motivo: `Número do processo inválido (${procDigits.length} dígitos)`,
        processo: procRaw,
      });
      continue;
    }
    if (!dataIso) {
      erros.push({ linha: linhaExcel, motivo: "Data ausente/ inválida", processo: procRaw });
      continue;
    }

    const teleRaw = s(row[iTele]).toUpperCase();
    let modalidade: "Presencial" | "Virtual" | "" = "";
    let linkReuniao = "";
    if (teleRaw.includes("PRESENCIAL") && !teleRaw.includes("TELE")) {
      modalidade = "Presencial";
    } else if (teleRaw.includes("TELE") || teleRaw.includes("VIRTUAL") || teleRaw.includes("ZOOM") || teleRaw.includes("HTTP")) {
      modalidade = "Virtual";
      linkReuniao = extractUrl(s(row[iTele])) || "";
    }

    const localRaw = s(row[iLocal]);
    const localFinal =
      /^(PENDENTE|TELEPRESENCIAL)$/i.test(localRaw) ? "" : localRaw;

    const tercRaw = s(row[iTerc]);
    const terceirizada = /^(N[ÃA]O|NAO|-|N\/A)$/i.test(tercRaw) ? null : tercRaw || null;

    const obsRaw = s(row[iObs]);
    const observacoes = [obsRaw, linkReuniao && `Link: ${linkReuniao}`]
      .filter(Boolean)
      .join("\n\n");

    linhas.push({
      linha: linhaExcel,
      data_iso: dataIso,
      hora,
      processo_numero: formatProcessoNumero(procDigits),
      processo_digits: procDigits,
      foro: s(row[iForo]),
      vara_camara: s(row[iVara]),
      local: localFinal,
      comarca: s(row[iComarca]),
      uf: s(row[iUf]).toUpperCase().slice(0, 2),
      polo_ativo: s(row[iPolo]),
      cliente: s(row[iCliente]),
      terceirizada: terceirizada as string | null,
      tipo: s(row[iTipo]),
      modalidade,
      link_reuniao: linkReuniao,
      observacoes,
      raw_telepresencial: s(row[iTele]),
    });
  }

  return { linhas, erros };
}