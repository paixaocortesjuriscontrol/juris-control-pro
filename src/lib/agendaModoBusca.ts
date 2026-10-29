/**
 * Decide como o calendário deve buscar cada tipo de item.
 *
 * - "pessoal": a busca do banco `get_agenda_pessoal` traz só o que diz respeito a
 *   UMA pessoa (responsável, co-responsável, envolvida, criadora, participante).
 *   O navegador manda apenas o identificável da pessoa — nunca listas de itens.
 * - "escritorio": a busca `get_agenda_escritorio` traz tudo do período nas
 *   coordenações da pessoa, sem olhar responsável nem envolvido.
 * - "legado": combinações que as buscas por tipo ainda não cobrem (busca por
 *   processo, por cliente, por várias pessoas ao mesmo tempo, admin vendo todas
 *   as coordenações) continuam na consulta antiga do navegador.
 */

export type FonteAgenda = "tarefas" | "eventos" | "prazos_tst" | "audiencias" | "parcelas";

export type ModoBuscaAgenda =
  | { modo: "pessoal"; usuario: string }
  | { modo: "escritorio"; coordenacoes: string[] }
  | { modo: "legado" };

interface FiltrosParaModo {
  processoIds?: string[];
  processoNumeroDigits?: string;
  clienteId?: string;
  origens?: unknown[];
  coordenacaoId?: string;
  coordenacaoIds?: string[];
  responsavelIds?: string[];
  fetchAll?: boolean;
  dataInicio?: Date;
  dataFim?: Date;
}

export function resolverModoBuscaAgenda(
  filters: FiltrosParaModo,
  userId?: string,
): ModoBuscaAgenda {
  const coordenacoes = filters.coordenacaoIds?.length ? filters.coordenacaoIds : [];
  const pessoas = filters.responsavelIds ?? [];

  // Filtros que a busca por tipo não cobre, ou período incompleto: consulta antiga.
  if (
    filters.processoIds?.length ||
    filters.processoNumeroDigits ||
    filters.clienteId ||
    filters.origens?.length ||
    filters.coordenacaoId ||
    filters.fetchAll ||
    !filters.dataInicio ||
    !filters.dataFim
  ) {
    return { modo: "legado" };
  }

  if (coordenacoes.length > 0) {
    // Escritório é por coordenação. Se além dela houver filtro de pessoa
    // (ex.: "Protocolados"/"Baixados" de alguém), o pedido é mais estreito e
    // continua na consulta antiga.
    if (pessoas.length > 0) return { modo: "legado" };
    return { modo: "escritorio", coordenacoes };
  }

  // Pessoal: uma pessoa por vez (a própria, ou a escolhida na tela).
  if (pessoas.length > 1) return { modo: "legado" };
  const usuario = pessoas.length === 1 ? pessoas[0] : userId;
  if (!usuario) return { modo: "legado" };
  return { modo: "pessoal", usuario };
}
