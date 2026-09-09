import { addDays, addMonths, addYears, endOfDay, parseISO } from "date-fns";

export const normalizeRecorrenciaTipo = (tipo: string | null | undefined) => {
  const normalized = String(tipo ?? "").toLowerCase().trim();
  if (["daily", "diaria", "diário", "diario"].includes(normalized)) return "daily";
  if (["weekdays", "uteis", "úteis", "dias_uteis", "dias-uteis", "business", "businessdays"].includes(normalized))
    return "weekdays";
  if (["weekly", "semanal"].includes(normalized)) return "weekly";
  if (["monthly", "mensal"].includes(normalized)) return "monthly";
  if (["yearly", "annual", "anual"].includes(normalized)) return "yearly";
  return normalized;
};

export interface RegraRecorrencia {
  tipo?: string | null;
  intervalo?: number | null;
  fim?: string | null;
  diasSemana?: number[] | null;
}

/**
 * Expande uma recorrência (armazenada como um único registro no banco) nas datas
 * de ocorrência dentro da janela informada. Mesma regra usada na agenda unificada.
 */
export function expandirOcorrencias(
  dataBaseIso: string,
  regra: RegraRecorrencia,
  windowStart: Date,
  windowEnd: Date,
  max = 200
): Date[] {
  const dataOriginal = parseISO(dataBaseIso);
  const tipo = normalizeRecorrenciaTipo(regra.tipo);
  if (!tipo) return [dataOriginal];

  const intervalo = Math.max(1, Number(regra.intervalo || 1));
  const diasSemana = Array.isArray(regra.diasSemana) && regra.diasSemana.length > 0 ? regra.diasSemana : null;
  const fim = regra.fim
    ? String(regra.fim).length <= 10
      ? endOfDay(parseISO(String(regra.fim)))
      : parseISO(String(regra.fim))
    : null;
  const hardStop = fim && fim < windowEnd ? fim : windowEnd;

  const ocorrencias: Date[] = [];
  let cursor = new Date(dataOriginal);
  let safety = 0;

  while (cursor <= hardStop && safety < max) {
    safety++;
    if (cursor >= windowStart) {
      if (tipo === "weekly" && diasSemana) {
        for (const d of diasSemana) {
          const diff = ((d - cursor.getDay()) + 7) % 7;
          const occ = addDays(cursor, diff);
          if (occ >= windowStart && occ <= hardStop) ocorrencias.push(occ);
        }
      } else if (tipo === "weekdays") {
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) ocorrencias.push(new Date(cursor));
      } else {
        ocorrencias.push(new Date(cursor));
      }
    }

    if (tipo === "daily") cursor = addDays(cursor, intervalo);
    else if (tipo === "weekdays") {
      do {
        cursor = addDays(cursor, 1);
      } while (cursor.getDay() === 0 || cursor.getDay() === 6);
    } else if (tipo === "weekly") cursor = addDays(cursor, 7 * intervalo);
    else if (tipo === "monthly") cursor = addMonths(cursor, intervalo);
    else if (tipo === "yearly") cursor = addYears(cursor, intervalo);
    else break;
  }

  if (ocorrencias.length === 0 && dataOriginal >= windowStart && dataOriginal <= hardStop) {
    ocorrencias.push(dataOriginal);
  }

  return ocorrencias;
}

/** Janela padrão para listas de processo: 1 mês atrás até 12 meses à frente. */
export function janelaRecorrenciaPadrao(hoje = new Date()) {
  return {
    windowStart: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
    windowEnd: new Date(hoje.getFullYear(), hoje.getMonth() + 12, 0, 23, 59, 59),
  };
}

export interface LinhaSerie<T = any> {
  chave: string;
  original: T;
  principal: T;
  repeticoes: T[];
}

/**
 * Agrupa registros com repetição em uma linha por série: a ocorrência principal
 * é a mais próxima de hoje (>= hoje), as demais ficam disponíveis para expansão.
 */
