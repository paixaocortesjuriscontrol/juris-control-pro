/**
 * Marcador persistido de "pronto SEM pendência" (`dados_benner.sem_pendencia`).
 *
 * Antes a tela recalculava as pendências de todos os processos prontos a cada
 * carregamento (leitura de ~2 mil linhas + regras condicionais no cliente).
 * Agora o cálculo roda APENAS quando a advogada clica em "Verificar
 * Pendências"; o resultado fica gravado em cada registro e a tela passa a
 * apenas ler/filtrar pela coluna (índice no banco).
 */
import { supabase } from "@/integrations/supabase/client";
import { ensureMateriasOficiais } from "@/utils/materiasOficiaisCache";
import { ensurePedidosPorDossie, pedidosPorDossieCarregados } from "@/utils/pedidosPorDossieCache";
import {
  fetchProntosRowsCached,
  invalidateDistribuicaoTstCache,
  COLUNAS_PRONTOS_COMPARTILHADAS,
} from "@/utils/distribuicaoTstCache";
import { fetchAllDistribuicaoTstIds, type DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";

import {
  getPendencias,
  isNaoPrecisaFazer,
  isMarcadoPronto,
  precisaRevisarListaMaterias,
  semNenhumaMateriaDoDossie,
} from "@/utils/distribuicaoTstPendencias";

const STATUS_CONCLUIDOS = ["pronto_envio", "planilhado", "enviado"];

/**
 * Carrega as listas oficiais ANTES de qualquer cálculo e falha alto quando a
 * lista de pedidos por dossiê não vem. Sem essa proteção, uma falha de rede
 * fazia o cálculo tratar TODOS os dossiês como "sem lista de pedidos" e gravar
 * pendência falsa ("Revisar lista de matérias") em tudo que fosse verificado.
 */
async function garantirListasOficiais(): Promise<void> {
  await Promise.all([
    ensureMateriasOficiais().catch(() => {}),
    ensurePedidosPorDossie().catch(() => {}),
  ]);
  if (!pedidosPorDossieCarregados()) {
    throw new Error(
      "Não foi possível carregar a lista de Pedidos por dossiê — nada foi gravado. Tente novamente.",
    );
  }
}


/** Um registro está "sem pendência" quando é pronto e não falta nada. */
export function calcularSemPendencia(row: any): boolean {
  // Processos em outro escritório, sob segredo de justiça, CEJUSC ou com
  // Acordo aparecem na lista como "Não precisa fazer" — nunca contam como
  // "pronto com pendência" nos cards.
  if (isNaoPrecisaFazer(row)) return true;
  return getPendencias(row).length === 0;
}


/**
 * Um registro precisa "Revisar Lista de matérias" quando é pronto e nenhuma
 * das matérias selecionadas consta na lista de pedidos do dossiê.
 */
export function calcularRevisarListaMaterias(row: any): boolean {
  if (!isMarcadoPronto(row)) return false;
  // "Não precisa fazer" não gera nenhuma pendência.
  if (isNaoPrecisaFazer(row)) return false;
  return precisaRevisarListaMaterias(row);
}

/** Executa tarefas com paralelismo limitado (reduz o tempo total de gravação). */
async function comConcorrencia<T>(itens: T[], limite: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (i < itens.length) {
      const idx = i++;
      await fn(itens[idx]);
    }
  });
  await Promise.all(workers);
}

