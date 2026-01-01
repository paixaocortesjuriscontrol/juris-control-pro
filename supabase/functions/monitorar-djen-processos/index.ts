import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacoes';
const BATCH_SIZE = 50;
const MAX_PAGES_PER_PROCESSO = 5;

interface Processo {
  id: string;
  numero: string;
}

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

async function searchDJENByProcesso(numeroProcesso: string): Promise<any[]> {
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

    console.log('Iniciando monitoramento DJEN por processos cadastrados...');

    // Buscar configuração
    const { data: config } = await supabase
      .from('configuracoes_monitoramento')
      .select('*')
      .eq('tipo', 'djen_processos')
      .single();

    if (!config?.ativo) {
      return new Response(
        JSON.stringify({ success: true, message: 'Monitoramento desativado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar offset do metadata
    const metadata = config.metadata || {};
    const currentOffset = metadata.next_offset || 0;

    // Buscar processos ativos com monitoramento ativo
    const { data: processos, error: processosError } = await supabase
      .from('processos')
      .select('id, numero')
      .eq('status', 'ativo')
      .eq('monitorar_andamentos', true)
      .order('created_at', { ascending: true })
      .range(currentOffset, currentOffset + BATCH_SIZE - 1);

    if (processosError) {
      throw new Error(`Erro ao buscar processos: ${processosError.message}`);
    }

    if (!processos || processos.length === 0) {
      // Reset offset se não houver mais processos
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: new Date().toISOString(),
          metadata: { ...metadata, next_offset: 0, last_complete_run: new Date().toISOString() }
        })
        .eq('tipo', 'djen_processos');

      return new Response(
        JSON.stringify({ success: true, message: 'Ciclo completo, reiniciando', processados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${processos.length} processos (offset: ${currentOffset})`);

    let totalNovas = 0;
    let totalDuplicadas = 0;
    let processosComNovas = 0;

    for (const processo of processos) {
      try {
        const publicacoes = await searchDJENByProcesso(processo.numero);
        
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
              conteudo: conteudo.substring(0, 10000), // Limitar tamanho
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

        await delay(500); // Rate limiting entre processos
      } catch (error) {
        console.error(`Erro processando ${processo.numero}:`, error);
      }
    }

    // Atualizar offset para próxima execução
    const nextOffset = currentOffset + processos.length;
    const hasMore = processos.length === BATCH_SIZE;

    await supabase
      .from('configuracoes_monitoramento')
      .update({
        ultima_execucao: new Date().toISOString(),
        metadata: {
          ...metadata,
          next_offset: hasMore ? nextOffset : 0,
          last_batch_size: processos.length,
          last_complete_run: hasMore ? metadata.last_complete_run : new Date().toISOString()
        }
      })
      .eq('tipo', 'djen_processos');

    // Registrar no histórico
    await supabase
      .from('historico_monitoramento')
      .insert({
        tipo: 'djen_processos',
        processos_verificados: processos.length,
        novos_andamentos: totalNovas,
        processos_com_novos: processosComNovas,
        detalhes: {
          offset: currentOffset,
          duplicadas: totalDuplicadas,
          hasMore
        }
      });

    console.log(`Concluído: ${totalNovas} novas publicações, ${totalDuplicadas} duplicadas, ${processosComNovas} processos com novidades`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: processos.length,
        novas: totalNovas,
        duplicadas: totalDuplicadas,
        processosComNovas,
        hasMore,
        nextOffset: hasMore ? nextOffset : 0
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
