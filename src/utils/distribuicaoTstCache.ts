/**
 * Cache de curta duração compartilhado pela tela Distribuição TST.
 *
 * Motivo: vários hooks da tela (stats, prontos sem pendência, contagem por
 * responsável, revisar lista de matérias) faziam EXATAMENTE as mesmas
 * varreduras paginadas em `dados_benner` / `dados_benner_responsaveis` ao
 * mesmo tempo. Com ~26 mil linhas isso gerava ~100 requisições por abertura
 * de tela. Aqui cada varredura é executada uma única vez: chamadas
 * simultâneas compartilham a promise em voo e chamadas seguintes reaproveitam
 * o resultado por alguns segundos.
 *
 * Nada da regra de negócio muda — apenas deixamos de repetir a mesma consulta.
 */
import { supabase } from "@/integrations/supabase/client";
import { COLUNAS_SELECT_PRONTO_SEM_PENDENCIA } from "@/utils/distribuicaoTstPendencias";

const TTL_MS = 30_000;

interface Entry<T> {
  at: number;
  value?: T;
  inflight?: Promise<T>;
}

const store = new Map<string, Entry<any>>();

/** Executa `fn` no máximo uma vez por `key` dentro da janela de TTL. */
export function cachedAsync<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit) {
    if (hit.inflight) return hit.inflight;
    if (hit.value !== undefined && now - hit.at < TTL_MS) return Promise.resolve(hit.value);
  }
  const inflight = fn()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });
  store.set(key, { at: now, inflight });
  return inflight;
}

/** Descarta o cache (usar após gravações / botões de atualizar). */
export function invalidateDistribuicaoTstCache(): void {
  store.clear();
}

/**
 * Colunas usadas pelas duas varreduras de processos "prontos" (card
 * "Pronto sem pendência" e card "Revisar lista de matérias"). Unificadas para
 * que uma única leitura sirva aos dois.
 */
export const COLUNAS_PRONTOS_COMPARTILHADAS = Array.from(
  new Set([
    ...COLUNAS_SELECT_PRONTO_SEM_PENDENCIA,
    "id",
    "dossie",
    "recorrente",
    "materias_analise_reclamante",
    "materias_analise_banco",
    // Marcador persistido (para saber se precisa gravar de novo).
    "sem_pendencia",
  ]),
);

const STATUS_CONCLUIDOS = ["pronto_envio", "planilhado", "enviado"];

/**
 * Todas as linhas com status concluído (pronto_envio / planilhado / enviado),
 * já com o conjunto unificado de colunas. ~2 mil linhas.
 */
export function fetchProntosRowsCached(): Promise<any[]> {
  return cachedAsync("prontos-rows", async () => {
    const cols = COLUNAS_PRONTOS_COMPARTILHADAS.join(", ");
    const PAGE = 1000;
    const rows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("dados_benner" as any)
        .select(cols)
        .in("status", STATUS_CONCLUIDOS)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data as any[]) || [];
      rows.push(...page);
      if (page.length < PAGE) break;
      from += PAGE;
    }
    return rows;
  });
}

/**
 * Mapa `dados_benner_id` -> lista de `usuario_id`, carregado de uma vez.
 * Substitui as consultas em lotes de 500 IDs que cada hook fazia por conta.
 */
export function fetchResponsaveisPorItemCached(): Promise<Map<string, string[]>> {
  return cachedAsync("responsaveis-por-item", async () => {
    const mapa = new Map<string, string[]>();
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("dados_benner_responsaveis" as any)
        .select("dados_benner_id, usuario_id")
        .order("dados_benner_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data as any[]) || [];
      for (const r of rows) {
        if (!r?.dados_benner_id || !r?.usuario_id) continue;
        const atual = mapa.get(r.dados_benner_id);
        if (atual) atual.push(r.usuario_id);
        else mapa.set(r.dados_benner_id, [r.usuario_id]);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return mapa;
  });
}
