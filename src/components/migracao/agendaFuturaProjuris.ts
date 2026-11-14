import { norm, classificarTipo } from "@/lib/migracaoProjuris";

/** Títulos que o advogado definiu como audiência; nenhum outro título vira audiência. */
export const TITULOS_AUDIENCIA = ["AC", "AC PRESENCIAL", "UNA", "UNA PRESENCIAL", "AIJ", "AIJ PRESENCIAL", "SESSÃO DE JULGAMENTO"];
const AUD = new Set(TITULOS_AUDIENCIA.map(norm));

export const ehAudiencia = (titulo: unknown) => AUD.has(norm(titulo));

/** Divide campos do Projuris separados por "|", sem vazios e sem repetir textos iguais. */
export function dividirPipe(v: unknown): string[] {
  const vistos = new Set<string>(); const out: string[] = [];
  for (const p of String(v ?? "").split("|")) {
    const t = p.trim(); const k = norm(t);
    if (t && !vistos.has(k)) { vistos.add(k); out.push(t); }
  }
  return out;
}

/** Situação da planilha Agenda Futura → situação da tarefa no sistema. */
export function statusTarefa(v: unknown): string {
  const s = norm(v);
  if (/sem sucesso/.test(s)) return "concluido_sem_sucesso";
  if (/cancel/.test(s)) return "cancelado";
  if (/conclu/.test(s)) return "cumprido";
  if (/execuc/.test(s)) return "em_execucao";
  if (/confirmar/.test(s)) return "a_confirmar";
  if (/revis/.test(s)) return "revisao";
  return "pendente";
}

/** Situação da planilha → situação da audiência no sistema. */
export function statusAudiencia(v: unknown): string {
  const s = norm(v);
  if (/sem sucesso/.test(s)) return "concluido_sem_sucesso";
  if (/cancel/.test(s)) return "cancelado";
  if (/conclu/.test(s)) return "concluido";
  if (/revis/.test(s)) return "revisao";
  return "pendente";
}

/** Tipo do item: audiência só pela lista; demais pela regra já usada no Projuris. */
export function tipoItem(titulo: string): { audiencia: boolean; tipo: string; registro: "prazo" | "tarefa" } {
  if (ehAudiencia(titulo)) return { audiencia: true, tipo: "AUDIÊNCIA", registro: "tarefa" };
  let tipo = classificarTipo(titulo);
  if (tipo === "AUDIÊNCIA" || tipo === "PREPARAÇÃO AUDIÊNCIA") tipo = "PRAZO";
  return { audiencia: false, tipo, registro: tipo === "PRAZO" ? "prazo" : "tarefa" };
}

/** Remove o papel entre parênteses: "FULANO (Requerente)" → "FULANO". */
export const semPapel = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();