function emLotes<T>(lista: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

/** Grava um mesmo patch para uma lista de ids, em lotes paralelos. */
async function updatePatch(ids: string[], patch: Record<string, any>) {
  if (!ids.length) return;
  await comConcorrencia(emLotes(ids, 200), 4, async (slice) => {
    const { error } = await supabase
      .from("dados_benner" as any)
      .update(patch as any)
      .in("id", slice);
    if (error) throw error;
  });
}

async function updateEmLotes(ids: string[], valor: boolean, agora: string) {
  await updatePatch(ids, { sem_pendencia: valor, pendencias_verificado_em: agora });
}

/** Grava o marcador `revisar_lista_materias` em lotes. */
async function updateRevisarEmLotes(ids: string[], valor: boolean) {
  await updatePatch(ids, { revisar_lista_materias: valor });
}

async function updateSemNenhumaEmLotes(ids: string[], valor: boolean) {
  await updatePatch(ids, { sem_nenhuma_materia_dossie: valor });
}

/**
 * Recalcula e grava o marcador para os processos com status concluído.
 *
 * Quando `filtros` é informado (botão "Verificar Pendências" da tela), apenas
 * os registros que atendem aos filtros atuais são lidos e regravados — não é
 * mais necessário varrer a base inteira.
 */
export async function recalcularSemPendencia(
  filtros?: DistribuicaoTstFilters,
): Promise<{
  analisados: number;
  semPendencia: number;
  atualizados: number;
}> {
  await garantirListasOficiais();

  invalidateDistribuicaoTstCache();

  const temFiltros = !!filtros && Object.values(filtros).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "",
  );

  let rows: any[];
  if (temFiltros) {
    // Respeita EXATAMENTE o recorte da tela: só os registros filtrados são
    // lidos e regravados.
    const ids = await fetchAllDistribuicaoTstIds(filtros!);
    rows = [];
    await comConcorrencia(emLotes(ids, 300), 4, async (slice) => {
      const { data, error } = await supabase
        .from("dados_benner" as any)
        .select(COLUNAS_PRONTOS_COMPARTILHADAS.join(", "))
        .in("id", slice)
        .in("status", STATUS_CONCLUIDOS);
      if (error) throw error;
      rows.push(...(((data as any[]) || [])));
    });
  } else {
    rows = await fetchProntosRowsCached();
  }

  const agora = new Date().toISOString();
  const paraTrue: string[] = [];
  const paraFalse: string[] = [];
  const revisarTrue: string[] = [];
  const revisarFalse: string[] = [];
  const semNenhumaTrue: string[] = [];
  const semNenhumaFalse: string[] = [];
  let semPendencia = 0;

  for (const r of rows) {
    const id = (r as any).id;
    const ok = calcularSemPendencia(r);
    if (ok) semPendencia++;
    const atual = (r as any).sem_pendencia;
    if (ok && atual !== true) paraTrue.push(id);
    else if (!ok && atual !== false) paraFalse.push(id);

    const revisar = calcularRevisarListaMaterias(r);
    const atualRevisar = (r as any).revisar_lista_materias;
    if (revisar && atualRevisar !== true) revisarTrue.push(id);
    else if (!revisar && atualRevisar !== false) revisarFalse.push(id);

    // Só grava quando o valor muda (antes regravava TODAS as linhas).
    const semNenhuma = !isNaoPrecisaFazer(r) && semNenhumaMateriaDoDossie(r);
    const atualSemNenhuma = (r as any).sem_nenhuma_materia_dossie;
    if (semNenhuma && atualSemNenhuma !== true) semNenhumaTrue.push(id);
    else if (!semNenhuma && atualSemNenhuma !== false) semNenhumaFalse.push(id);
  }

  await Promise.all([
    updateEmLotes(paraTrue, true, agora),
    updateEmLotes(paraFalse, false, agora),
    updateRevisarEmLotes(revisarTrue, true),
    updateRevisarEmLotes(revisarFalse, false),
    updateSemNenhumaEmLotes(semNenhumaTrue, true),
    updateSemNenhumaEmLotes(semNenhumaFalse, false),
  ]);

  if (!temFiltros) {
    // Registros que deixaram de ser "prontos" mas continuavam marcados.
    const { error } = await supabase
      .from("dados_benner" as any)
      .update({ sem_pendencia: false, revisar_lista_materias: false, sem_nenhuma_materia_dossie: false, pendencias_verificado_em: agora } as any)
      .is("sem_pendencia", true)
      .not("status", "in", `(${STATUS_CONCLUIDOS.join(",")})`);
    if (error) throw error;
  }

  invalidateDistribuicaoTstCache();
  return {
    analisados: rows.length,
    semPendencia,
    atualizados: paraTrue.length + paraFalse.length,
  };
}


/**
 * Recalcula e grava o marcador de UM registro. Chamado após cada salvamento
 * na ficha (inclusive quando o processo é marcado como "Pronto para Enviar"),
 * para que a tela nunca precise recontar as pendências.
 */
export async function atualizarSemPendenciaRegistro(id: string): Promise<boolean | null> {
  if (!id) return null;
  try {
    await garantirListasOficiais();

    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select(COLUNAS_PRONTOS_COMPARTILHADAS.join(", "))
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const row: any = data;
    const concluido = STATUS_CONCLUIDOS.includes(String(row.status || ""));
    const ok = concluido ? calcularSemPendencia(row) : false;
    const { error: updErr } = await supabase
      .from("dados_benner" as any)
      .update({
        sem_pendencia: ok,
        revisar_lista_materias: concluido ? calcularRevisarListaMaterias(row) : false,
        sem_nenhuma_materia_dossie:
          concluido && !isNaoPrecisaFazer(row) ? semNenhumaMateriaDoDossie(row) : false,
        pendencias_verificado_em: new Date().toISOString(),
      } as any)
      .eq("id", id);
    if (updErr) return null;
    invalidateDistribuicaoTstCache();
    return ok;
  } catch {
    return null;
  }
}

/**
 * Preenchimento inicial (backfill): se nenhum registro tem marcação de
 * verificação, roda o cálculo completo uma única vez. Executado ao abrir a
 * tela, para que o card "Pronto sem pendência" já apareça correto sem que
 * ninguém precise clicar em "Verificar Pendências".
 */
