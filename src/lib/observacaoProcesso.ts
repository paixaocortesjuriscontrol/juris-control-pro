export function normalizarObservacaoProcesso(texto: string): string | null {
  const normalizado = texto.trim();
  return normalizado || null;
}

/** Atualização deliberadamente limitada à observação do advogado. */
export function criarAtualizacaoObservacaoProcesso(texto: string) {
  return { observacao_advogado: normalizarObservacaoProcesso(texto) };
}
