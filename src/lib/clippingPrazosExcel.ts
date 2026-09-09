/**
 * "Excel Clipping — Controle de Prazos" (modelo PLANILHA_TST.xlsx da Bruna).
 *
 * Aba GERAL: replica o layout E o estilo original (cabeçalho vinho #602826 com
 * texto branco, Calibri 9, bordas finas, células centralizadas com quebra de
 * texto, "Hoje:" em amarelo claro, alturas de linha do modelo).
 * Aba DADOS: todas as informações disponíveis da publicação (inclusive conteúdo
 * integral), para o advogado consultar sem sair da planilha.
 */

import * as XLSX from "xlsx-js-style";

export interface ClippingPub {
  id: string;
  data_publicacao?: string | null;
  data_disponibilizacao?: string | null;
  processo_numero?: string | null;
  tribunal?: string | null;
  orgao?: string | null;
  tipo_comunicacao?: string | null;
  meio?: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
  partes_json?: any;
  advogados_json?: any;
  monitoramento_descricao?: string | null;
  monitoramento_termo?: string | null;
  monitoramento_tipo?: string | null;
  coordenacao_nome?: string | null;
  lida?: boolean | null;
  conteudo?: string | null;
  uf?: string | null;
  [k: string]: any;
}

const MAX_CELULA = 32000;
const cap = (v: any) => {
  const s = String(v ?? "");
  return s.length > MAX_CELULA ? `${s.slice(0, MAX_CELULA)} […texto truncado]` : s;
};

const nomes = (arr: any): string =>
  Array.isArray(arr)
    ? arr.map((x: any) => (typeof x === "string" ? x : x?.nome || x?.name || "")).filter(Boolean).join("; ")
    : "";

const toDate = (v?: string | null): Date | null => {
  if (!v) return null;
  const ymd = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** UF a partir do tribunal (TRT2 → SP, TJSP → SP, TRT10 → DF...). */
const REGIAO_UF: Record<string, string> = {
  "1": "RJ", "2": "SP", "3": "MG", "4": "RS", "5": "BA", "6": "PE", "7": "CE",
  "8": "PA", "9": "PR", "10": "DF", "11": "AM", "12": "SC", "13": "PB",
  "14": "RO", "15": "SP", "16": "MA", "17": "ES", "18": "GO", "19": "AL",
  "20": "SE", "21": "RN", "22": "PI", "23": "MT", "24": "MS",
};

const ufDaPub = (pub: ClippingPub): string => {
  if (pub.uf) return String(pub.uf).toUpperCase();
  const trib = String(pub.tribunal || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const trt = trib.match(/^TRT(\d{1,2})$/);
  if (trt) return REGIAO_UF[String(Number(trt[1]))] || "";
  const tj = trib.match(/^(TJ|TRE)([A-Z]{2})$/);
  if (tj) return tj[2];
  return "";
};

/* ---------------- Estilos extraídos do modelo ---------------- */
const VINHO = "602826";          // accent2 (C0504D) com tint -50%, igual ao modelo
const AMARELO_CLARO = "FFFFE5";  // destaque "Hoje:"
const FONTE = "Calibri";
const TAM = 9;

const borda = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
} as const;

const centro = { horizontal: "center", vertical: "center", wrapText: true } as const;

const estiloTitulo = {
  font: { name: FONTE, sz: TAM, bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: VINHO } },
  alignment: centro,
  border: borda,
};

const estiloCabecalho = estiloTitulo;

const estiloCelula = {
  font: { name: FONTE, sz: TAM, color: { rgb: "000000" } },
  alignment: centro,
  border: borda,
};

const estiloCelulaBold = {
  ...estiloCelula,
  font: { name: FONTE, sz: TAM, bold: true, color: { rgb: "000000" } },
};

const estiloHoje = {
  font: { name: FONTE, sz: TAM, bold: true, color: { rgb: "000000" } },
  fill: { patternType: "solid", fgColor: { rgb: AMARELO_CLARO } },
  alignment: centro,
  border: borda,
};

const estiloRotulo = {
  font: { name: FONTE, sz: TAM, color: { rgb: "000000" } },
  alignment: { horizontal: "right", vertical: "center", wrapText: true },
};

