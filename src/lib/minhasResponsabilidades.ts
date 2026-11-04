/** Papel da pessoa num item da agenda: responsável vence envolvido; só criador não conta. */
export type PapelItem = "responsavel" | "envolvido" | null;

interface ItemComPessoas {
  responsavel_id?: string | null;
  responsaveis?: unknown;
  envolvidos?: unknown;
}

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x: any) => (typeof x === "string" ? x : x?.usuario_id ?? x?.id)).filter(Boolean) : [];

export function papelDoUsuario(item: ItemComPessoas, usuarioId: string): PapelItem {
  if (item.responsavel_id === usuarioId || ids(item.responsaveis).includes(usuarioId)) return "responsavel";
  if (ids(item.envolvidos).includes(usuarioId)) return "envolvido";
  return null;
}
