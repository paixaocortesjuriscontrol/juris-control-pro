import * as XLSX from "xlsx";

export type CampoMapa =
  | "id_externo" | "processo" | "titulo" | "tipo" | "data_vencimento" | "data_fatal"
  | "hora" | "responsavel" | "situacao" | "observacoes";

export const CAMPOS: { campo: CampoMapa; label: string; obrigatorio?: boolean; pistas: string[] }[] = [
  { campo: "id_externo", label: "Identificador da tarefa (Projuris)", obrigatorio: true, pistas: ["identificador da tarefa", "id tarefa", "identificador", "codigo"] },
  { campo: "processo", label: "Número do processo (CNJ)", pistas: ["numero cnj", "cnj", "numero do processo", "processo"] },
  { campo: "titulo", label: "Título / descrição", obrigatorio: true, pistas: ["titulo", "assunto", "descricao da tarefa", "tarefa", "descricao"] },
  { campo: "tipo", label: "Tipo (se houver)", pistas: ["tipo da tarefa", "tipo de tarefa", "tipo", "categoria"] },
  { campo: "data_vencimento", label: "Data prevista / vencimento", obrigatorio: true, pistas: ["data prevista", "data de vencimento", "vencimento", "data limite", "data da tarefa", "data"] },
  { campo: "data_fatal", label: "Data fatal", pistas: ["data fatal", "prazo fatal", "fatal"] },
  { campo: "hora", label: "Hora", pistas: ["hora", "horario"] },
  { campo: "responsavel", label: "Responsável", pistas: ["responsavel", "executor", "usuario responsavel"] },
  { campo: "situacao", label: "Situação", pistas: ["situacao", "status"] },
  { campo: "observacoes", label: "Observações", pistas: ["observacao", "observacoes", "comentario", "detalhes"] },
];

export const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export function formatarCnj(d: string) {
  if (d.length !== 20) return d;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

export interface Planilha { arquivo: string; aba: string; headers: string[]; linhas: Record<string, any>[] }

/** Lê todas as abas; detecta a linha de cabeçalho nas primeiras 15 linhas. */
export async function lerPlanilha(file: File): Promise<Planilha[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const out: Planilha[] = [];
  for (const aba of wb.SheetNames) {
    const ws = wb.Sheets[aba];
    const matriz = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: true });
    if (!matriz.length) continue;
    let idx = 0, melhor = -1;
    for (let i = 0; i < Math.min(15, matriz.length); i++) {
      const linha = matriz[i].map(norm);
      const pontos = CAMPOS.reduce((acc, c) => acc + (linha.some((h) => c.pistas.some((p) => h === p || h.includes(p))) ? 1 : 0), 0);
      if (pontos > melhor) { melhor = pontos; idx = i; }
    }
    const headers = matriz[idx].map((h: any, i: number) => String(h || `Coluna ${i + 1}`).trim());
    const linhas = matriz.slice(idx + 1)
      .filter((r) => r.some((v: any) => String(v ?? "").trim() !== ""))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
    if (linhas.length) out.push({ arquivo: file.name, aba, headers, linhas });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  return out;
}

export function mapearAutomatico(headers: string[]): Partial<Record<CampoMapa, string>> {
  const usados = new Set<string>();
  const mapa: Partial<Record<CampoMapa, string>> = {};
  for (const c of CAMPOS) {
    for (const p of c.pistas) {
      const h = headers.find((x) => !usados.has(x) && norm(x) === p)
        ?? headers.find((x) => !usados.has(x) && norm(x).includes(p));
      if (h) { mapa[c.campo] = h; usados.add(h); break; }
    }
  }
  return mapa;
}

export function paraData(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function paraHora(v: any): string | null {
  if (v instanceof Date) return `${String(v.getHours()).padStart(2, "0")}:${String(v.getMinutes()).padStart(2, "0")}`;
  const m = String(v ?? "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** Classifica o tipo pelo título (o Projuris não grava o tipo). */
export function classificarTipo(titulo: string, tipoOrigem?: string): string {
  const t = norm(`${tipoOrigem || ""} ${titulo}`);
  if (/\baudiencia\b|\bpauta\b|\bjulgamento\b|\bsessao\b/.test(t) && !/prepar/.test(t)) return "AUDIÊNCIA";
  if (/prepar.*audiencia/.test(t)) return "PREPARAÇÃO AUDIÊNCIA";
  if (/contrarraz/.test(t)) return "CONTRARRAZÕES";
  if (/recurso|apelac|agravo|embargos/.test(t)) return "RECURSO";
  if (/contestac|defesa/.test(t)) return "DEFESA";
  if (/manifest|impugna|replica|memoriais|alegac/.test(t)) return "MANIFESTAÇÃO";
  if (/protocol/.test(t)) return "PROTOCOLO";
  if (/diligenc/.test(t)) return "DILIGÊNCIA";
  if (/peticao|peticionar/.test(t)) return "PETIÇÃO";
  if (/analis|verificar|verificac|conferir/.test(t)) return "ANÁLISE";
  if (/solicit.*doc|documento/.test(t)) return "SOLICITAÇÃO DE DOCS";
  if (/intimac/.test(t)) return "INTIMAÇÃO";
  if (/prazo|\d+\s*d\b|dias/.test(t)) return "PRAZO";
  return "PRAZO";
}

export function mapearSituacao(v: any, data: string | null): string {
  const s = norm(v);
  if (/cancel/.test(s)) return "cancelado";
  if (/conclu|cumpr|finaliz|realiz|encerr|feito/.test(s)) return "cumprido";
  if (/andamento|execuc/.test(s)) return "em_execucao";
  const hoje = new Date().toISOString().slice(0, 10);
  if (data && data < hoje) return "cumprido"; // vencidas sem situação = cumpridas
  return "pendente";
}

export const sanitizarNome = (n: string) =>
  n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
