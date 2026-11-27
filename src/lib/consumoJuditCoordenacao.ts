export const SEM_COORDENACAO_IDENTIFICADA = "Sem coordenação identificada";

export type ConsultaParaResumoCoordenacao = {
  processo_numero: string;
  cobrado: boolean;
  custo: number;
};

export type ResumoCoordenacao = {
  coordenacao: string;
  total: number;
  cobradas: number;
  custo: number;
};

export function resumirConsultasPorCoordenacao(
  consultas: ConsultaParaResumoCoordenacao[],
  coordenacaoPorProcesso: ReadonlyMap<string, string>,
): ResumoCoordenacao[] {
  const resumo = new Map<string, ResumoCoordenacao>();

  for (const consulta of consultas) {
    const nome = coordenacaoPorProcesso.get(consulta.processo_numero) || SEM_COORDENACAO_IDENTIFICADA;
    const atual = resumo.get(nome) ?? { coordenacao: nome, total: 0, cobradas: 0, custo: 0 };
    atual.total += 1;
    if (consulta.cobrado) atual.cobradas += 1;
    atual.custo += consulta.custo;
    resumo.set(nome, atual);
  }

  return Array.from(resumo.values()).sort(
    (a, b) => b.total - a.total || b.cobradas - a.cobradas || a.coordenacao.localeCompare(b.coordenacao, "pt-BR"),
  );
}
