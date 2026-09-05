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
