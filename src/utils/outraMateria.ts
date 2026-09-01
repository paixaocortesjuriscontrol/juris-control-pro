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
 * Aplica a regra acima a uma lista de matérias (strings ou objetos com
 * `materia`). Retorna a lista sem "Outra Matéria" quando existe alguma matéria
 * real; caso contrário devolve a lista original.
 */
export function aplicarRegraOutraMateria<T>(
  itens: T[],
  getNome: (item: T) => string | null | undefined,
): T[] {
  const reais = itens.filter((i) => !isOutraMateria(getNome(i)));
  return reais.length > 0 ? reais : itens;
}
