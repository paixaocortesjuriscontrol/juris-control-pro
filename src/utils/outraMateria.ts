/**
 * "Outra Matéria" é um rótulo especial usado na Distribuição TST para indicar
 * que a matéria do recurso não está cadastrada no Santander.
 *
 * Regras (definidas pela advogada):
 *  - Quando há pelo menos uma matéria real selecionada, "Outra Matéria" é
 *    ignorada: não gera linha de análise nem pendência.
 *  - Quando é a ÚNICA matéria selecionada, ela gera linha de análise e é
 *    cobrada normalmente (Aparelhamento, Chance Turma, Chance Relator, Êxito).
 *  - Em qualquer caso, NUNCA é exportada nas planilhas de Carga Benner.
 */

export const OUTRA_MATERIA_LABEL = "Outra Matéria";

export function isOutraMateria(nome: string | null | undefined): boolean {
  return (
    (nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() ===
    "outra materia"
  );
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
