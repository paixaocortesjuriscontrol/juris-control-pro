import { supabase } from "@/integrations/supabase/client";
import {
  getPendencias,
  COLUNAS_SELECT_PENDENCIAS,
  isEmpty,
} from "@/utils/distribuicaoTstPendencias";

/**
 * Regra (2026-07): somente para processos PRONTOS PARA ENVIAR (status
 * `pronto_envio` e sem pendências) com distribuição a partir de 01/01/2026,
 * quando o Recurso do Reclamante estiver preenchido e "Tem chance de êxito"
 * for SIM, trocar CHANCE TURMA / CHANCE RELATOR de FAVORÁVEL para
 * DESFAVORÁVEL na análise por matéria do reclamante.
 */

const FAVORAVEL = "FAVORÁVEL";
const DESFAVORAVEL = "DESFAVORÁVEL";

const norm = (v: any): string =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const ehFavoravel = (v: any): boolean => norm(v) === "FAVORAVEL";
const ehSim = (v: any): boolean => ["SIM", "S"].includes(norm(v));

export interface LinhaAjuste {
  id: string;
  processo: string;
  dossie: string;
  equipe: string;
  data_distribuicao: string | null;
  relator: string;
  turma: string;
  materia: string;
  chance_turma_antes: string;
  chance_turma_depois: string;
  chance_relator_antes: string;
  chance_relator_depois: string;
  chance_exito: string;
}

export interface CandidatoAjuste {
  id: string;
  processo: string;
  dossie: string;
  novaLista: any[];
  linhas: LinhaAjuste[];
}

export interface ProgressoAjuste {
  fase: "analisando" | "gravando";
  current: number;
  total: number;
  atual?: string;
}

const COLS = Array.from(
  new Set([
    "id",
    "processo",
    "dossie",
    "equipe",
    "relator",
    "turma",
    "status",
    "acordo",
    "cejusc",
    "processo_outro_escritorio",
    "segredo_justica",
    "transito_julgado",
    "recurso_terceiro",
    "recurso_terceiros",
    "recorrente",
    "midia_negativa",
    "tem_data_julgamento",
    "tipo_recurso_reclamante",
    "materias_recurso_reclamante",
    "tem_chance_exito_reclamante",
    "materias_analise_reclamante",
    "materias_analise_banco",
    "data_distribuicao_real",
    "data_distribuicao_planilha",
    ...COLUNAS_SELECT_PENDENCIAS,
  ]),
).join(", ");

/** Recurso do Reclamante preenchido? (tipo + matérias + êxito SIM) */
function recursoReclamantePreenchidoComExito(row: any): boolean {
  if (isEmpty(row?.tipo_recurso_reclamante)) return false;
  if (isEmpty(row?.materias_recurso_reclamante)) return false;
  return ehSim(row?.tem_chance_exito_reclamante);
}

function construirCandidato(row: any): CandidatoAjuste | null {
  const lista = row?.materias_analise_reclamante;
  if (!Array.isArray(lista) || lista.length === 0) return null;

  const linhas: LinhaAjuste[] = [];
  let mudou = false;

  const novaLista = lista.map((item: any) => {
    if (!item || typeof item !== "object") return item;
    const turmaFav = ehFavoravel(item.chance_turma);
    const relatorFav = ehFavoravel(item.chance_relator);
    if (!turmaFav && !relatorFav) return item;
    mudou = true;
    const novo = {
      ...item,
      chance_turma: turmaFav ? DESFAVORAVEL : item.chance_turma,
      chance_relator: relatorFav ? DESFAVORAVEL : item.chance_relator,
    };
    linhas.push({
      id: row.id,
      processo: row.processo || "",
      dossie: row.dossie || "",
      equipe: row.equipe || "",
      data_distribuicao: row.data_distribuicao_real || row.data_distribuicao_planilha || null,
      relator: row.relator || "",
      turma: row.turma || "",
      materia: String(item.materia ?? "").trim(),
      chance_turma_antes: turmaFav ? FAVORAVEL : String(item.chance_turma ?? ""),
      chance_turma_depois: String(novo.chance_turma ?? ""),
      chance_relator_antes: relatorFav ? FAVORAVEL : String(item.chance_relator ?? ""),
      chance_relator_depois: String(novo.chance_relator ?? ""),
      chance_exito: String(item.chance_exito ?? ""),
    });
    return novo;
  });

  if (!mudou) return null;
  return {
    id: row.id,
    processo: row.processo || "",
    dossie: row.dossie || "",
    novaLista,
    linhas,
  };
}

/**
 * Varre os registros elegíveis e retorna os candidatos (sem gravar nada).
 */
export async function analisarCandidatosAjusteChance(opts?: {
  onProgress?: (p: ProgressoAjuste) => void;
  isCancelled?: () => boolean;
}): Promise<{ candidatos: CandidatoAjuste[]; analisados: number; prontos: number }> {
  const { onProgress, isCancelled } = opts || {};
  const PAGE = 500;
  const candidatos: CandidatoAjuste[] = [];
  let analisados = 0;
  let prontos = 0;
  let from = 0;

  for (;;) {
    if (isCancelled?.()) break;
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select(COLS)
      .eq("status", "pronto_envio")
      .or("data_distribuicao_real.gte.2026-01-01,and(data_distribuicao_real.is.null,data_distribuicao_planilha.gte.2026-01-01)")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data as any[]) || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      analisados++;
      if (row.processo_outro_escritorio === true || row.segredo_justica === true) continue;
      if (getPendencias(row).length !== 0) continue;
      prontos++;
      if (!recursoReclamantePreenchidoComExito(row)) continue;
      const cand = construirCandidato(row);
      if (cand) candidatos.push(cand);
    }

    onProgress?.({ fase: "analisando", current: analisados, total: analisados });
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return { candidatos, analisados, prontos };
}

/**
 * Grava os candidatos em lotes (updates individuais dentro de cada lote).
 */
export async function aplicarAjusteChance(
  candidatos: CandidatoAjuste[],
  opts?: {
    onProgress?: (p: ProgressoAjuste) => void;
    isCancelled?: () => boolean;
    chunkSize?: number;
  },
): Promise<{ atualizados: LinhaAjuste[]; erros: { processo: string; erro: string }[] }> {
  const { onProgress, isCancelled, chunkSize = 200 } = opts || {};
  const atualizados: LinhaAjuste[] = [];
  const erros: { processo: string; erro: string }[] = [];
  const total = candidatos.length;

  for (let i = 0; i < total; i += chunkSize) {
    const lote = candidatos.slice(i, i + chunkSize);
    for (let j = 0; j < lote.length; j++) {
      if (isCancelled?.()) return { atualizados, erros };
      const c = lote[j];
      onProgress?.({
        fase: "gravando",
        current: i + j + 1,
        total,
        atual: `${c.processo || "(sem processo)"}${c.dossie ? ` — ${c.dossie}` : ""}`,
      });
      const { error } = await supabase
        .from("dados_benner" as any)
        .update({ materias_analise_reclamante: c.novaLista } as any)
        .eq("id", c.id);
      if (error) {
        erros.push({ processo: c.processo, erro: error.message });
      } else {
        atualizados.push(...c.linhas);
      }
    }
  }

  return { atualizados, erros };
}