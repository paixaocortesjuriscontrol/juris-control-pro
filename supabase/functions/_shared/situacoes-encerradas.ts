/**
 * Situações que indicam item ENCERRADO (não deve gerar alerta de prazo perdido).
 * Alinhado a src/constants/situacoesItem.ts, mantendo variações legadas.
 */
const COMUNS = [
  "cancelado",
  "cancelada",
  "concluido_sem_sucesso",
  "verificado",
  "tratado",
  "tratada",
  "arquivada",
  "arquivado",
];

export const ENCERRADAS_TAREFA = [...COMUNS, "cumprido", "cumprida", "concluida", "concluido"];

export const ENCERRADAS_EVENTO = [...COMUNS, "concluido", "concluida"];

export const ENCERRADAS_AUDIENCIA = [
  ...COMUNS,
  "concluido",
  "concluida",
  "realizada",
  "realizado",
  "ignorado",
  "reagendado",
];

/** Formata a lista para o filtro `.not("status", "in", ...)` do PostgREST. */
export const pgIn = (valores: string[]) => `(${[...new Set(valores)].join(",")})`;

/** Checagem em memória (case-insensitive). */
export const estaEncerrado = (status: unknown, lista: string[]) =>
  lista.includes(String(status ?? "").trim().toLowerCase());
