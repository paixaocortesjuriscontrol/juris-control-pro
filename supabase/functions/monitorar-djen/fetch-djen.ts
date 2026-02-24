// ============================================================================
// FETCH DJEN RESULTS MODULE for monitorar-djen
// ============================================================================

import { delay, fetchWithRetry } from "./utils.ts";
import { fetchViaProxy } from "./proxy.ts";
import { browserHeaders, PJE_COMUNICA_API } from "./tribunais.ts";
import { INTER_PAGE_DELAY_MS } from "./config.ts";

export interface SearchParams {
  texto?: string;
  numeroOab?: string;
  ufOab?: string;
  nomeAdvogado?: string;
  siglaTribunal?: string | null;
  dataInicio?: string;
  dataFim?: string;
}

export async function fetchDJENResultsWithStats(
  params: SearchParams,
  options: { scheduled?: boolean } = {},
  onItems?: (items: any[]) => Promise<void> | void
): Promise<{ itemsCount: number; pages: number }> {
  let page = 0;
  let itemsCount = 0;
  const maxPages = params.texto ? 5 : 20;

  const now = new Date();
  const todayBrasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dataHoje = todayBrasilia.toISOString().split('T')[0];

  const yesterdayBrasilia = new Date(todayBrasilia);
  yesterdayBrasilia.setDate(yesterdayBrasilia.getDate() - 1);
  const dataOntem = yesterdayBrasilia.toISOString().split('T')[0];

  const defaultInicio = dataOntem;
  const defaultFim = dataHoje;

  while (page < maxPages) {
    const queryParams = new URLSearchParams();

    if (params.texto) {
      queryParams.set('texto', params.texto);
    }

    if (params.numeroOab) {
      queryParams.set('numeroOab', params.numeroOab);
      console.log(`[OAB Search] Using native numeroOab=${params.numeroOab}`);
    }
    if (params.ufOab) {
      queryParams.set('ufOab', params.ufOab);
      console.log(`[OAB Search] Using native ufOab=${params.ufOab}`);
    }
    if (params.nomeAdvogado) {
      queryParams.set('nomeAdvogado', params.nomeAdvogado);
      console.log(`[Advogado Search] Using nomeAdvogado="${params.nomeAdvogado}"`);
    }

    if (params.siglaTribunal) queryParams.set('siglaTribunal', params.siglaTribunal);

    const dataInicio = params.dataInicio || defaultInicio;
    const dataFim = params.dataFim || defaultFim;

    queryParams.set('dataDisponibilizacaoInicio', dataInicio);
    queryParams.set('dataDisponibilizacaoFim', dataFim);
    queryParams.set('pagina', page.toString());
    queryParams.set('itensPorPagina', '50');

    const url = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
    console.log(`Fetching: ${url}`);

    try {
      const response = await fetchWithRetry(url, { headers: browserHeaders }, 3, 2000);
      const contentType = response.headers.get('content-type') || '';

      let data: any | null = null;

      if (!response.ok || contentType.includes('text/html')) {
        const bodyPreview = await response.text().catch(() => '');
        console.error(`API blocked/error: status=${response.status} content-type=${contentType} preview=${bodyPreview.slice(0, 200)}`);

        data = await fetchViaProxy(url);
        if (!data) break;
      } else {
        data = await response.json();
      }

      const items = data?.comunicacoes || data?.items || data || [];

      if (Array.isArray(items) && items.length > 0) {
        itemsCount += items.length;
        if (onItems) {
          await onItems(items);
        }
        page++;
        await delay(INTER_PAGE_DELAY_MS);
      } else {
        break;
      }
    } catch (error) {
      console.error(`Fetch error:`, error);
      break;
    }
  }

  return { itemsCount, pages: page };
}
