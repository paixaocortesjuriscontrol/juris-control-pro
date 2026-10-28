/**
 * Quantos IDs de tarefas vinculadas (co-responsáveis/envolvidos) cabem no filtro
 * `or(...)` da agenda sem estourar o tamanho máximo do endereço da busca.
 * Cada UUID ocupa ~39 caracteres codificados; pessoas entram duas vezes
 * (responsável e criador). Acima de ~16 KB o servidor recusa a busca e a
 * agenda ficava tentando de novo sem parar.
 */
export const ORCAMENTO_IDS_URL_AGENDA = 260;

export function limiteIdsVinculadosAgenda(qtdPessoas: number): number {
  return Math.max(0, ORCAMENTO_IDS_URL_AGENDA - 2 * Math.max(0, qtdPessoas));
}
