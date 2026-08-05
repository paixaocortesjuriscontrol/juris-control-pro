import { CAMPOS_MODELO } from "@/constants/camposModeloTitulo";
import type { ModeloTitulo, TipoModelo } from "@/hooks/useModelosTitulo";

/**
 * Valores de data nos modelos são guardados como expressões relativas
 * ("hoje", "amanha", "+7d", "+5du", "prox_seg") para o modelo continuar
 * válido ao longo do tempo. Aqui resolvemos para yyyy-MM-dd.
 */
export const MODOS_DATA: { value: string; label: string; precisaN?: boolean }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "amanha", label: "Amanhã" },
  { value: "d", label: "Em N dias corridos", precisaN: true },
  { value: "du", label: "Em N dias úteis", precisaN: true },
  { value: "prox_seg", label: "Próxima segunda-feira" },
];

export function parseExprData(expr?: string | null): { modo: string; n: number } {
  const v = (expr || "").trim();
  if (!v) return { modo: "", n: 7 };
  const m = v.match(/^\+(\d+)(du|d)$/);
  if (m) return { modo: m[2], n: Number(m[1]) };
  return { modo: v, n: 7 };
}

export function montarExprData(modo: string, n: number): string {
  if (!modo) return "";
  if (modo === "d" || modo === "du") return `+${Math.max(0, n || 0)}${modo}`;
  return modo;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDiasUteis(base: Date, n: number) {
  const d = new Date(base);
  let restantes = n;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !emSuspensaoClt(d)) restantes--;
  }
  return d;
}

/**
 * Art. 775-A da CLT: os prazos ficam suspensos entre 20 de dezembro e
 * 20 de janeiro (inclusive). Dias nesse intervalo não contam como úteis.
 */
function emSuspensaoClt(d: Date): boolean {
  const mes = d.getMonth() + 1;
  const dia = d.getDate();
  return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
}

/**
 * Resolve o prazo pré-programado do modelo ("Prazo (dias)" + unidade) a partir
 * de uma data base (data da publicação ou hoje). Devolve yyyy-MM-dd ou "".
 */
export function resolverPrazoModelo(
  modelo: ModeloTitulo,
  dataBase?: Date | string | null,
): string {
  const padroes = (modelo.padroes ?? {}) as Record<string, any>;
  const dias = Number(padroes.prazo_dias);
  if (!Number.isFinite(dias) || dias <= 0) return "";
  const unidade = String(padroes.prazo_unidade || "uteis");
  let base: Date;
  if (dataBase instanceof Date) base = new Date(dataBase);
  else if (typeof dataBase === "string" && dataBase.trim()) {
    const [y, m, d] = dataBase.slice(0, 10).split("-").map(Number);
    base = y && m && d ? new Date(y, m - 1, d) : new Date();
  } else base = new Date();
  base.setHours(12, 0, 0, 0);
  if (unidade === "corridos") {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    return toISO(d);
  }
  return toISO(addDiasUteis(base, dias));
}

/** Resolve uma expressão relativa de data para yyyy-MM-dd (fuso local do usuário). */
export function resolverData(expr?: string | null): string {
  const { modo, n } = parseExprData(expr);
  if (!modo) return "";
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  switch (modo) {
    case "hoje":
      return toISO(hoje);
    case "amanha": {
      const d = new Date(hoje);
      d.setDate(d.getDate() + 1);
      return toISO(d);
    }
    case "d": {
      const d = new Date(hoje);
      d.setDate(d.getDate() + n);
      return toISO(d);
    }
    case "du":
      return toISO(addDiasUteis(hoje, n));
    case "prox_seg": {
      const d = new Date(hoje);
      const delta = ((8 - d.getDay()) % 7) || 7;
      d.setDate(d.getDate() + delta);
      return toISO(d);
    }
    default:
      return "";
  }
}

/**
 * Devolve os padrões do modelo já resolvidos (datas convertidas em yyyy-MM-dd).
 * Campos vazios são omitidos.
 */
export function resolverPadroes(modelo: ModeloTitulo): Record<string, string> {
  const padroes = (modelo.padroes ?? {}) as Record<string, any>;
  const campos = CAMPOS_MODELO[modelo.tipo as TipoModelo] ?? [];
  const out: Record<string, string> = {};
  for (const campo of campos) {
    const raw = padroes[campo.key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const valor = campo.kind === "date" ? resolverData(String(raw)) : String(raw);
    if (valor) out[campo.key] = valor;
  }
  return out;
}

function vazio(v: any) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return v === 0;
  if (typeof v === "boolean") return v === false;
  return false;
}

/**
 * Aplica os padrões do modelo através de setters, sem sobrescrever
 * valores já preenchidos pelo usuário. Devolve quantos campos foram aplicados.
 */
export function aplicarPadroesModelo(
  modelo: ModeloTitulo,
  setters: Record<string, (valor: string) => void>,
  atuais: Record<string, any> = {},
): number {
  const resolvidos = resolverPadroes(modelo);
  let aplicados = 0;
  for (const [key, valor] of Object.entries(resolvidos)) {
    const setter = setters[key];
    if (!setter) continue;
    if (!vazio(atuais[key])) continue;
    setter(valor);
    aplicados++;
  }
  return aplicados;
}