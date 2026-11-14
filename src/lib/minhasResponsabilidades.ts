import { classificarStatus, type StatusItem } from "@/lib/statusItemEquipe";

/** Papel da pessoa num item da agenda: responsável vence envolvido; só criador não conta. */
export type PapelItem = "responsavel" | "envolvido" | null;
export type GrupoAgendaResponsabilidade = "atrasadas" | "hoje" | "futuras" | null;

interface ItemAgendaResponsabilidade {
  data_fatal?: string | null;
  data_vencimento?: string | null;
  data_inicio?: string | null;
}

/** Divide a agenda pela data; itens passados já encerrados não ficam como atrasados. */
export function grupoAgendaResponsabilidade(
  item: ItemAgendaResponsabilidade,
  hoje: string,
  status: StatusItem = classificarStatus(item),
): GrupoAgendaResponsabilidade {
  const data = String(item.data_fatal ?? item.data_vencimento ?? item.data_inicio ?? "").slice(0, 10);
  if (!data) return null;
  if (data === hoje) return "hoje";
  if (data > hoje) return "futuras";
  return status === "atrasada" ? "atrasadas" : null;
}

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
