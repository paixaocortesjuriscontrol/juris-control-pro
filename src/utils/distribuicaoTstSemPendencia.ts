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
import { ensurePedidosPorDossie } from "@/utils/pedidosPorDossieCache";
import {
  fetchProntosRowsCached,
  invalidateDistribuicaoTstCache,
  COLUNAS_PRONTOS_COMPARTILHADAS,
} from "@/utils/distribuicaoTstCache";
import {
  getPendencias,
  isNaoPrecisaFazer,
  isMarcadoPronto,
} from "@/utils/distribuicaoTstPendencias";

const STATUS_CONCLUIDOS = ["pronto_envio", "planilhado", "enviado"];

/** Um registro está "sem pendência" quando é pronto e não falta nada. */
export function calcularSemPendencia(row: any): boolean {
  // Espelha a lógica do botão "Verificar Pendências": processos em outro
  // escritório, sob segredo de justiça ou CEJUSC não entram na conta, salvo
  // quando estão marcados como pronto (aí a situação impeditiva é pendência).
  if (!isMarcadoPronto(row) && isNaoPrecisaFazer(row)) return false;
  return getPendencias(row).length === 0;
}

async function updateEmLotes(ids: string[], valor: boolean, agora: string) {
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("dados_benner" as any)
      .update({ sem_pendencia: valor, pendencias_verificado_em: agora } as any)
      .in("id", slice);
    if (error) throw error;
  }
}

/**
 * Recalcula e grava o marcador para todos os processos com status concluído,
 * limpando marcações antigas de registros que saíram desse conjunto.
 */
export async function recalcularSemPendencia(): Promise<{
  analisados: number;
  semPendencia: number;
  atualizados: number;
}> {
  await ensureMateriasOficiais().catch(() => {});
  await ensurePedidosPorDossie().catch(() => {});
  invalidateDistribuicaoTstCache();

  const rows = await fetchProntosRowsCached();
  const agora = new Date().toISOString();
  const paraTrue: string[] = [];
  const paraFalse: string[] = [];
  let semPendencia = 0;

  for (const r of rows) {
    const ok = calcularSemPendencia(r);
    if (ok) semPendencia++;
    const atual = (r as any).sem_pendencia;
    if (ok && atual !== true) paraTrue.push((r as any).id);
    else if (!ok && atual !== false) paraFalse.push((r as any).id);
  }

  await updateEmLotes(paraTrue, true, agora);
  await updateEmLotes(paraFalse, false, agora);

  // Registros que deixaram de ser "prontos" mas continuavam marcados.
  const { error } = await supabase
    .from("dados_benner" as any)
    .update({ sem_pendencia: false, pendencias_verificado_em: agora } as any)
    .is("sem_pendencia", true)
    .not("status", "in", `(${STATUS_CONCLUIDOS.join(",")})`);
  if (error) throw error;

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
    await ensureMateriasOficiais().catch(() => {});
    await ensurePedidosPorDossie().catch(() => {});
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
    if ((count ?? 0) > 0) return;
    await recalcularSemPendencia();
  })()
    .catch(() => {})
    .finally(() => {
      backfillEmAndamento = null;
    });
  return backfillEmAndamento;
}

/**
 * Recalcula o marcador de vários registros (ex.: botão "Marcar Pronto" em
 * lote). Lê apenas as linhas informadas e grava o resultado.
 */
export async function atualizarSemPendenciaLote(ids: string[]): Promise<void> {
  const lista = ids.filter(Boolean);
  if (!lista.length) return;
  await ensureMateriasOficiais().catch(() => {});
  await ensurePedidosPorDossie().catch(() => {});
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
    for (const row of ((data as any[]) || [])) {
      const concluido = STATUS_CONCLUIDOS.includes(String((row as any).status || ""));
      const ok = concluido ? calcularSemPendencia(row) : false;
      (ok ? paraTrue : paraFalse).push((row as any).id);
    }
    await updateEmLotes(paraTrue, true, agora);
    await updateEmLotes(paraFalse, false, agora);
  }
  invalidateDistribuicaoTstCache();
}
