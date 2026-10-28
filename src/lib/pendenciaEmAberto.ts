/** Situações que encerram um item; qualquer outra mantém o item como pendência. */
export const SITUACOES_ENCERRADAS = new Set([
  "cumprido", "concluido", "concluido_sem_sucesso", "tratado", "cancelado",
  "cancelado_oculto", "protocolado", "baixado", "verificado",
]);

export const situacaoEmAberto = (status: string | null | undefined) =>
  !SITUACOES_ENCERRADAS.has((status || "pendente").toString().trim().toLowerCase());
