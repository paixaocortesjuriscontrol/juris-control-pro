/** Nome da atividade usado no filtro do reagendamento em lote (ex.: RRAP, CONTESTAÇÃO). */
export function nomeAtividadeLote(titulo: string | null | undefined): string {
  return (titulo || "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** Lista os nomes de atividade distintos, em ordem alfabética. */
export function listarAtividadesLote(itens: { titulo?: string | null }[]): string[] {
  const s = new Set<string>();
  for (const i of itens) { const n = nomeAtividadeLote(i.titulo); if (n) s.add(n); }
  return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Vazio = todas as atividades. */
export function passaFiltroAtividade(titulo: string | null | undefined, escolhida: string): boolean {
  return !escolhida || nomeAtividadeLote(titulo) === escolhida;
}
