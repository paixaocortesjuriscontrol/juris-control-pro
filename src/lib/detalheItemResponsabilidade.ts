export type PublicacaoDetalheItem = {
  id: string;
  origem_publicacao: "processo" | "termo";
  vinculada_item: boolean;
  [campo: string]: unknown;
};

/** Datas sem hora são civis; datas com hora são sempre apresentadas em Brasília. */
export function formatarDataDetalhe(valor?: unknown, comHora = false): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "—";
  const somenteData = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (somenteData) return `${somenteData[3]}/${somenteData[2]}/${somenteData[1]}`;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(comHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(data);
}

/**
 * Reúne as publicações do processo e as ligadas diretamente ao item, sem
 * duplicar registros e preservando a indicação de origem da tarefa.
 */
export function mesclarPublicacoesItem(
  processo: any[] = [],
  termos: any[] = [],
  idsProcessoVinculados: string[] = [],
  idsTermosVinculados: string[] = [],
): PublicacaoDetalheItem[] {
  const processoDiretos = new Set(idsProcessoVinculados);
  const termosDiretos = new Set(idsTermosVinculados);
  const mapa = new Map<string, PublicacaoDetalheItem>();

  for (const pub of processo) {
    if (!pub?.id) continue;
    mapa.set(`processo:${pub.id}`, {
      ...pub,
      origem_publicacao: "processo",
      vinculada_item: processoDiretos.has(pub.id),
    });
  }
  for (const pub of termos) {
    if (!pub?.id) continue;
    mapa.set(`termo:${pub.id}`, {
      ...pub,
      origem_publicacao: "termo",
      vinculada_item: termosDiretos.has(pub.id),
    });
  }

  return [...mapa.values()].sort((a, b) => {
    if (a.vinculada_item !== b.vinculada_item) return a.vinculada_item ? -1 : 1;
    return String(b.data_publicacao ?? b.created_at ?? "").localeCompare(
      String(a.data_publicacao ?? a.created_at ?? ""),
    );
  });
}
