import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

interface BackfillJob {
  id: string;
  data_inicio: string;
  data_fim: string;
  monitoramento_id?: string;
  status: string;
  progresso: {
    processados: number;
    total: number;
    novas: number;
    descartadas: number;
    duplicadas: number;
    erros: number;
  };
  logs: string[];
}

interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  exclusoes?: string[];
  condicao_concomitante?: string;
  descricao?: string;
}

const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function generateGlobalHash(conteudo: string, dataPublicacao: string): string {
  const normalized = (conteudo + dataPublicacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
}

function shouldExclude(conteudo: string, exclusoes: string[]): string | null {
  if (!exclusoes || exclusoes.length === 0) return null;
  const conteudoUpper = conteudo.toUpperCase();
  for (const termo of exclusoes) {
    if (conteudoUpper.includes(termo.toUpperCase())) return termo;
  }
  return null;
}

function matchesCondicaoConcomitante(conteudo: string, condicao: string | undefined): boolean {
  if (!condicao) return true;
  const conteudoUpper = conteudo.toUpperCase();
  const termos = condicao.split(',').map(t => t.trim().toUpperCase());
  return termos.every(termo => conteudoUpper.includes(termo));
}

async function fetchDJENResults(searchText: string, dataInicio: string, dataFim: string): Promise<any[]> {
  const queryParams = new URLSearchParams();
  queryParams.append("texto", searchText);
  queryParams.append("dataDisponibilizacaoInicio", dataInicio);
  queryParams.append("dataDisponibilizacaoFim", dataFim);
  
  const endpoints = [
    `${PJE_COMUNICA_API}/comunicacao`,
    `${PJE_COMUNICA_API}/comunicacao/consulta`,
  ];
  
  for (const endpoint of endpoints) {
    try {
      await delay(Math.random() * 500 + 300);
      
      const response = await fetch(`${endpoint}?${queryParams.toString()}`, {
        method: "GET",
        headers: browserHeaders,
      });

      if (response.ok) {
        const data = await response.json();
        const items = data.items || data.content || data.comunicacoes || data.publicacoes || [];
        return Array.isArray(items) ? items : [];
      }

      if (response.status === 422 || response.status === 404) return [];
      if (response.status === 429) {
        await delay(5000);
        continue;
      }
    } catch (error) {
      console.error(`Error on ${endpoint}:`, error);
    }
    await delay(1000);
  }
  return [];
}

async function processMonitoramento(
  supabase: any,
  monitoramento: Monitoramento,
  dataInicio: string,
  dataFim: string
): Promise<{ novas: number; descartadas: number; duplicadas: number }> {
  const stats = { novas: 0, descartadas: 0, duplicadas: 0 };
  
  const searchTerm = monitoramento.tipo === "processo" 
    ? monitoramento.termo_busca.replace(/\D/g, '')
    : monitoramento.termo_busca;
  
  const publications = await fetchDJENResults(searchTerm, dataInicio, dataFim);
  
  for (const pub of publications) {
    const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
    const dataPublicacao = pub.dataPublicacao || pub.dataDisponibilizacao || pub.dataDJe || dataInicio;
    const hashConteudo = generateHash(conteudo + dataPublicacao);
    const globalHash = generateGlobalHash(conteudo, dataPublicacao);

    const { data: existingGlobal } = await supabase
      .from('publicacoes_djen_global_hash')
      .select('id')
      .eq('hash_global', globalHash)
      .maybeSingle();

    if (existingGlobal) {
      stats.duplicadas++;
      continue;
    }

    if (!matchesCondicaoConcomitante(conteudo, monitoramento.condicao_concomitante)) continue;

    const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);
    
    if (motivoExclusao) {
      await supabase.from('publicacoes_djen_descartadas').insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        data_publicacao: dataPublicacao,
        processo_numero: pub.numeroProcesso || pub.processo || null,
        conteudo: conteudo,
        fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
        motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
      });

      await supabase.from('publicacoes_djen_global_hash').upsert({
        hash_global: globalHash,
        primeiro_monitoramento_id: monitoramento.id,
      }, { onConflict: 'hash_global', ignoreDuplicates: true });
      
      stats.descartadas++;
      continue;
    }

    const { data: insertedPub, error: insertError } = await supabase
      .from('publicacoes_djen')
      .insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        data_publicacao: dataPublicacao,
        processo_numero: pub.numeroProcesso || pub.processo || null,
        conteudo: conteudo,
        fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
        lida: false,
      })
      .select('id')
      .single();

    if (!insertError && insertedPub) {
      stats.novas++;
      await supabase.from('publicacoes_djen_global_hash').upsert({
        hash_global: globalHash,
        primeiro_monitoramento_id: monitoramento.id,
        publicacao_id: insertedPub.id,
      }, { onConflict: 'hash_global', ignoreDuplicates: true });
    }
  }
  
  return stats;
}

