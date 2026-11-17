import { addDays } from "date-fns";
import { somarDiasUteis } from "@/lib/feriados";

/**
 * Regras de data a partir da DATA BASE (pedido da Isabela, item 2):
 * - com prazo cadastrado: data prevista = base + prazo (dias úteis pulando
 *   sábado, domingo e feriados da coordenação, ou dias corridos);
 * - sem prazo cadastrado: data prevista = a própria data base;
 * - data fatal = a do modelo, quando o modelo define uma; senão, a prevista.
 * As duas continuam editáveis na tela.
 */
export type UnidadePrazo = "uteis" | "corridos";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function paraISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "yyyy-MM-dd" → Date ao meio-dia local (evita virar o dia por fuso). */
export function fromISO(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Soma o prazo à data base. Sem prazo (0 dias) devolve a própria base. */
export function somarPrazo(
  base: Date,
  dias: number,
  unidade: UnidadePrazo,
  coordenacaoId?: string | null,
): Date {
  if (!dias || dias <= 0) return base;
  return unidade === "uteis" ? somarDiasUteis(base, dias, coordenacaoId) : addDays(base, dias);
}

export function calcularDataPrevista(
  base: Date,
  dias: number,
  unidade: UnidadePrazo,
  coordenacaoId?: string | null,
): Date {
  return somarPrazo(base, dias, unidade, coordenacaoId);
}

/** Fatal do modelo quando houver; senão, a própria data prevista. */
export function calcularDataFatal(
  base: Date,
  dias: number,
  unidade: UnidadePrazo,
  coordenacaoId?: string | null,
  fatalDoModelo?: string | null,
): Date {
  const doModelo = fromISO(fatalDoModelo);
  if (doModelo) return doModelo;
  return calcularDataPrevista(base, dias, unidade, coordenacaoId);
}

/** Variante em texto ("yyyy-MM-dd") para formulários que guardam strings. */
export function calcularDataPrevistaISO(
  baseISO: string | undefined,
  dias: number,
  unidade: UnidadePrazo,
  coordenacaoId?: string | null,
): string {
  const base = fromISO(baseISO);
  if (!base) return "";
  return paraISO(calcularDataPrevista(base, dias, unidade, coordenacaoId));
}

export function calcularDataFatalISO(
  baseISO: string | undefined,
  dias: number,
  unidade: UnidadePrazo,
  coordenacaoId?: string | null,
  fatalDoModelo?: string | null,
): string {
  const base = fromISO(baseISO);
  if (!base) return "";
  return paraISO(calcularDataFatal(base, dias, unidade, coordenacaoId, fatalDoModelo));
}
