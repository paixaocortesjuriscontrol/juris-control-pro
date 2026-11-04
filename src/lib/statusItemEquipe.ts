import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import { isItemTratado } from "@/components/shared/TratadoCheck";

/** Situações que a tela da Equipe permite filtrar. */
export type StatusFiltro = "todos" | "pendentes" | "atrasadas" | "cumpridas" | "cancelados";

/** Situação real de um item, igual ao selo exibido na lista. */
export type StatusItem = "pendente" | "atrasada" | "cumprida" | "cancelado";

const STATUS_PARA_FILTRO: Record<StatusItem, StatusFiltro> = {
  pendente: "pendentes",
  atrasada: "atrasadas",
  cumprida: "cumpridas",
  cancelado: "cancelados",
};

interface ItemComDatas {
  data_fatal?: string | null;
  data_vencimento?: string | null;
  data_inicio?: string | null;
  status?: string | null;
  situacao?: string | null;
  status_tst?: string | null;
  origem?: string | null;
  data_cumprimento?: string | null;
  concluido_em?: string | null;
  tratado_em?: string | null;
  prazo_fatal_conferido?: boolean | null;
  titulo?: string | null;
}

export function getRefDate(item: ItemComDatas): Date | null {
  const raw = item.data_fatal ?? item.data_vencimento ?? item.data_inicio;
  if (!raw) return null;
  const d = parseISO(raw);
  return isValid(d) ? d : null;
}

export function isItemCancelado(item: ItemComDatas): boolean {
  const normalize = (v?: string | null) =>
    (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return [item.status, item.situacao, item.status_tst].some((v) =>
    ["cancelado", "cancelada"].includes(normalize(v)),
  );
}

/** Classifica o item: cancelado > cumprido > atrasado > pendente (mesma ordem do selo). */
export function classificarStatus(item: ItemComDatas): StatusItem {
  if (isItemCancelado(item)) return "cancelado";
  if (isItemTratado(item)) return "cumprida";
  const d = getRefDate(item);
  if (d && differenceInCalendarDays(d, new Date()) < 0) return "atrasada";
  return "pendente";
}

/** O item pertence ao filtro escolhido? */
export function itemCorrespondeFiltro(item: ItemComDatas, filtro: StatusFiltro): boolean {
  return filtro === "todos" || STATUS_PARA_FILTRO[classificarStatus(item)] === filtro;
}