export function agruparSerieRecorrente<T extends Record<string, any>>(
  registros: T[],
  opts: {
    /** Data base para expandir as ocorrências. */
    dataBase: (r: T) => string | null | undefined;
    /** Regra de recorrência do registro (null quando não repete). */
    regra: (r: T) => RegraRecorrencia | null;
    /** Aplica a data da ocorrência ao clone do registro. */
    aplicarData: (r: T, data: Date) => T;
    chaveDe?: (r: T) => string;
    hoje?: Date;
  }
): LinhaSerie<T>[] {
  const { windowStart, windowEnd } = janelaRecorrenciaPadrao();
  const hoje = opts.hoje ? new Date(opts.hoje) : new Date();
  hoje.setHours(0, 0, 0, 0);
  const chaveDe = opts.chaveDe ?? ((r: T) => String(r.id));

  const linhas: LinhaSerie<T>[] = [];
  for (const registro of registros) {
    const regra = opts.regra(registro);
    const base = opts.dataBase(registro);
    if (!regra || !regra.tipo || !base) {
      linhas.push({ chave: chaveDe(registro), original: registro, principal: registro, repeticoes: [] });
      continue;
    }
    const datas = expandirOcorrencias(base, regra, windowStart, windowEnd).sort(
      (a, b) => a.getTime() - b.getTime()
    );
    if (datas.length <= 1) {
      linhas.push({ chave: chaveDe(registro), original: registro, principal: registro, repeticoes: [] });
      continue;
    }
    const ocorrencias = datas.map((d) => opts.aplicarData(registro, d));
    const idx = Math.max(0, datas.findIndex((d) => d >= hoje));
    linhas.push({
      chave: `serie-${chaveDe(registro)}`,
      original: registro,
      principal: ocorrencias[idx] ?? ocorrencias[0],
      repeticoes: ocorrencias.filter((_, i) => i !== idx),
    });
  }
  return linhas;
}

/** Total de itens (principais + repetições) de uma lista de séries. */
export function totalOcorrencias(linhas: LinhaSerie[]) {
  return linhas.reduce((acc, l) => acc + 1 + l.repeticoes.length, 0);
}

/**
 * Agrupa registros que já existem individualmente (ex.: parcelas de um
 * parcelamento) por uma chave de grupo, elegendo a ocorrência mais próxima.
 */
export function agruparPorGrupo<T extends Record<string, any>>(
  registros: T[],
  opts: {
    grupoDe: (r: T) => string | null | undefined;
    dataDe: (r: T) => string | null | undefined;
    hoje?: Date;
  }
): LinhaSerie<T>[] {
  const hoje = opts.hoje ? new Date(opts.hoje) : new Date();
  hoje.setHours(0, 0, 0, 0);
  const soltos: LinhaSerie<T>[] = [];
  const grupos = new Map<string, T[]>();
  for (const r of registros) {
    const g = opts.grupoDe(r);
    if (!g) {
      soltos.push({ chave: String(r.id), original: r, principal: r, repeticoes: [] });
      continue;
    }
    const lista = grupos.get(g) ?? [];
    lista.push(r);
    grupos.set(g, lista);
  }
  const agrupados: LinhaSerie<T>[] = [];
  for (const [g, lista] of grupos) {
    const ordenada = [...lista].sort(
      (a, b) => new Date(opts.dataDe(a) || 0).getTime() - new Date(opts.dataDe(b) || 0).getTime()
    );
    const idx = Math.max(
      0,
      ordenada.findIndex((r) => new Date(opts.dataDe(r) || 0) >= hoje)
    );
    agrupados.push({
      chave: `grupo-${g}`,
      original: ordenada[idx] ?? ordenada[0],
      principal: ordenada[idx] ?? ordenada[0],
      repeticoes: ordenada.filter((_, i) => i !== idx),
    });
  }
  return [...agrupados, ...soltos];
}