async function updateJobProgress(
  supabase: any, 
  jobId: string, 
  progresso: BackfillJob['progresso'], 
  log?: string
) {
  const updateData: any = { progresso };
  if (log) {
    const { data: job } = await supabase.from('backfill_jobs').select('logs').eq('id', jobId).single();
    const logs = [...(job?.logs || []), `[${new Date().toISOString()}] ${log}`].slice(-50);
    updateData.logs = logs;
  }
  await supabase.from('backfill_jobs').update(updateData).eq('id', jobId);
}

async function processBackfillJob(supabase: any, job: BackfillJob) {
  console.log(`Starting job ${job.id}: ${job.data_inicio} to ${job.data_fim}`);
  
  // Mark as running
  await supabase.from('backfill_jobs').update({ 
    status: 'running', 
    started_at: new Date().toISOString() 
  }).eq('id', job.id);

  const progresso = { processados: 0, total: 0, novas: 0, descartadas: 0, duplicadas: 0, erros: 0 };

  // Get monitoramentos
  let query = supabase.from('monitoramentos_djen').select('*').eq('ativo', true);
  if (job.monitoramento_id) {
    query = supabase.from('monitoramentos_djen').select('*').eq('id', job.monitoramento_id);
  }
  
  const { data: monitoramentos, error: monError } = await query;
  
  if (monError || !monitoramentos?.length) {
    await supabase.from('backfill_jobs').update({ 
      status: 'failed', 
      erro: monError?.message || 'Nenhum monitoramento encontrado',
      completed_at: new Date().toISOString()
    }).eq('id', job.id);
    return;
  }

  // Calculate total days
  const startDate = new Date(job.data_inicio);
  const endDate = new Date(job.data_fim);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  progresso.total = totalDays * monitoramentos.length;

  await updateJobProgress(supabase, job.id, progresso, `Iniciando: ${monitoramentos.length} monitoramentos, ${totalDays} dias`);

  // Process day by day
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Check if job was cancelled
    const { data: jobStatus } = await supabase
      .from('backfill_jobs')
      .select('status')
      .eq('id', job.id)
      .single();

    if (jobStatus?.status === 'cancelled') {
      await updateJobProgress(supabase, job.id, progresso, 'Job cancelado pelo usuário');
      return;
    }

    const dateStr = currentDate.toISOString().split('T')[0];
    
    for (const mon of monitoramentos) {
      try {
        const stats = await processMonitoramento(supabase, mon, dateStr, dateStr);
        
        progresso.processados++;
        progresso.novas += stats.novas;
        progresso.descartadas += stats.descartadas;
        progresso.duplicadas += stats.duplicadas;

        // Update progress every 5 iterations
        if (progresso.processados % 5 === 0) {
          await updateJobProgress(supabase, job.id, progresso);
        }

        await delay(500);
      } catch (error: any) {
        progresso.erros++;
        console.error(`Error on ${mon.id} for ${dateStr}:`, error);
      }
    }

    // Log daily progress
    await updateJobProgress(supabase, job.id, progresso, 
      `Dia ${dateStr}: +${progresso.novas} novas, ${progresso.duplicadas} duplicadas`
    );

    currentDate.setDate(currentDate.getDate() + 1);
    await delay(1000);
  }

  // Complete
  await supabase.from('backfill_jobs').update({ 
    status: 'completed',
    completed_at: new Date().toISOString(),
    progresso
  }).eq('id', job.id);

  await updateJobProgress(supabase, job.id, progresso, 
    `Concluído: ${progresso.novas} novas, ${progresso.descartadas} descartadas, ${progresso.duplicadas} duplicadas, ${progresso.erros} erros`
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { action, jobId, dataInicio, dataFim, monitoramentoId, criadoPor } = body;

    // Create new job
    if (action === 'create') {
      if (!dataInicio || !dataFim || !criadoPor) {
        return new Response(
          JSON.stringify({ error: "dataInicio, dataFim e criadoPor são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: newJob, error: createError } = await supabase
        .from('backfill_jobs')
        .insert({
          data_inicio: dataInicio,
          data_fim: dataFim,
          monitoramento_id: monitoramentoId || null,
          criado_por: criadoPor,
          status: 'pending',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Start processing in background using globalThis.EdgeRuntime
      const runtime = (globalThis as any).EdgeRuntime;
      if (runtime?.waitUntil) {
        runtime.waitUntil(processBackfillJob(supabase, newJob));
      } else {
        // Fallback: process without waiting
        processBackfillJob(supabase, newJob).catch(console.error);
      }

      return new Response(
        JSON.stringify({ success: true, job: newJob }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cancel job
    if (action === 'cancel' && jobId) {
      await supabase.from('backfill_jobs').update({ 
        status: 'cancelled',
        completed_at: new Date().toISOString()
      }).eq('id', jobId);

      return new Response(
        JSON.stringify({ success: true, message: 'Job cancelado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job status
    if (action === 'status' && jobId) {
      const { data: job, error } = await supabase
        .from('backfill_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, job }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List jobs
    if (action === 'list') {
      const { data: jobs, error } = await supabase
        .from('backfill_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, jobs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida. Use: create, cancel, status ou list" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
