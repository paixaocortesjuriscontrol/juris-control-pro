/**
 * Cache em memória dos pedidos cadastrados por dossiê (`pedidos_por_dossie`),
 * importados pela planilha "Pedidos por dossiê".
 *
 * As funções de pendência (`distribuicaoTstPendencias.ts`) e a geração da
 * Carga Benner são síncronas, por isso o mapa precisa estar carregado antes.
 * Enquanto não estiver, `pedidosDoDossieSync` devolve `null` (sem lista para
 * comparar → comportamento atual preservado).
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeMateriaNome } from "./outraMateria";

let cache: Map<string, Set<string>> | null = null;
/** dossiê -> (pedido normalizado -> pedido com a grafia exata do cadastro) */
let nomesCache: Map<string, Map<string, string>> | null = null;
let inflight: Promise<Map<string, Set<string>>> | null = null;

export function pedidosPorDossieCarregados(): boolean {
  return cache !== null && cache.size > 0;
}

const STORAGE_KEY = "ppd-v1";
/** Página da RPC agrupada. 8 mil dossiês cabem em ~3 páginas paralelas. */
const RPC_PAGE = 3000;
/** Páginas disparadas em paralelo por rodada. */
const PARALELO = 4;

export function resetPedidosPorDossie(): void {
  cache = null;
  nomesCache = null;
  inflight = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
}

/** Linha agrupada por dossiê devolvida pela RPC / persistida na sessão. */
interface LinhaAgrupada {
  dossie: string;
  pedidos: string[] | null;
  pedidos_normalizados: string[] | null;
}

function montarMapas(linhas: LinhaAgrupada[]): {
  mapa: Map<string, Set<string>>;
  nomes: Map<string, Map<string, string>>;
} {
  const mapa = new Map<string, Set<string>>();
  const nomes = new Map<string, Map<string, string>>();
  for (const linha of linhas) {
    const dossie = String(linha?.dossie || "").trim();
    if (!dossie) continue;
    const pedidos = linha?.pedidos || [];
    const normalizados = linha?.pedidos_normalizados || [];
    const set = mapa.get(dossie) || new Set<string>();
    const nm = nomes.get(dossie) || new Map<string, string>();
    for (let i = 0; i < pedidos.length; i++) {
      const original = String(pedidos[i] || "").trim();
      const norm = String(normalizados[i] || "") || normalizeMateriaNome(original);
      if (!norm) continue;
      set.add(norm);
      if (original && !nm.has(norm)) nm.set(norm, original);
    }
    if (set.size > 0) mapa.set(dossie, set);
    if (nm.size > 0) nomes.set(dossie, nm);
  }
  return { mapa, nomes };
}

function lerDaSessao(): LinhaAgrupada[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as LinhaAgrupada[]) : null;
  } catch {
    return null;
  }
}

function gravarNaSessao(linhas: LinhaAgrupada[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(linhas));
  } catch {
    /* quota / modo privado: apenas ignora */
  }
}

async function buscarPaginaAgrupada(offset: number): Promise<LinhaAgrupada[]> {
  const { data, error } = await (supabase as any).rpc("get_pedidos_por_dossie_agrupados", {
    p_offset: offset,
    p_limit: RPC_PAGE,
  });
  if (error) throw error;
  return ((data as LinhaAgrupada[]) || []);
}

/** Carrega (uma única vez) o mapa dossiê -> Set de pedidos normalizados. */
export function ensurePedidosPorDossie(): Promise<Map<string, Set<string>>> {
  if (cache && cache.size > 0) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    // 1) Sessão: evita refazer a carga ao trocar filtros ou voltar à tela.
    const salvo = lerDaSessao();
    if (salvo) {
      const { mapa, nomes } = montarMapas(salvo);
      if (mapa.size > 0) {
        cache = mapa;
        nomesCache = nomes;
        inflight = null;
        return mapa;
      }
    }

    // 2) RPC agrupada por dossiê (uma linha por dossiê), em páginas paralelas.
    const linhas: LinhaAgrupada[] = [];
    const primeira = await buscarPaginaAgrupada(0);
    linhas.push(...primeira);
    let offset = primeira.length;
    let completo = primeira.length < RPC_PAGE;
    while (!completo) {
      const offsets: number[] = [];
      for (let i = 0; i < PARALELO; i++) offsets.push(offset + i * RPC_PAGE);
      const paginas = await Promise.all(offsets.map((o) => buscarPaginaAgrupada(o)));
      for (const pagina of paginas) {
        linhas.push(...pagina);
        if (pagina.length < RPC_PAGE) completo = true;
      }
      offset += PARALELO * RPC_PAGE;
    }

    const { mapa, nomes } = montarMapas(linhas);
    if (mapa.size > 0) {
      cache = mapa;
      nomesCache = nomes;
      gravarNaSessao(linhas);
    }
    inflight = null;
    return mapa;
  })().catch((e) => {
    inflight = null;
    throw e;
  });
  return inflight;
}

/**
 * Grafia exata cadastrada em `pedidos_por_dossie` para a matéria informada,
 * ou `null` quando o cache não carregou ou a matéria não consta na lista.
 */
export function nomeCanonicoDoDossieSync(
  dossie: string | null | undefined,
  materia: string | null | undefined,
): string | null {
  if (!nomesCache || nomesCache.size === 0) return null;
  const key = String(dossie || "").trim();
  if (!key) return null;
  const nm = nomesCache.get(key);
  if (!nm) return null;
  return nm.get(normalizeMateriaNome(materia)) || null;
}


/**
 * Pedidos cadastrados para o dossiê, ou `null` quando o cache não carregou
 * ou o dossiê não tem lista cadastrada (nesses casos não há o que comparar).
 */
export function pedidosDoDossieSync(
  dossie: string | null | undefined,
): Set<string> | null {
  if (!cache || cache.size === 0) return null;
  const key = String(dossie || "").trim();
  if (!key) return null;
  const set = cache.get(key);
  return set && set.size > 0 ? set : null;
}

/** A matéria consta na lista de pedidos do dossiê? (sem lista → `true`) */
export function isMateriaDoDossieSync(
  dossie: string | null | undefined,
  materia: string | null | undefined,
): boolean {
  const set = pedidosDoDossieSync(dossie);
  if (!set) return true;
  return set.has(normalizeMateriaNome(materia));
}
