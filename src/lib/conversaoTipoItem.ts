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
