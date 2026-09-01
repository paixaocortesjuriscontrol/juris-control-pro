/**
 * "Outra Matéria" é um rótulo especial usado na Distribuição TST para indicar
 * que a matéria do recurso não está cadastrada no Santander.
 *
 * Regra atual (definida pela advogada):
 *  - É totalmente NEUTRA: nunca gera pendência nem aviso, e nunca rejeita o
 *    processo na Carga Benner.
 *  - Aparece como linha na tabela de Análise por Matéria (preenchimento
 *    opcional) e é exportada normalmente nas planilhas de Carga Benner.
 */

export const OUTRA_MATERIA_LABEL = "Outra Matéria";

/** Normaliza nome de matéria para comparação (sem acento, minúsculo, espaços colapsados). */
export function normalizeMateriaNome(nome: string | null | undefined): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function isOutraMateria(nome: string | null | undefined): boolean {
  return normalizeMateriaNome(nome) === "outra materia";
}

/**
 * Mantido por compatibilidade: "Outra Matéria" hoje é neutra, então a lista é
 * devolvida intacta.
 */
export function aplicarRegraOutraMateria<T>(
  itens: T[],
  _getNome: (item: T) => string | null | undefined,
): T[] {
  return itens;
}
