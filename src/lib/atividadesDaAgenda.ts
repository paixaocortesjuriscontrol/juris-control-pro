/** Agrupa as atividades (tarefas e prazos) que estão de fato na agenda carregada. */
export interface AtividadeAgenda { chave: string; nome: string; cor?: string | null; quantidade: number }

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

import { getItemRawId } from "@/hooks/useItensComAtividades";
const rawId = (id: unknown) => getItemRawId(String(id ?? ""));

/** Só tarefas e prazos (inclui Ata); audiências, eventos e parcelas ficam de fora. */
export function ehTarefaOuPrazo(item: any): boolean {
  const tipoUpper = String(item?.tipo_tarefa ?? "").toUpperCase().trim();
  const tipo = String(item?.tipo ?? "").toLowerCase();
  if (tipoUpper === "AUDIÊNCIA" || tipoUpper === "AUDIENCIA" || tipo === "audiencia") return false;
  if (tipo === "evento" || tipoUpper === "EVENTO" || tipo === "parcelamento") return false;
  return true;
}

export function chaveAtividade(
  item: any,
  modeloPorTarefa?: Map<string, { nome: string; cor?: string | null }>,
): { chave: string; nome: string; cor?: string | null } | null {
  if (!ehTarefaOuPrazo(item)) return null;
  const modelo = modeloPorTarefa?.get(rawId(item?.id));
  const nome = (modelo?.nome || item?.titulo || "").trim();
  if (!nome) return null;
  return { chave: norm(nome), nome, cor: modelo?.cor ?? null };
}

export function agruparAtividadesDaAgenda(
  itens: any[],
  modeloPorTarefa?: Map<string, { nome: string; cor?: string | null }>,
): AtividadeAgenda[] {
  const mapa = new Map<string, AtividadeAgenda>();
  for (const item of itens) {
    const a = chaveAtividade(item, modeloPorTarefa);
    if (!a) continue;
    const atual = mapa.get(a.chave);
    if (atual) { atual.quantidade++; if (!atual.cor && a.cor) atual.cor = a.cor; }
    else mapa.set(a.chave, { ...a, quantidade: 1 });
  }
  return [...mapa.values()].sort((x, y) => y.quantidade - x.quantidade || x.nome.localeCompare(y.nome, "pt-BR"));
}

export function filtrarPorAtividades(
  itens: any[],
  selecionadas: string[] | undefined,
  modeloPorTarefa?: Map<string, { nome: string; cor?: string | null }>,
): any[] {
  if (!selecionadas || selecionadas.length === 0) return itens;
  const set = new Set(selecionadas);
  return itens.filter((i) => { const a = chaveAtividade(i, modeloPorTarefa); return !!a && set.has(a.chave); });
}

/** Data em que o item aparece na agenda (yyyy-MM-dd). */
export function dataDoItemNaAgenda(item: any, usarFatal = false): string {
  let d: string | undefined;
  if (item?.origem === "tarefa") {
    if (item.recorrencia_pai_id) d = item.data_inicio;
    else if (usarFatal) d = item.data_fatal ?? item.data_vencimento ?? item.data_inicio;
    else d = item.data_vencimento ?? item.data_fatal ?? item.data_inicio;
  } else d = item?.data_inicio;
  return String(d ?? "").slice(0, 10);
}
