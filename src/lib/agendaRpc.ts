import { supabase } from "@/integrations/supabase/client";
import type { FonteAgenda, ModoBuscaAgenda } from "@/lib/agendaModoBusca";

/** Data no formato `AAAA-MM-DD` (a coluna do banco é `date`). */
const dStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface LeituraFonteAgenda {
  linhas: any[];
  temMais: boolean;
}

interface FiltrosDeLeitura {
  dataInicio: Date;
  dataFim: Date;
  tipos?: string[];
  status?: string;
  statusIn?: string[];
  statusNotIn?: string[];
}

/**
 * Lê UMA fonte do calendário pela busca pronta do banco (`get_agenda_pessoal`
 * ou `get_agenda_escritorio`). Cada chamada traz um tipo só: se uma delas
 * falhar, dá para dizer qual deixou de chegar em vez de sumir com a tela toda.
 */
export async function lerFonteAgendaPorTipo(
  modo: ModoBuscaAgenda,
  fonte: FonteAgenda,
  filtros: FiltrosDeLeitura,
  offset: number,
  limit: number,
): Promise<LeituraFonteAgenda> {
  const parametros = {
    p_fontes: [fonte],
    p_inicio: dStr(filtros.dataInicio),
    p_fim: dStr(filtros.dataFim),
    p_inicio_ts: filtros.dataInicio.toISOString(),
    p_fim_ts: filtros.dataFim.toISOString(),
    p_tipos: filtros.tipos?.length ? filtros.tipos : null,
    p_status: filtros.status && filtros.status !== "todas" ? filtros.status : null,
    p_status_in: filtros.statusIn?.length ? filtros.statusIn : null,
    p_status_not_in: filtros.statusNotIn?.length ? filtros.statusNotIn : null,
    p_offset: offset,
    p_limit: limit,
  };

  const { data, error } =
    modo.modo === "escritorio"
      ? await supabase.rpc("get_agenda_escritorio", { p_coordenacoes: modo.coordenacoes, ...parametros })
      : await supabase.rpc("get_agenda_pessoal", { p_usuario: modo.usuario, ...parametros });

  if (error) {
    throw new Error(`Falha ao carregar ${fonte}: ${error.message}`);
  }

  const bloco = ((data as any)?.[fonte] ?? {}) as { linhas?: any[]; tem_mais?: boolean };
  return { linhas: bloco.linhas ?? [], temMais: bloco.tem_mais === true };
}
