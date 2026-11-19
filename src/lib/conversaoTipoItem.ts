/**
 * Mantém os dois campos de classificação consistentes ao converter um item
 * existente sem criar outro cadastro nem alterar seus vínculos.
 */
export function camposTipoTarefa(tipoTarefa: string) {
  const tipo = String(tipoTarefa || "TAREFA").trim().toUpperCase();
  return {
    tipo_tarefa: tipo,
    tipo_registro: tipo === "PRAZO" ? "prazo" : "tarefa",
  } as const;
}

/**
 * Em edições, só envia os campos de tipo quando o tipo realmente muda.
 * Corrigir "de carona" um tipo_registro inconsistente fazia a trava de
 * agendamento da coordenação bloquear quem só pode mudar a situação.
 */
export function camposTipoSeAlterado(novoTipo: string | null | undefined, tipoAtual: string | null | undefined) {
  if (!novoTipo) return {};
  const novo = String(novoTipo).trim().toUpperCase();
  const atual = String(tipoAtual || "").trim().toUpperCase();
  if (atual && novo === atual) return {};
  return camposTipoTarefa(novo);
}
