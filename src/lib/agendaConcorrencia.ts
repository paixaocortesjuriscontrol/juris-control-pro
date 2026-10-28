/** Executa leituras independentes com limite de concorrência e preserva a ordem. */
export async function leiturasAgendaEmParalelo<T>(
  leituras: readonly (() => Promise<T>)[],
  limite = 2,
): Promise<T[]> {
  const resultados = new Array<T>(leituras.length);
  let proximo = 0;
  let falhou = false;
  const trabalhador = async () => {
    while (!falhou && proximo < leituras.length) {
      const indice = proximo++;
      try {
        resultados[indice] = await leituras[indice]();
      } catch (erro) {
        falhou = true;
        throw erro;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limite), leituras.length) }, trabalhador));
  return resultados;
}