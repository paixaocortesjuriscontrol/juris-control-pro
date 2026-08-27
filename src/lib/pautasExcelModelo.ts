import * as XLSX from "xlsx";

/** Cabeçalhos aceitos pelo importador de Pautas Excel (na ordem do modelo). */
export const PAUTAS_EXCEL_COLUNAS = [
  "DATA",
  "HORA",
  "NÚMERO DO PROCESSO",
  "FORO",
  "VT/ CÂMARA",
  "Local",
  "COMARCA",
  "UF",
  "PÓLO ATIVO",
  "CLIENTE",
  "TERCEIRIZADA",
  "TIPO",
  "TELEPRESENCIAL",
  "OBSERVAÇÕES/ PROVIDÊNCIAS",
];

const EXEMPLOS: (string | number)[][] = [
  [
    "07/07/2026",
    "10:15",
    "0100595-73.2026.5.01.0056",
    "TRT 01ª REGIÃO",
    "56ª VT DO RIO DE JANEIRO",
    "PENDENTE",
    "RIO DE JANEIRO",
    "RJ",
    "NOME DO RECLAMANTE",
    "NOME DO CLIENTE",
    "EMPRESA TERCEIRIZADA LTDA",
    "UNA",
    "PRESENCIAL",
    "Levar prepostos e documentos",
  ],
  [
    "08/07/2026",
    "14:30",
    "0011234-56.2026.5.02.0011",
    "TRT 02ª REGIÃO",
    "11ª VT DE SÃO PAULO",
    "",
    "SÃO PAULO",
    "SP",
    "NOME DO RECLAMANTE",
    "NOME DO CLIENTE",
    "NÃO",
    "INSTRUÇÃO",
    "TELEPRESENCIAL - https://zoom.us/j/000000",
    "",
  ],
];

/** Gera e baixa a planilha modelo de pautas. */
export function baixarModeloPautasExcel() {
  const ws = XLSX.utils.aoa_to_sheet([PAUTAS_EXCEL_COLUNAS, ...EXEMPLOS]);
  ws["!cols"] = PAUTAS_EXCEL_COLUNAS.map((c) => ({ wch: Math.max(12, Math.min(34, c.length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PAUTA");
  XLSX.writeFile(wb, "MODELO_IMPORTACAO_PAUTAS.xlsx");
}
