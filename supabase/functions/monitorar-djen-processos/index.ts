import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use the correct PJE Comunica API endpoints
const PJE_COMUNICA_ENDPOINTS = [
  'https://comunicaapi.pje.jus.br/api/v1/comunicacao',
  'https://comunicaapi.pje.jus.br/api/v1/comunicacoes'
];
const BATCH_SIZE = 50;
const MAX_PAGES_PER_PROCESSO = 5;
const PAGE_SIZE = 100;

// Browser-like headers to avoid blocking
const browserHeaders = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://comunica.pje.jus.br',
  'Referer': 'https://comunica.pje.jus.br/',
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelay = 1500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, i);
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(baseDelay * Math.pow(2, i));
    }
  }
  throw new Error('Max retries exceeded');
}

function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function parseISODateOnly(dateStr: string): Date {
  // Force UTC to avoid timezone shifting the day
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function formatISODateOnlyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDateRanges(
  dataInicio?: string,
  dataFim?: string,
  maxRangeDays = 180
): Array<{ inicio: string; fim: string }> {
  if (!dataInicio || !dataFim) return [];

  const start = parseISODateOnly(dataInicio);
  const end = parseISODateOnly(dataFim);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const ranges: Array<{ inicio: string; fim: string }> = [];
  const maxMs = maxRangeDays * 24 * 60 * 60 * 1000;

  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    const chunkEnd = new Date(Math.min(cursor.getTime() + maxMs, end.getTime()));
    ranges.push({ inicio: formatISODateOnlyUTC(cursor), fim: formatISODateOnlyUTC(chunkEnd) });

    // next day after chunkEnd
    cursor = new Date(chunkEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  return ranges;
}

async function fetchDJENPages(
  endpoint: string,
  textoBusca: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<any[]> {
  const results: any[] = [];

  for (let page = 0; page < MAX_PAGES_PER_PROCESSO; page++) {
    const params = new URLSearchParams();
    params.append('texto', textoBusca);
    params.append('pagina', page.toString());
    params.append('tamanhoPagina', PAGE_SIZE.toString());

    // Alguns endpoints usam page/size
    params.append('page', page.toString());
    params.append('size', PAGE_SIZE.toString());

    if (dataInicio) params.append('dataDisponibilizacaoInicio', dataInicio);
    if (dataFim) params.append('dataDisponibilizacaoFim', dataFim);

    const fullUrl = `${endpoint}?${params.toString()}`;

    const response = await fetchWithRetry(fullUrl, {
      method: 'GET',
      headers: browserHeaders,
    });

    const contentType = response.headers.get('content-type') || '';

    // Se recebemos HTML, a API bloqueou a requisição
    if (contentType.includes('text/html')) {
      console.log(`Bloqueado (HTML) para "${textoBusca}" em ${endpoint}`);
      break;
    }

    // A API pode retornar 404 para "sem resultado" ou para endpoints específicos.
    // Vamos tratar 404 como "sem itens" para não abortar o fluxo.
    if (response.status === 404) {
      console.log(`404 (sem resultado) para "${textoBusca}"`);
      break;
    }

    if (response.status === 422) {
      console.log(`422 (provável filtro inválido) para "${textoBusca}"`);
      break;
    }

    if (!response.ok) {
      console.log(`Erro ${response.status} na busca de "${textoBusca}"`);
      break;
    }

    const data = await response.json();
    const items = data.items || data.content || data.comunicacoes || data.publicacoes || [];

    if (!Array.isArray(items) || items.length === 0) {
      break;
    }

    results.push(...items);

    const totalElements = data.totalElements || data.count || data.total;
    if (totalElements && results.length >= totalElements) break;
    if (items.length < PAGE_SIZE) break;

    await delay(300);
  }

  return results;
}

async function searchDJENByProcesso(
  numeroProcesso: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<any[]> {
  const results: any[] = [];
  const textoBusca = numeroProcesso;

  console.log(`Buscando publicações para processo: ${textoBusca}`);

  // A Comunica API costuma limitar intervalos grandes. Se o usuário mandar um ano inteiro,
  // quebramos em blocos (ex.: 180 dias) para evitar retorno vazio.
  const ranges = buildDateRanges(dataInicio, dataFim, 180);
  const rangesToUse = ranges.length > 0 ? ranges : [{ inicio: dataInicio, fim: dataFim }];

  for (const endpoint of PJE_COMUNICA_ENDPOINTS) {
    try {
      for (const range of rangesToUse) {
        if (range.inicio && range.fim) {
          console.log(`Processo ${numeroProcesso}: intervalo ${range.inicio} a ${range.fim}`);
        }

        const items = await fetchDJENPages(endpoint, textoBusca, range.inicio, range.fim);

        if (items.length > 0) {
          console.log(`Processo ${numeroProcesso}: ${items.length} itens no endpoint ${endpoint}`);
          results.push(...items);
        }

        // Rate limiting entre intervalos
        await delay(250);
      }

      // Se achou algo em algum endpoint, não precisa tentar os outros
      if (results.length > 0) break;
    } catch (error) {
      console.error(`Erro com endpoint ${endpoint} para ${numeroProcesso}:`, error);
      continue;
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parâmetros opcionais
    let dataInicio: string | undefined;
    let dataFim: string | undefined;
    let continuarDe: number | undefined;

    try {
      const body = await req.json();
      dataInicio = body.dataInicio;
      dataFim = body.dataFim;
      continuarDe = body.continuarDe;
    } catch {
      // Sem body, usa valores padrão
    }

    // Se não tiver datas, busca só do dia atual
    if (!dataInicio && !dataFim) {
      const hoje = new Date().toISOString().split('T')[0];
      dataInicio = hoje;
      dataFim = hoje;
    }

    console.log(`Monitoramento DJEN por processos: ${dataInicio} a ${dataFim}`);

    // Buscar configuração
    const { data: config } = await supabase
      .from('configuracoes_monitoramento')
      .select('*')
      .eq('tipo', 'djen_processos')
      .single();

    // Contar total de processos para monitorar
    const { count: totalProcessos } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo')
      .eq('monitorar_andamentos', true);

    const offset = continuarDe || 0;

    // Buscar lote de processos
    const { data: processos, error: processosError } = await supabase
      .from('processos')
      .select('id, numero')
      .eq('status', 'ativo')
      .eq('monitorar_andamentos', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (processosError) {
      throw new Error(`Erro ao buscar processos: ${processosError.message}`);
    }

    if (!processos || processos.length === 0) {
      // Ciclo completo
      if (config) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            ultima_execucao: new Date().toISOString(),
            metadata: { 
              ...(config.metadata || {}), 
              last_complete_run: new Date().toISOString(),
              next_offset: 0 
            }
          })
          .eq('tipo', 'djen_processos');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Ciclo completo', 
          processados: 0,
          totalProcessos: totalProcessos || 0,
          concluido: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando lote: ${processos.length} processos (offset: ${offset}, total: ${totalProcessos})`);

    let totalNovas = 0;
    let totalDuplicadas = 0;
    let processosComNovas = 0;
    let processosComResultados = 0;

    for (const processo of processos) {
      try {
        const publicacoes = await searchDJENByProcesso(processo.numero, dataInicio, dataFim);

        if (publicacoes.length > 0) {
          processosComResultados++;
        }

        let novasDoProcesso = 0;
        const seenHashes = new Set<string>();

        for (const pub of publicacoes) {
          const conteudo =
            pub.texto ??
            pub.teor ??
            pub.conteudo ??
            pub.conteudoPublicacao ??
            pub.resumo ??
            '';

          if (!conteudo || typeof conteudo !== 'string') continue;

          const hash = generateHash(conteudo);
          if (seenHashes.has(hash)) continue;
          seenHashes.add(hash);

          // Verificar se já existe
          const { data: existing } = await supabase
            .from('publicacoes_djen_processos')
            .select('id')
            .eq('processo_id', processo.id)
            .eq('hash_conteudo', hash)
            .maybeSingle();

          if (existing) {
            totalDuplicadas++;
            continue;
          }

          const rawDataPublicacao =
            pub.dataPublicacao ??
            pub.dataDisponibilizacao ??
            pub.data_publicacao ??
            pub.data ??
            null;

          const dataPublicacao = typeof rawDataPublicacao === 'string'
            ? rawDataPublicacao
            : null;

          const fonte =
            pub.siglaTribunal ??
            pub.tribunal ??
            pub.orgao ??
            pub.fonte ??
            'DJEN';

          // Inserir nova publicação
          const { error: insertError } = await supabase
            .from('publicacoes_djen_processos')
            .insert({
              processo_id: processo.id,
              processo_numero: processo.numero,
              conteudo: conteudo.substring(0, 10000),
              data_publicacao: dataPublicacao,
              fonte,
              hash_conteudo: hash,
            });

          if (!insertError) {
            totalNovas++;
            novasDoProcesso++;
          }
        }

        if (novasDoProcesso > 0) {
          processosComNovas++;
        }

        await delay(500); // Rate limiting entre processos
      } catch (error) {
        console.error(`Erro processando ${processo.numero}:`, error);
      }
    }

    const nextOffset = offset + processos.length;
    const hasMore = nextOffset < (totalProcessos || 0);

    // Atualizar metadata
    if (config) {
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: new Date().toISOString(),
          metadata: {
            ...(config.metadata || {}),
            next_offset: hasMore ? nextOffset : 0,
            last_batch_size: processos.length,
            last_complete_run: hasMore ? (config.metadata as any)?.last_complete_run : new Date().toISOString()
          }
        })
        .eq('tipo', 'djen_processos');
    }

    // Registrar no histórico
    await supabase
      .from('historico_monitoramento')
      .insert({
        tipo: 'djen_processos',
        processos_verificados: processos.length,
        novos_andamentos: totalNovas,
        processos_com_novos: processosComNovas,
        detalhes: {
          offset,
          duplicadas: totalDuplicadas,
          hasMore,
          dataInicio,
          dataFim,
          totalProcessos,
          processosComResultados
        }
      });

    console.log(`Lote concluído: ${totalNovas} novas, ${totalDuplicadas} duplicadas, ${processosComResultados} com resultados, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: processos.length,
        novas: totalNovas,
        duplicadas: totalDuplicadas,
        processosComNovas,
        processosComResultados,
        hasMore,
        nextOffset: hasMore ? nextOffset : 0,
        totalProcessos: totalProcessos || 0,
        concluido: !hasMore
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Erro no monitoramento:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
