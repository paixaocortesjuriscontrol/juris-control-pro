import { normalizarRitoProcessual } from "./ritoProcessual";

export const semAcento = (s: string) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/** Coordenações que podem usar o envio em lote. */
export function coordenacaoPermiteLote(nome: string | null | undefined): boolean {
  const n = semAcento(nome || "");
  return /SANTANDER (CIVEL|CIVIL|TRABALHISTA)/.test(n);
}

const MAPA: Record<string, string> = {
  "TIPO": "tipo_processo", "NUMERO DO PROCESSO": "numero", "RESPONSAVEL": "_responsavel",
  "SISTEMA": "sistema", "SITUACAO": "_situacao", "AREA": "area", "COORDENCAO RESPONSAVEL": "_coordenacao",
  "COORDENACAO RESPONSAVEL": "_coordenacao", "TRIBUNAL": "tribunal", "JUSTICA": "justica",
  "INSTANCIA": "instancia", "ORGAO JULGADOR": "orgao_julgador", "RITO PROCESSUAL": "rito_processual",
  "COMARCA": "comarca", "UF": "uf", "CLIENTE (CADASTRO)": "_cliente", "CLIENTE": "_cliente",
  "PLO ATIVO (RECLAMANTE/AUTOR)": "polo_ativo", "POLO ATIVO (RECLAMANTE/AUTOR)": "polo_ativo",
  "POLO PASSIVO (RECLAMADO/REU)": "polo_passivo", "VALOR DA CAUSA": "valor_causa", "PASTA DO CLIENTE": "pasta_cliente",
};

export type LinhaLote = { linha: number; campos: Record<string, any>; erro?: string };

export function formatarCnj(v: any): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 20) return null;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

function valorNumero(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Converte linhas (1ª = cabeçalho) da planilha modelo em campos de processo. */
export function lerLinhasLote(linhas: any[][], coordenacaoNome: string): LinhaLote[] {
  const [cab = [], ...dados] = linhas;
  const cols = cab.map((c) => MAPA[semAcento(c)] || null);
  const out: LinhaLote[] = [];
  dados.forEach((row, i) => {
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) return;
    const campos: Record<string, any> = {};
    cols.forEach((k, j) => {
      const v = row[j];
      if (!k || v === null || v === undefined || String(v).trim() === "") return;
      campos[k] = typeof v === "string" ? v.trim() : v;
    });
    const item: LinhaLote = { linha: i + 2, campos };
    const cnj = formatarCnj(campos.numero);
    if (!cnj) item.erro = "Número do processo inválido";
    else campos.numero = cnj;
    if (campos.valor_causa !== undefined) campos.valor_causa = valorNumero(campos.valor_causa);
    if (campos.rito_processual) campos.rito_processual = normalizarRitoProcessual(String(campos.rito_processual));
    if (!item.erro && campos._coordenacao && semAcento(campos._coordenacao).replace(/^COORDENACAO /, "") !== semAcento(coordenacaoNome).replace(/^COORDENACAO /, ""))
      item.erro = `Coordenação diferente (${campos._coordenacao})`;
    out.push(item);
  });
  return out;
}
