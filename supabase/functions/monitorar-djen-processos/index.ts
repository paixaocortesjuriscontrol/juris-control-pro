import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacoes';
const BATCH_SIZE = 50;
const MAX_PAGES_PER_PROCESSO = 10;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelay = 1000) {
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

async function searchDJENByProcesso(numeroProcesso: string, dataInicio?: string, dataFim?: string): Promise<any[]> {
  const results: any[] = [];
  const browserHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://comunica.pje.jus.br',
    'Referer': 'https://comunica.pje.jus.br/',
  };

  // Remove formatação do número do processo para busca
  const numeroLimpo = numeroProcesso.replace(/[^0-9]/g, '');
  
  try {
    for (let page = 1; page <= MAX_PAGES_PER_PROCESSO; page++) {
      const params = new URLSearchParams({
        texto: numeroLimpo,
        pagina: page.toString(),
        itensPorPagina: '100',
      });

      // Adicionar filtros de data se fornecidos
      if (dataInicio) {
        params.append('dataPublicacaoInicio', dataInicio);
      }
      if (dataFim) {
        params.append('dataPublicacaoFim', dataFim);
      }

      const response = await fetchWithRetry(
        `${PJE_COMUNICA_API}?${params.toString()}`,
        { method: 'GET', headers: browserHeaders }
      );

      if (!response.ok) {
        console.log(`Erro na busca do processo ${numeroProcesso}: ${response.status}`);
        break;
      }

      const data = await response.json();
      const items = data.items || data.content || [];
      
      if (items.length === 0) break;
      
      results.push(...items);
      
      const totalPages = data.totalPages || Math.ceil((data.totalElements || 0) / 100);
      if (page >= totalPages) break;
      
      await delay(300); // Rate limiting
    }
  } catch (error) {
    console.error(`Erro buscando processo ${numeroProcesso}:`, error);
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

    for (const processo of processos) {
      try {
        const publicacoes = await searchDJENByProcesso(processo.numero, dataInicio, dataFim);
        
        if (publicacoes.length === 0) continue;

        let novasDoProcesso = 0;

        for (const pub of publicacoes) {
          const conteudo = pub.texto || pub.teor || pub.conteudo || '';
          if (!conteudo) continue;

          const hash = generateHash(conteudo);

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

          // Inserir nova publicação
          const { error: insertError } = await supabase
            .from('publicacoes_djen_processos')
            .insert({
              processo_id: processo.id,
              processo_numero: processo.numero,
              conteudo: conteudo.substring(0, 10000),
              data_publicacao: pub.dataPublicacao || pub.data || null,
              fonte: pub.siglaTribunal || pub.tribunal || 'DJEN',
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

        await delay(400); // Rate limiting entre processos
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
          totalProcessos
        }
      });

    console.log(`Lote concluído: ${totalNovas} novas, ${totalDuplicadas} duplicadas, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: processos.length,
        novas: totalNovas,
        duplicadas: totalDuplicadas,
        processosComNovas,
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
