/**
 * Registro global dos blocos de anexos abertos na tela.
 * Permite que ações que não passam pelo botão "Salvar" (ex.: baixa de
 * ocorrência recorrente) enviem os arquivos que ainda estão na fila.
 */
type Flush = () => Promise<void>;

const registro = new Set<Flush>();

export function registrarFlushAnexos(fn: Flush) {
  registro.add(fn);
  return () => {
    registro.delete(fn);
  };
}

export async function enviarAnexosPendentes() {
  for (const fn of Array.from(registro)) {
    await fn();
  }
}