let backfillEmAndamento: Promise<void> | null = null;
export function backfillSemPendenciaSeNecessario(): Promise<void> {
  if (backfillEmAndamento) return backfillEmAndamento;
  backfillEmAndamento = (async () => {
    const { count, error } = await supabase
      .from("dados_benner" as any)
      .select("id", { count: "exact", head: true })
      .not("pendencias_verificado_em", "is", null);
    if (error) return;
    if ((count ?? 0) === 0) {
      await recalcularSemPendencia();
      return;
    }
    // Marcador de "revisar lista de matérias" ainda nunca preenchido.
    const { count: countRevisar, error: errRevisar } = await supabase
      .from("dados_benner" as any)
      .select("id", { count: "exact", head: true })
      .not("revisar_lista_materias", "is", null);
    if (errRevisar) return;
    if ((countRevisar ?? 0) > 0) return;
    await recalcularSemPendencia();
  })()
    .catch(() => {})
    .finally(() => {
      backfillEmAndamento = null;
    });
  return backfillEmAndamento;
}

/**
 * Data da última mudança nas regras de pendência. Registros verificados ANTES
 * dessa data carregam marcação calculada com regra antiga e são revalidados
 * automaticamente ao abrir a tela (em lotes pequenos, em segundo plano).
 */
export const REGRA_PENDENCIAS_ATUALIZADA_EM = "2026-09-16T00:00:00.000Z";

/** Quantos registros antigos são revalidados por visita à tela. */
const REVALIDACAO_MAX_POR_VISITA = 600;
const REVALIDACAO_LOTE = 150;

let revalidacaoEmAndamento: Promise<number> | null = null;

/**
 * Revalida em segundo plano as fichas prontas cuja última verificação é
 * anterior à regra atual. Evita que marcações calculadas com regra antiga
 * fiquem divergindo da coluna Pendências até alguém clicar em "Verificar
 * Pendências".
 */
export function revalidarMarcacoesAntigas(): Promise<number> {
  if (revalidacaoEmAndamento) return revalidacaoEmAndamento;
  revalidacaoEmAndamento = (async () => {
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select("id")
      .in("status", STATUS_CONCLUIDOS)
      .lt("pendencias_verificado_em", REGRA_PENDENCIAS_ATUALIZADA_EM)
      .order("pendencias_verificado_em", { ascending: true })
      .limit(REVALIDACAO_MAX_POR_VISITA);
    if (error) return 0;
    const ids = ((data as any[]) || []).map((r) => r.id).filter(Boolean);
    if (!ids.length) return 0;
    for (let i = 0; i < ids.length; i += REVALIDACAO_LOTE) {
      await atualizarSemPendenciaLote(ids.slice(i, i + REVALIDACAO_LOTE));
      // Devolve o controle ao navegador entre lotes (tela não trava).
      await new Promise((r) => setTimeout(r, 60));
    }
    return ids.length;
  })()
    .catch(() => 0)
    .finally(() => {
      revalidacaoEmAndamento = null;
    });
  return revalidacaoEmAndamento;
}

/**
 * Recalcula o marcador de vários registros (ex.: botão "Marcar Pronto" em
 * lote). Lê apenas as linhas informadas e grava o resultado.
 */
export async function atualizarSemPendenciaLote(ids: string[]): Promise<void> {
  const lista = ids.filter(Boolean);
  if (!lista.length) return;
  await garantirListasOficiais();

  const agora = new Date().toISOString();
  const CHUNK = 200;
  for (let i = 0; i < lista.length; i += CHUNK) {
    const slice = lista.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select(COLUNAS_PRONTOS_COMPARTILHADAS.join(", "))
      .in("id", slice);
    if (error) throw error;
    const paraTrue: string[] = [];
    const paraFalse: string[] = [];
    const revisarTrue: string[] = [];
    const revisarFalse: string[] = [];
    const semNenhumaTrue: string[] = [];
    const semNenhumaFalse: string[] = [];
    for (const row of ((data as any[]) || [])) {
      const concluido = STATUS_CONCLUIDOS.includes(String((row as any).status || ""));
      const ok = concluido ? calcularSemPendencia(row) : false;
      (ok ? paraTrue : paraFalse).push((row as any).id);
      const revisar = concluido ? calcularRevisarListaMaterias(row) : false;
      (revisar ? revisarTrue : revisarFalse).push((row as any).id);
      const semNenhuma =
        concluido && !isNaoPrecisaFazer(row) ? semNenhumaMateriaDoDossie(row) : false;
      (semNenhuma ? semNenhumaTrue : semNenhumaFalse).push((row as any).id);
    }
    await updateEmLotes(paraTrue, true, agora);
    await updateEmLotes(paraFalse, false, agora);
    await updateRevisarEmLotes(revisarTrue, true);
    await updateRevisarEmLotes(revisarFalse, false);
    await updateSemNenhumaEmLotes(semNenhumaTrue, true);
    await updateSemNenhumaEmLotes(semNenhumaFalse, false);
  }
  invalidateDistribuicaoTstCache();
}