export async function gerarClippingPrazosExcel(
  pubs: ClippingPub[],
  comentariosPorPub: Map<string, Array<{ autor: string; comentario: string; created_at: string }>>,
  filename: string,
) {
  // ---------- Aba GERAL (modelo Clipping) ----------
  const HEADERS = [
    "PUBLICAÇÃO", "PROCESSO", "RECLAMANTE", "PROVIDÊNCIA", "PRAZO (DIAS)",
    "PRAZO FATAL", "STATUS ATUAL", "CLIENTE/     POPULAÇÃO", "UF",
    "RESPONSÁVEL", "OBSERVAÇÃO", "DEP. RECURSAL OU JUDICIAL", "CUSTAS",
  ];

  const aoa: any[][] = [
    [], // 1
    [null, null, "Hoje:", null], // 2
    [], // 3
    [], // 4
    ["CLIPPING - CONTROLE DE PRAZOS"], // 5
    HEADERS, // 6
  ];

  pubs.forEach((pub) => {
    const coms = (comentariosPorPub.get(pub.id) || [])
      .map((c) => `${c.autor}: ${c.comentario}`)
      .join(" | ");
    const observacao = [pub.tribunal, pub.orgao, coms].filter(Boolean).join(" — ");
    aoa.push([
      toDate(pub.data_disponibilizacao || pub.data_publicacao),
      cap(pub.processo_numero || ""),
      cap(pub.polo_ativo || nomes(pub.partes_json)),
      cap(pub.tipo_comunicacao || ""),
      null, // PRAZO (DIAS) — preenchido pelo advogado
      null, // PRAZO FATAL — fórmula
      null, // STATUS ATUAL — fórmula
      cap(pub.monitoramento_descricao || pub.monitoramento_termo || ""),
      ufDaPub(pub),
      cap(pub.coordenacao_nome || ""),
      cap(observacao),
      null,
      null,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const enc = XLSX.utils.encode_cell;

  // Título (linha 5) e cabeçalho (linha 6) com o vinho do modelo
  for (let c = 0; c <= 12; c++) {
    const tit = enc({ r: 4, c });
    if (!ws[tit]) ws[tit] = { t: "z" };
    ws[tit].s = estiloTitulo;
    const cab = enc({ r: 5, c });
    if (!ws[cab]) ws[cab] = { t: "s", v: "" };
    ws[cab].s = estiloCabecalho;
  }

  // "Hoje:" + data/dia da semana
  const rotulo = ws[enc({ r: 1, c: 2 })];
  if (rotulo) rotulo.s = estiloRotulo;
  ws[enc({ r: 1, c: 3 })] = { t: "n", f: "TODAY()", z: "dd/mm/yyyy", s: estiloHoje };
  ws[enc({ r: 2, c: 3 })] = { t: "n", f: "WEEKDAY(D2,1)", z: "dddd", s: estiloHoje };

  pubs.forEach((_, i) => {
    const linha = 7 + i; // 1-indexado
    const r = linha - 1;
    const dataCel = ws[enc({ r, c: 0 })];
    if (dataCel) dataCel.z = "dd/mm/yyyy";
    ws[enc({ r, c: 5 })] = { t: "n", f: `WORKDAY(A${linha},E${linha},)`, z: "dd/mm/yyyy", s: estiloCelula };
    ws[enc({ r, c: 6 })] = {
      t: "s",
      v: "",
      f: `IF(F${linha}=GERAL!$D$2,"VENCE HOJE",IF(F${linha}<GERAL!$D$2,"VENCIDO","NO PRAZO"))`,
      s: estiloCelulaBold,
    };
    for (let c = 0; c <= 12; c++) {
      if (c === 5 || c === 6) continue;
      const ref = enc({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = estiloCelula;
    }
  });

  ws["!cols"] = [
    { wch: 10 }, { wch: 25 }, { wch: 29 }, { wch: 31 }, { wch: 6 }, { wch: 10 },
    { wch: 12 }, { wch: 16 }, { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
  ];
  ws["!rows"] = [
    { hpt: 13.5 }, { hpt: 18 }, { hpt: 20.25 }, { hpt: 10.5 }, { hpt: 17.25 }, { hpt: 28.2 },
    ...pubs.map(() => ({ hpt: 24.6 })),
  ];
  ws["!merges"] = [
    { s: { r: 1, c: 3 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } },
  ];
  ws["!autofilter"] = { ref: `A6:M${6 + Math.max(pubs.length, 1)}` };

  // ---------- Aba DADOS (máximo de informações) ----------
  const fmt = (v?: string | null) => {
    const d = toDate(v);
    if (!d) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  const dados = pubs.map((pub, idx) => {
    const conteudo = String(pub.conteudo || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      "#": idx + 1,
      "Data publicação": fmt(pub.data_publicacao),
      "Data disponibilização": fmt(pub.data_disponibilizacao),
      "Nº do processo": cap(pub.processo_numero || ""),
      Tribunal: cap(pub.tribunal || ""),
      UF: ufDaPub(pub),
      "Órgão / Vara": cap(pub.orgao || ""),
      "Tipo de comunicação": cap(pub.tipo_comunicacao || ""),
      Meio: cap(pub.meio || ""),
      "Polo ativo": cap(pub.polo_ativo || nomes(pub.partes_json)),
      "Polo passivo": cap(pub.polo_passivo || ""),
      Advogados: cap(nomes(pub.advogados_json)),
      Monitoramento: cap(pub.monitoramento_descricao || pub.monitoramento_termo || ""),
      "Tipo do monitoramento": cap(pub.monitoramento_tipo || ""),
      Coordenação: cap(pub.coordenacao_nome || ""),
      Lida: pub.lida ? "Sim" : "Não",
      Comentários: cap(
        (comentariosPorPub.get(pub.id) || []).map((c) => `${c.autor}: ${c.comentario}`).join(" | "),
      ),
      "Conteúdo integral": cap(conteudo),
    };
  });

  const wsDados = XLSX.utils.json_to_sheet(dados);
  wsDados["!cols"] = [
    { wch: 5 }, { wch: 14 }, { wch: 18 }, { wch: 26 }, { wch: 12 }, { wch: 5 },
    { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 34 }, { wch: 34 }, { wch: 34 },
    { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 8 }, { wch: 40 }, { wch: 120 },
  ];

  const estiloDados = {
    font: { name: FONTE, sz: TAM, color: { rgb: "000000" } },
    alignment: { vertical: "top", wrapText: true },
    border: borda,
  };
  const totalCols = 18;
  for (let c = 0; c < totalCols; c++) {
    const cab = enc({ r: 0, c });
    if (wsDados[cab]) wsDados[cab].s = estiloCabecalho;
    for (let r = 1; r <= dados.length; r++) {
      const ref = enc({ r, c });
      if (!wsDados[ref]) wsDados[ref] = { t: "s", v: "" };
      wsDados[ref].s = estiloDados;
    }
  }
  wsDados["!rows"] = [{ hpt: 28.2 }, ...dados.map(() => ({ hpt: 24.6 }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "GERAL");
  XLSX.utils.book_append_sheet(wb, wsDados, "DADOS");
  XLSX.writeFile(wb, filename);
}
