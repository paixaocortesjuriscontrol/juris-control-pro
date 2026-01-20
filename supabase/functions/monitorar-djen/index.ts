import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

// Max monitoramentos per invocation.
const MAX_PER_INVOCATION = 10;

// Soft time limit (ms) to ensure we respond before the platform/browser cuts the request.
// Importante: precisamos reservar um buffer para salvar metadados e enfileirar o próximo lote.
const SOFT_TIMEOUT_MS = 55_000;
const FINALIZATION_BUFFER_MS = 12_000;

// Retry config: if first batch at 09:00 is empty, retry after this delay
const RETRY_DELAY_MINUTES = 15;
const MAX_RETRIES = 4; // Total max retries for empty result

interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  criado_por: string;
  coordenacao_id?: string;
  exclusoes?: string[];
  condicao_concomitante?: string;
  tribunais?: string[];
  descricao?: string;
}

const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
};

// Jina Reader proxy (fast and cheap fallback)
const JINA_READER_URL = "https://r.jina.ai";
const JINA_API_KEY = Deno.env.get('JINA_API_KEY') || '';

// Bright Data API Token (residential IP fallback)
const BRIGHT_DATA_TOKEN = Deno.env.get('BRIGHT_DATA_AUTH') || '';

function tryParseDjenJson(text: string): any | null {
  // 1) Direct JSON
  try {
    const data = JSON.parse(text);

    // Bright Data may wrap the response in { body: "..." }
    if (data?.body) {
      try {
        const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        if (bodyData && (bodyData.comunicacoes || bodyData.items || Array.isArray(bodyData))) {
          return bodyData;
        }
      } catch {
        // ignore
      }
    }

    if (data && (data.comunicacoes || data.items || Array.isArray(data))) {
      return data;
    }
  } catch {
    // ignore
  }

  // 2) Sometimes Jina returns a text wrapper; try to extract the JSON object containing "comunicacoes"
  const jsonMatch = text.match(/\{[\s\S]*"comunicacoes"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // ignore
    }
  }

  return null;
}

// Fetch via Bright Data REST API - Residential IP BR (fallback when comunicaapi blocks)
async function fetchViaBrightData(url: string): Promise<any | null> {
  if (!BRIGHT_DATA_TOKEN) {
    console.log('[DJEN] BRIGHT_DATA_AUTH not configured');
    return null;
  }

  try {
    console.log('[DJEN] Trying Bright Data (residential IP)...');

    const brightDataUrl = 'https://api.brightdata.com/request';
    const requestPayload = {
      zone: 'juris_control',
      url,
      country: 'br',
      format: 'raw',
    };

    const resp = await fetch(brightDataUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIGHT_DATA_TOKEN}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.log(`[DJEN] Bright Data API error ${resp.status}: ${errText.slice(0, 500)}`);
      return null;
    }

    const text = await resp.text();
    const parsed = tryParseDjenJson(text);

    if (parsed) {
      console.log('[DJEN] ✓ Bright Data success!');
      return parsed;
    }

    console.log('[DJEN] Bright Data returned non-JSON:', text.slice(0, 300));
    return null;
  } catch (e) {
    console.log('[DJEN] Bright Data fetch failed:', e);
    return null;
  }
}

// Fast Jina proxy fallback (cheap and fast - ~$0.001/request)
async function fetchJsonViaJina(url: string): Promise<any | null> {
  if (!JINA_API_KEY) {
    console.log('[DJEN] JINA_API_KEY not configured');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    console.log('[DJEN] Trying Jina proxy fallback...');
    const jinaUrl = `${JINA_READER_URL}/${url}`;

    const resp = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.log(`[DJEN] Jina proxy error ${resp.status}: ${t.slice(0, 200)}`);
      return null;
    }

    const text = await resp.text();
    const parsed = tryParseDjenJson(text);

    if (parsed) {
      console.log('[DJEN] ✓ Jina proxy success!');
      return parsed;
    }

    console.log('[DJEN] Jina proxy returned non-JSON:', text.slice(0, 300));
    return null;
  } catch (e) {
    console.log('[DJEN] Jina proxy fetch failed:', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Unified proxy fetch: tries Bright Data first, then Jina as fallback
async function fetchViaProxy(url: string): Promise<any | null> {
  if (BRIGHT_DATA_TOKEN) {
    const result = await fetchViaBrightData(url);
    if (result) {
      console.log('[DJEN] ✓ Bright Data residential IP worked!');
      return result;
    }
  }

  if (JINA_API_KEY) {
    return await fetchJsonViaJina(url);
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 2,
  baseDelay = 1500
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited. Waiting ${waitTime}ms (retry ${attempt + 1})`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const waitTime = baseDelay * Math.pow(2, attempt);
      console.log(`Fetch error, waiting ${waitTime}ms:`, error);
      await delay(waitTime);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

function extractProcessoNumero(conteudo: string, explicitNumero?: string | null): string | null {
  if (explicitNumero) return explicitNumero;
  
  const patterns = [
    /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/,
    /Processo\s*(?:n[º°]?\.?\s*)?(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i,
    /(\d{7}\/\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = conteudo.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
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

async function criarTarefasParaResponsaveis(
  supabase: any,
  processoNumero: string,
  titulo: string,
  descricao: string,
  dataVencimento: string,
  prioridade: string,
  origem: string,
  tipoTarefa: string,
  publicacaoId?: string
): Promise<string[]> {
  const { data: processo } = await supabase
    .from('processos')
    .select('id, advogado_responsavel_id')
    .eq('numero', processoNumero)
    .single();

  if (!processo) {
    console.log(`Process not found for number ${processoNumero}, cannot create task`);
    return [];
  }

  const { data: responsaveis } = await supabase
    .from('processos_responsaveis')
    .select('responsavel_id')
    .eq('processo_id', processo.id);

  if (!responsaveis || responsaveis.length === 0) {
    if (processo.advogado_responsavel_id) {
      const { data: tarefa, error } = await supabase
        .from('tarefas')
        .insert({
          processo_id: processo.id,
          responsavel_id: processo.advogado_responsavel_id,
          criado_por: processo.advogado_responsavel_id,
          titulo,
          descricao,
          data_vencimento: dataVencimento,
          prioridade,
          status: 'pendente',
          origem,
          tipo_tarefa: tipoTarefa,
        })
        .select('id')
        .single();

      if (!error && tarefa) {
        console.log(`Created task ${tarefa.id} for legacy responsible`);
        
        if (publicacaoId) {
          await supabase
            .from('tarefas_publicacoes')
            .insert({
              tarefa_id: tarefa.id,
              publicacao_id: publicacaoId,
            });
        }
        
        return [tarefa.id];
      }
    }
    return [];
  }

  const tarefaIds: string[] = [];
  for (const resp of responsaveis) {
    const { data: tarefa, error } = await supabase
      .from('tarefas')
      .insert({
        processo_id: processo.id,
        responsavel_id: resp.responsavel_id,
        criado_por: resp.responsavel_id,
        titulo,
        descricao,
        data_vencimento: dataVencimento,
        prioridade,
        status: 'pendente',
        origem,
        tipo_tarefa: tipoTarefa,
      })
      .select('id')
      .single();

    if (!error && tarefa) {
      tarefaIds.push(tarefa.id);
      
      if (publicacaoId) {
        await supabase
          .from('tarefas_publicacoes')
          .insert({
            tarefa_id: tarefa.id,
            publicacao_id: publicacaoId,
          });
      }
    }
  }

  if (tarefaIds.length > 0) {
    console.log(`Created ${tarefaIds.length} tasks for process ${processoNumero}`);
  }
  return tarefaIds;
}

function generateGlobalHash(conteudo: string, dataPublicacao: string): string {
  const normalized = (conteudo + dataPublicacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
}

function shouldExclude(conteudo: string, exclusoes: string[]): string | null {
  if (!exclusoes || exclusoes.length === 0) return null;
  
  const conteudoUpper = conteudo.toUpperCase();
  for (const termo of exclusoes) {
    if (conteudoUpper.includes(termo.toUpperCase())) {
      return termo;
    }
  }
  return null;
}

function matchesCondicaoConcomitante(conteudo: string, condicao: string | undefined): boolean {
  if (!condicao) return true;
  
  const conteudoUpper = conteudo.toUpperCase();
  const termos = condicao.split(',').map(t => t.trim().toUpperCase());
  
  return termos.every(termo => conteudoUpper.includes(termo));
}

interface AudienciaInfo {
  dataAudiencia: string | null;
  tipoAudiencia: string | null;
  localAudiencia: string | null;
  contexto: string;
}

function detectAudiencia(conteudo: string): AudienciaInfo | null {
  const conteudoLower = conteudo.toLowerCase();
  
  const audienciaTerms = [
    'audiência',
    'audiencia',
    'sessão de julgamento',
    'sessao de julgamento',
    'pauta de julgamento',
  ];
  
  const hasAudiencia = audienciaTerms.some(term => conteudoLower.includes(term));
  if (!hasAudiencia) return null;
  
  let contexto = '';
  for (const term of audienciaTerms) {
    const index = conteudoLower.indexOf(term);
    if (index !== -1) {
      const start = Math.max(0, index - 100);
      const end = Math.min(conteudo.length, index + term.length + 200);
      contexto = (start > 0 ? '...' : '') + 
                 conteudo.slice(start, end) + 
                 (end < conteudo.length ? '...' : '');
      break;
    }
  }
  
  let dataAudiencia: string | null = null;
  
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = contexto.match(pattern);
    if (match) {
      if (match[2] && isNaN(parseInt(match[2]))) {
        const months: Record<string, string> = {
          'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
          'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
          'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        const month = months[match[2].toLowerCase()] || '01';
        dataAudiencia = `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
      } else {
        dataAudiencia = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
      break;
    }
  }
  
  let tipoAudiencia: string | null = null;
  const tipoPatterns = [
    /audiência\s+de\s+(conciliação|instrução|julgamento|instrução e julgamento|una|inicial|custódia)/i,
    /audiencia\s+de\s+(conciliacao|instrucao|julgamento|instrucao e julgamento|una|inicial|custodia)/i,
  ];
  
  for (const pattern of tipoPatterns) {
    const match = conteudo.match(pattern);
    if (match) {
      tipoAudiencia = match[1];
      break;
    }
  }
  
  let localAudiencia: string | null = null;
  const localPatterns = [
    /(?:local|sala|endereço|endereco|forum|fórum)[\s:]+([^,\n]{10,60})/i,
    /(?:na|no|em)\s+(?:sala|fórum|forum)\s+([^,\n]{5,50})/i,
  ];
  
  for (const pattern of localPatterns) {
    const match = conteudo.match(pattern);
    if (match) {
      localAudiencia = match[1].trim();
      break;
    }
  }
  
  return {
    dataAudiencia,
    tipoAudiencia,
    localAudiencia,
    contexto,
  };
}

interface TribunalStats {
  tribunal: string | null;
  paginas: number;
  resultados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
}

interface SearchParams {
  texto?: string;
  numeroOab?: string;
  ufOab?: string;
  nomeAdvogado?: string;
  siglaTribunal?: string | null;

  // Opcional: permitir controlar o intervalo de datas (yyyy-MM-dd) quando necessário.
  // Se não for informado, a função usa o "hoje" de Brasília e faz fallback para ontem
  // quando a API retornar vazio.
  dataInicio?: string;
  dataFim?: string;
}

async function processMonitoramento(
  supabase: any,
  monitoramento: Monitoramento,
  options: { scheduled?: boolean; dataInicio?: string; dataFim?: string } = {}
): Promise<{ novas: number; descartadas: number; duplicatas: number; tribunaisStats: TribunalStats[] }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const tribunaisStats: TribunalStats[] = [];
  const dataAtual = new Date().toISOString().split('T')[0];
  
  const searchCandidates: Array<Omit<SearchParams, 'siglaTribunal'>> = [];

  if (monitoramento.tipo === "advogado") {
    const termo = (monitoramento.termo_busca || "").trim();
    const hasNome = termo.length >= 3 && /[A-Za-zÀ-ÿ]/.test(termo);

    if (monitoramento.oab) {
      const uf = (monitoramento.uf || "DF").toUpperCase();
      const numeroOab = monitoramento.oab.replace(/\D/g, "");

      searchCandidates.push({ numeroOab, ufOab: uf });
      searchCandidates.push({ texto: `OAB ${uf}-${numeroOab}` });
      searchCandidates.push({ texto: `OAB ${numeroOab} ${uf}` });
      searchCandidates.push({ texto: numeroOab });
    }

    if (hasNome) {
      searchCandidates.push({ nomeAdvogado: termo });
      searchCandidates.push({ texto: termo });
    }

    console.log(
      `Advogado search candidates: oab=${monitoramento.oab || "(none)"}, uf=${(monitoramento.uf || "DF").toUpperCase()}, nome=${hasNome ? termo : "(none)"}`
    );
  } else if (monitoramento.tipo === "palavra-chave") {
    searchCandidates.push({ texto: monitoramento.termo_busca });
  } else if (monitoramento.tipo === "processo") {
    searchCandidates.push({ texto: monitoramento.termo_busca.replace(/\D/g, "") });
  } else if (monitoramento.tipo === "parte") {
    const termo = (monitoramento.termo_busca || "").trim();
    if (termo.length >= 3) {
      searchCandidates.push({ texto: termo });
      console.log(`Parte search: "${termo}"`);
    }
  }

  if (searchCandidates.length === 0) {
    console.log(`No search params for monitoramento ${monitoramento.id}`);
    return { ...stats, tribunaisStats };
  }

  const tribunais = monitoramento.tribunais && monitoramento.tribunais.length > 0
    ? monitoramento.tribunais
    : [null];

  console.log(`Searching tribunais: ${tribunais.length === 1 && tribunais[0] === null ? 'TODOS (sem filtro)' : tribunais.join(', ')}`);

  for (const tribunal of tribunais) {
    const tribunalStat: TribunalStats = {
      tribunal,
      paginas: 0,
      resultados: 0,
      novas: 0,
      descartadas: 0,
      duplicatas: 0,
    };

    let publications: any[] = [];
    let pages = 0;

    for (const candidate of searchCandidates) {
      const candidateLabel = candidate.numeroOab
        ? `numeroOab=${candidate.numeroOab}/${candidate.ufOab || ''}`
        : candidate.nomeAdvogado
          ? `nomeAdvogado="${candidate.nomeAdvogado}"`
          : candidate.texto
            ? `texto="${candidate.texto}"`
            : 'unknown';

      console.log(`[DJEN] Trying candidate ${candidateLabel} | tribunal=${tribunal || 'TODOS'} | período=${options.dataInicio || '-'}→${options.dataFim || '-'}`);

      const searchParams: SearchParams = { 
        ...candidate, 
        siglaTribunal: tribunal,
        dataInicio: options.dataInicio,
        dataFim: options.dataFim,
      };
      const result = await fetchDJENResultsWithStats(searchParams, { scheduled: options.scheduled === true });
      publications = result.items;
      pages = result.pages;
      if (publications.length > 0) break;
    }

    tribunalStat.paginas = pages;
    tribunalStat.resultados = publications.length;

    console.log(`Found ${publications.length} publications for tribunal ${tribunal} (${pages} pages)`);

    for (const pub of publications) {
      const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
      const hashConteudo = generateHash(conteudo + (pub.dataPublicacao || pub.dataDisponibilizacao || pub.data || ''));
      
      // A API pode retornar datas em diferentes campos dependendo do tribunal
      // dataDisponibilizacao = data em que foi disponibilizado no DJe (geralmente 1 dia antes da publicação)
      // dataPublicacao = data da publicação oficial (contagem de prazo começa aqui)
      const rawDataDisponibilizacao = pub.dataDisponibilizacao || pub.dataDJe || pub.dtDisponibilizacao || pub.dataDisp || null;
      const rawDataPublicacao = pub.dataPublicacao || pub.dataJornal || pub.dtPublicacao || pub.data || dataAtual;
      
      // Se só temos dataPublicacao, calcular dataDisponibilizacao como dia anterior
      // Se só temos dataDisponibilizacao, calcular dataPublicacao como dia seguinte
      let dataDisponibilizacao = rawDataDisponibilizacao;
      let dataPublicacao = rawDataPublicacao;
      
      if (!dataDisponibilizacao && dataPublicacao) {
        try {
          const pubDate = new Date(dataPublicacao);
          pubDate.setDate(pubDate.getDate() - 1);
          dataDisponibilizacao = pubDate.toISOString().split('T')[0];
        } catch { /* ignore */ }
      } else if (dataDisponibilizacao && !rawDataPublicacao) {
        try {
          const dispDate = new Date(dataDisponibilizacao);
          dispDate.setDate(dispDate.getDate() + 1);
          dataPublicacao = dispDate.toISOString().split('T')[0];
        } catch { /* ignore */ }
      }
      
      const globalHash = generateGlobalHash(conteudo, dataPublicacao);

      const { data: existingGlobal } = await supabase
        .from('publicacoes_djen_global_hash')
        .select('id')
        .eq('hash_global', globalHash)
        .maybeSingle();

      if (existingGlobal) {
        stats.duplicatas++;
        tribunalStat.duplicatas++;
        continue;
      }

      if (!matchesCondicaoConcomitante(conteudo, monitoramento.condicao_concomitante)) {
        continue;
      }

      const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);
      
      const processoNumero = extractProcessoNumero(conteudo, pub.numeroProcesso || pub.processo);
      
      if (motivoExclusao) {
        await supabase.from('publicacoes_djen_descartadas').insert({
          monitoramento_id: monitoramento.id,
          hash_conteudo: hashConteudo,
          conteudo,
          data_publicacao: dataPublicacao,
          data_disponibilizacao: dataDisponibilizacao,
          processo_numero: processoNumero,
          tribunal: tribunal || pub.siglaTribunal || null,
          motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
        });
        
        await supabase.from('publicacoes_djen_global_hash').insert({
          hash_global: globalHash,
          primeiro_monitoramento_id: monitoramento.id,
        });
        
        stats.descartadas++;
        tribunalStat.descartadas++;
        continue;
      }

      const { data: existing } = await supabase
        .from('publicacoes_djen')
        .select('id')
        .eq('hash_conteudo', hashConteudo)
        .eq('monitoramento_id', monitoramento.id)
        .maybeSingle();

      if (existing) {
        stats.duplicatas++;
        tribunalStat.duplicatas++;
        continue;
      }

      const { data: publicacao, error: insertError } = await supabase.from('publicacoes_djen').insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        conteudo,
        data_publicacao: dataPublicacao,
        data_disponibilizacao: dataDisponibilizacao,
        processo_numero: processoNumero,
        tribunal: tribunal || pub.siglaTribunal || null,
        polo_ativo: pub.nomeAdvogado || null,
        polo_passivo: pub.nomeParte || null,
      }).select('id').single();

      if (insertError) {
        console.error(`Insert error:`, insertError);
        continue;
      }

      await supabase.from('publicacoes_djen_global_hash').insert({
        hash_global: globalHash,
        primeiro_monitoramento_id: monitoramento.id,
        publicacao_id: publicacao.id,
      });

      stats.novas++;
      tribunalStat.novas++;

      const audienciaInfo = detectAudiencia(conteudo);
      if (audienciaInfo && processoNumero) {
        const { data: existingAudiencia } = await supabase
          .from('audiencias_detectadas')
          .select('id')
          .eq('publicacao_id', publicacao.id)
          .maybeSingle();

        if (!existingAudiencia) {
          await supabase.from('audiencias_detectadas').insert({
            processo_numero: processoNumero,
            monitoramento_id: monitoramento.id,
            publicacao_id: publicacao.id,
            tipo_audiencia: audienciaInfo.tipoAudiencia,
            data_audiencia: audienciaInfo.dataAudiencia,
            local_audiencia: audienciaInfo.localAudiencia,
            contexto: audienciaInfo.contexto,
            conteudo_publicacao: conteudo,
            origem: 'djen_monitoramento',
            status: 'pendente',
          });

          if (processoNumero) {
            const dataVencimento = audienciaInfo.dataAudiencia 
              ? new Date(new Date(audienciaInfo.dataAudiencia).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await criarTarefasParaResponsaveis(
              supabase,
              processoNumero,
              `AUDIÊNCIA ${audienciaInfo.tipoAudiencia || ''} - ${processoNumero}`,
              `Audiência detectada automaticamente.\n\nData: ${audienciaInfo.dataAudiencia || 'A definir'}\nLocal: ${audienciaInfo.localAudiencia || 'Não especificado'}\n\nContexto:\n${audienciaInfo.contexto}`,
              dataVencimento,
              'alta',
              'djen_monitoramento',
              'audiencia',
              publicacao.id
            );
          }
        }
      }
    }

    tribunaisStats.push(tribunalStat);
  }

  console.log(`Monitoramento ${monitoramento.id}: novas=${stats.novas}, descartadas=${stats.descartadas}, duplicatas=${stats.duplicatas}`);
  return { ...stats, tribunaisStats };
}

async function fetchDJENResultsWithStats(
  params: SearchParams,
  options: { scheduled?: boolean } = {}
): Promise<{ items: any[]; pages: number }> {
  const allResults: any[] = [];
  let page = 0;
  const maxPages = 10;

  const now = new Date();
  const todayBrasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dataHoje = todayBrasilia.toISOString().split('T')[0];

  // Importante: o parâmetro da API é dataDisponibilizacao (muitas vezes 1 dia antes da data_publicacao).
  // Para não perder publicações “virando o dia”, em execuções agendadas buscamos ontem->hoje por padrão.
  const yesterdayBrasilia = new Date(todayBrasilia);
  yesterdayBrasilia.setDate(yesterdayBrasilia.getDate() - 1);
  const dataOntem = yesterdayBrasilia.toISOString().split('T')[0];

  const defaultInicio = options.scheduled ? dataOntem : dataHoje;
  const defaultFim = dataHoje;

  while (page < maxPages) {
    const queryParams = new URLSearchParams();

    // A API PJE Comunica suporta parâmetros nativos para busca por OAB
    // ufOab e numeroOab são parâmetros válidos da API
    if (params.texto) {
      queryParams.set('texto', params.texto);
    }

    // Usar parâmetros nativos da API para OAB (não converter para texto)
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
      console.log(`[Advogado Search] Using native nomeAdvogado="${params.nomeAdvogado}"`);
    }

    if (params.siglaTribunal) queryParams.set('siglaTribunal', params.siglaTribunal);

    const dataInicio = params.dataInicio || defaultInicio;
    const dataFim = params.dataFim || defaultFim;

    queryParams.set('dataDisponibilizacaoInicio', dataInicio);
    queryParams.set('dataDisponibilizacaoFim', dataFim);
    queryParams.set('pagina', page.toString());
    queryParams.set('itensPorPagina', '100');

    const url = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
    console.log(`Fetching: ${url}`);

    try {
      const response = await fetchWithRetry(url, { headers: browserHeaders }, 3, 2000);
      const contentType = response.headers.get('content-type') || '';

      let data: any | null = null;

      // Se a API bloquear (403 ou HTML), tenta via proxy (Bright Data -> Jina)
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
        allResults.push(...items);
        page++;
        await delay(500);
      } else {
        break;
      }
    } catch (error) {
      console.error(`Fetch error:`, error);
      break;
    }
  }

  return { items: allResults, pages: page };
}


// Helper to ensure djen_runs record exists before saving lotes
async function ensureRunExists(
  supabase: any,
  runId: string,
  total: number,
  retryCount: number
): Promise<boolean> {
  try {
    // Check if run already exists
    const { data: existingRun } = await supabase
      .from('djen_runs')
      .select('id')
      .eq('run_id', runId)
      .maybeSingle();

    if (existingRun) {
      return true;
    }

    // Create run record
    const { error } = await supabase.from('djen_runs').insert({
      run_id: runId,
      status: 'em_andamento',
      total_monitoramentos: total,
      retry_count: retryCount,
    });

    if (error) {
      console.error('Error creating djen_runs:', error);
      return false;
    }

    console.log(`Created djen_runs record: ${runId}`);
    return true;
  } catch (e) {
    console.error('Error in ensureRunExists:', e);
    return false;
  }
}

// Helper to save batch record to djen_lotes
async function saveLoteRecord(
  supabase: any,
  runId: string,
  loteNumero: number,
  offset: number,
  processedCount: number,
  stats: {
    novas: number;
    descartadas: number;
    duplicatas: number;
    erros: number;
    paginas: number;
    resultados: number;
  },
  duration: number,
  tribunaisStats: TribunalStats[],
  total: number,
  retryCount: number,
  status: 'concluido' | 'erro' = 'concluido',
  erroMensagem?: string
): Promise<string | null> {
  try {
    // Ensure run exists before saving lote (fixes FK constraint error)
    const runExists = await ensureRunExists(supabase, runId, total, retryCount);
    if (!runExists) {
      console.error(`Cannot save lote: run ${runId} does not exist and could not be created`);
      return null;
    }

    const { data: lote, error } = await supabase
      .from('djen_lotes')
      .insert({
        run_id: runId,
        lote_numero: loteNumero,
        offset_inicial: offset,
        offset_final: offset + processedCount - 1,
        finalizado_em: new Date().toISOString(),
        status,
        processados: processedCount,
        novas: stats.novas,
        descartadas: stats.descartadas,
        duplicatas: stats.duplicatas,
        erros: stats.erros,
        total_paginas: stats.paginas,
        total_resultados: stats.resultados,
        duracao_segundos: duration,
        erro_mensagem: erroMensagem,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving lote:', error);
      return null;
    }

    // Save tribunal stats for this lote
    for (const ts of tribunaisStats) {
      await supabase.from('djen_tribunais_lote').insert({
        lote_id: lote.id,
        run_id: runId,
        tribunal: ts.tribunal || 'TODOS',
        termos_buscados: 0,
        paginas: ts.paginas,
        resultados: ts.resultados,
        novas: ts.novas,
        descartadas: ts.descartadas,
        duplicatas: ts.duplicatas,
      });
    }

    return lote.id;
  } catch (e) {
    console.error('Error in saveLoteRecord:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);

    const body = await req.json().catch(() => ({} as any));
    const scheduled = body?.scheduled === true;
    const continued = body?.continued === true;
    const completeRun = body?.completeRun === true || scheduled;
    const parentRunId = body?.parentRunId as string | undefined;
    const retryCount = (body?.retryCount as number) || 0;

    const urlOffsetRaw = url.searchParams.get('offset');
    const urlOffset = urlOffsetRaw !== null ? Number.parseInt(urlOffsetRaw, 10) : NaN;

    // Ler datas do período de consulta (passadas via query params do frontend)
    const dataInicioParam = url.searchParams.get('dataInicio');
    const dataFimParam = url.searchParams.get('dataFim');
    
    console.log(`[DJEN] Date params from URL: dataInicio=${dataInicioParam}, dataFim=${dataFimParam}`);

    let offset = Number.isFinite(urlOffset) ? urlOffset : 0;

    if (completeRun && !Number.isFinite(urlOffset) && !continued) {
      offset = 0;
    }

    console.log(`=== DJEN Monitor START ===`);
    console.log(`  Params: offset=${offset} | scheduled=${scheduled} | completeRun=${completeRun} | continued=${continued} | retryCount=${retryCount}`);
    console.log(`  URL offset param: ${urlOffsetRaw}`);
    console.log(`  Date range: ${dataInicioParam || 'hoje'} to ${dataFimParam || 'hoje'}`);
    console.log(`  Body: ${JSON.stringify(body).slice(0, 200)}`);
    const startTime = Date.now();

    console.log(`Counting active monitoramentos...`);
    const { count: totalActive, error: countError } = await supabase
      .from('monitoramentos_djen')
      .select('id', { count: 'exact', head: true })
      .eq('ativo', true);

    if (countError) {
      console.error(`Error counting monitoramentos:`, countError);
      throw countError;
    }
    console.log(`Total active monitoramentos: ${totalActive}`);

    console.log(`Fetching monitoramentos: range ${offset} to ${offset + MAX_PER_INVOCATION - 1}`);
    const { data: monitoramentos, error: fetchError } = await supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + MAX_PER_INVOCATION - 1);

    if (fetchError) {
      console.error(`Error fetching monitoramentos:`, fetchError);
      throw fetchError;
    }

    const count = monitoramentos?.length || 0;
    const total = totalActive || 0;
    console.log(`Fetched ${count} monitoramentos (total active: ${total})`);

    // Determine or create run_id
    // Se parentRunId foi passado, SEMPRE usa ele (mesmo sem flag continued)
    const hasParentRun = !!parentRunId;
    let runId = parentRunId || crypto.randomUUID();
    const isNewRun = offset === 0 && !continued && !hasParentRun;
    const loteNumero = Math.floor(offset / MAX_PER_INVOCATION) + 1;

    console.log(`[DJEN] Run decision: parentRunId=${parentRunId} | hasParentRun=${hasParentRun} | isNewRun=${isNewRun} | runId=${runId}`);

    // Create run record for new runs (ensureRunExists will handle idempotently)
    if (isNewRun) {
      // Cancel any stale in-progress runs before starting a fresh one
      const { data: staleRuns } = await supabase.from('djen_runs')
        .select('run_id')
        .eq('status', 'em_andamento')
        .lt('iniciado_em', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // older than 30 min
      
      if (staleRuns && staleRuns.length > 0) {
        console.log(`[DJEN] Cancelling ${staleRuns.length} stale run(s): ${staleRuns.map(r => r.run_id).join(', ')}`);
        await supabase.from('djen_runs')
          .update({ status: 'cancelado', motivo_erro: 'Cancelado por nova execução agendada', finalizado_em: new Date().toISOString() })
          .eq('status', 'em_andamento')
          .lt('iniciado_em', new Date(Date.now() - 30 * 60 * 1000).toISOString());
      }
      
      await ensureRunExists(supabase, runId, total, retryCount);
      console.log(`Initialized new run: ${runId}`);
    } else if (hasParentRun) {
      // Garante que o run existe (caso de continuação manual)
      await ensureRunExists(supabase, runId, total, retryCount);
      console.log(`Continuing existing run: ${runId}`);
    }

    // Handle empty batch at offset 0
    if (count === 0) {
      const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      console.log(`No monitoramentos to process at offset ${offset}. Total active: ${total}`);
      
      // If first batch is empty and we have active monitoramentos, schedule retry
      if (completeRun && offset === 0 && total > 0 && retryCount < MAX_RETRIES) {
        console.log(`[DJEN] Empty results at offset 0, scheduling retry #${retryCount + 1} in ${RETRY_DELAY_MINUTES} minutes`);
        
        // Update run status
        await supabase.from('djen_runs')
          .update({ 
            status: 'vazio_reexecutando',
            retry_count: retryCount + 1,
          })
          .eq('run_id', runId);
        
        // Save empty lote record
        await saveLoteRecord(supabase, runId, loteNumero, offset, 0, {
          novas: 0, descartadas: 0, duplicatas: 0, erros: 0, paginas: 0, resultados: 0,
        }, duration, [], total, retryCount, 'concluido');

        // Retry with delay - await delay then immediate fetch (setTimeout doesn't work in Edge Functions)
        const retryUrl = `${supabaseUrl}/functions/v1/monitorar-djen`;
        const retryBody = {
          completeRun: true,
          scheduled: true,
          continued: false,
          parentRunId: runId,
          retryCount: retryCount + 1,
        };

        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const incomingAuth = req.headers.get('authorization') || '';
        const authHeader = incomingAuth.startsWith('Bearer ')
          ? incomingAuth
          : (supabaseAnonKey ? `Bearer ${supabaseAnonKey}` : '');

        // Wait for the delay period (max 50 seconds to stay under Edge Function limits)
        const actualDelayMs = Math.min(RETRY_DELAY_MINUTES * 60 * 1000, 50_000);
        console.log(`[DJEN] Waiting ${actualDelayMs / 1000}s before retry...`);
        await delay(actualDelayMs);

        // Now execute the retry
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15_000);

          const r = await fetch(retryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify(retryBody),
            signal: controller.signal,
          });

          clearTimeout(timeout);
          const t = await r.text();
          console.log(`[DJEN] Retry request sent, status=${r.status}, body=${t.slice(0, 200)}`);
        } catch (e) {
          console.error(`[DJEN] Failed to send retry request:`, e);
        }

        return new Response(
          JSON.stringify({
            success: true,
            processados: 0,
            novasPublicacoes: 0,
            hasMore: false,
            scheduledRetry: true,
            retryDelaySeconds: actualDelayMs / 1000,
            retryCount: retryCount + 1,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Normal empty case (no active monitoramentos or max retries reached)
      const nowIso = new Date().toISOString();
      const finalStatus = retryCount >= MAX_RETRIES ? 'erro' : 'concluido';
      const errorMsg = retryCount >= MAX_RETRIES 
        ? `Máximo de ${MAX_RETRIES} tentativas atingido sem resultados` 
        : (total === 0 ? 'Nenhum monitoramento ativo encontrado' : undefined);

      if (isNewRun || parentRunId) {
        await supabase.from('djen_runs')
          .update({ 
            status: finalStatus,
            finalizado_em: nowIso,
            motivo_erro: errorMsg,
          })
          .eq('run_id', runId);
      }

      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: nowIso,
          metadata: {
            last_run: nowIso,
            last_complete_run: nowIso,
            offset_processado: 0,
            processados: 0,
            novas: 0,
            has_more: false,
            warning: errorMsg,
          },
        })
        .eq('tipo', 'djen');
      
      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen',
        executado_em: nowIso,
        processos_verificados: 0,
        novos_andamentos: 0,
        processos_com_novos: 0,
        erros: 0,
        detalhes: {
          run_id: runId,
          started_at: nowIso,
          warning: errorMsg,
          retry_count: retryCount,
        },
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          processados: 0,
          novasPublicacoes: 0,
          hasMore: false,
          warning: errorMsg,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${count} monitoramentos (offset ${offset})`);

    let totalNovas = 0;
    let totalDescartadas = 0;
    let totalDuplicatas = 0;
    let processedCount = 0;
    let errorCount = 0;
    let totalPaginas = 0;
    let totalResultados = 0;
    const allTribunaisStats: TribunalStats[] = [];

    for (const mon of (monitoramentos || [])) {
      // Para não estourar o tempo máximo da Edge Function, interrompe o lote com antecedência
      // e deixa tempo suficiente para salvar estado + enfileirar próximo lote.
      if (Date.now() - startTime > (SOFT_TIMEOUT_MS - FINALIZATION_BUFFER_MS)) {
        console.log(`Soft timeout (com buffer) reached at ${Math.round((Date.now() - startTime) / 1000)}s. Stopping batch early.`);
        break;
      }

      try {
        processedCount++;
        console.log(`[${processedCount}/${count}] ${mon.descricao || mon.termo_busca}`);

        const stats = await processMonitoramento(supabase, mon, { 
          scheduled,
          dataInicio: dataInicioParam || undefined,
          dataFim: dataFimParam || undefined,
        });
        totalNovas += stats.novas;
        totalDescartadas += stats.descartadas;
        totalDuplicatas += stats.duplicatas;

        for (const ts of stats.tribunaisStats) {
          totalPaginas += ts.paginas;
          totalResultados += ts.resultados;

          const existing = allTribunaisStats.find(t => t.tribunal === ts.tribunal);
          if (existing) {
            existing.paginas += ts.paginas;
            existing.resultados += ts.resultados;
            existing.novas += ts.novas;
            existing.descartadas += ts.descartadas;
            existing.duplicatas += ts.duplicatas;
          } else {
            allTribunaisStats.push({ ...ts });
          }
        }

        // Pequeno espaçamento para reduzir risco de rate limit; em agendado usamos menor delay para caber no runtime.
        await delay(scheduled ? 150 : 600);
      } catch (error) {
        errorCount++;
        console.error(`Error on ${mon.id}:`, error);
      }
    }

    const nowIso = new Date().toISOString();
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    const hasMore = (offset + processedCount) < total;
    const nextOffset = hasMore ? offset + processedCount : null;

    allTribunaisStats.sort((a, b) => b.resultados - a.resultados);

    // Save lote record
    await saveLoteRecord(
      supabase,
      runId,
      loteNumero,
      offset,
      processedCount,
      {
        novas: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        erros: errorCount,
        paginas: totalPaginas,
        resultados: totalResultados,
      },
      duration,
      allTribunaisStats,
      total,
      retryCount
    );

    // Load current config metadata to accumulate a full "run" across multiple batches
    const { data: configRow, error: configError } = await supabase
      .from('configuracoes_monitoramento')
      .select('id, metadata')
      .eq('tipo', 'djen')
      .limit(1)
      .maybeSingle();

    if (configError) {
      throw configError;
    }

    const currentMeta = (configRow?.metadata ?? {}) as Record<string, any>;

    type DjenRun = {
      run_id: string;
      started_at: string;
      totals: {
        processados: number;
        novas: number;
        descartadas: number;
        duplicatas: number;
        erros: number;
        duracao_s: number;
        total_paginas: number;
        total_resultados: number;
      };
      tribunais: Record<string, TribunalStats>;
    };

    let run: DjenRun | null = (currentMeta?.djen_run as DjenRun) ?? null;

    const shouldResetRun = offset === 0 && completeRun && !continued;

    if (shouldResetRun || !run || typeof run !== 'object' || !run.run_id || !run.totals || !run.tribunais) {
      run = {
        run_id: runId,
        started_at: nowIso,
        totals: {
          processados: 0,
          novas: 0,
          descartadas: 0,
          duplicatas: 0,
          erros: 0,
          duracao_s: 0,
          total_paginas: 0,
          total_resultados: 0,
        },
        tribunais: {},
      };
    }

    run.totals.processados += processedCount;
    run.totals.novas += totalNovas;
    run.totals.descartadas += totalDescartadas;
    run.totals.duplicatas += totalDuplicatas;
    run.totals.erros += errorCount;
    run.totals.duracao_s += duration;
    run.totals.total_paginas += totalPaginas;
    run.totals.total_resultados += totalResultados;

    for (const ts of allTribunaisStats) {
      const tribunalKey = ts.tribunal ?? 'TODOS';
      const existing = run.tribunais[tribunalKey];
      run.tribunais[tribunalKey] = existing
        ? {
            tribunal: tribunalKey,
            paginas: (existing.paginas || 0) + (ts.paginas || 0),
            resultados: (existing.resultados || 0) + (ts.resultados || 0),
            novas: (existing.novas || 0) + (ts.novas || 0),
            descartadas: (existing.descartadas || 0) + (ts.descartadas || 0),
            duplicatas: (existing.duplicatas || 0) + (ts.duplicatas || 0),
          }
        : { ...ts, tribunal: tribunalKey };
    }

    const tribunaisFinal = !hasMore && run
      ? Object.values(run.tribunais).sort((a, b) => b.resultados - a.resultados)
      : null;

    const metaTotals = !hasMore && run
      ? {
          processados: run.totals.processados,
          novas: run.totals.novas,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          erros: run.totals.erros,
          duracao_s: run.totals.duracao_s,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          tribunais_stats: (tribunaisFinal ?? []).slice(0, 30),
        }
      : {
          processados: processedCount,
          novas: totalNovas,
          descartadas: totalDescartadas,
          duplicatas: totalDuplicatas,
          erros: errorCount,
          duracao_s: duration,
          total_paginas: totalPaginas,
          total_resultados: totalResultados,
          tribunais_stats: allTribunaisStats.slice(0, 20),
        };

    const updatedMeta: Record<string, any> = {
      ...currentMeta,
      last_run: nowIso,
      offset_processado: offset,
      processados: metaTotals.processados,
      novas: metaTotals.novas,
      descartadas: metaTotals.descartadas,
      duplicatas: metaTotals.duplicatas,
      erros: metaTotals.erros,
      duracao_s: metaTotals.duracao_s,
      has_more: hasMore,
      next_offset: nextOffset,
      total_paginas: metaTotals.total_paginas,
      total_resultados: metaTotals.total_resultados,
      tribunais_stats: metaTotals.tribunais_stats,
      djen_run: hasMore ? run : null,
      last_complete_run: hasMore ? (currentMeta?.last_complete_run ?? null) : nowIso,
    };

    const updatePayload: Record<string, any> = {
      metadata: updatedMeta,
    };
    if (offset === 0 && !continued) {
      updatePayload.ultima_execucao = nowIso;
    }

    await supabase
      .from('configuracoes_monitoramento')
      .update(updatePayload)
      .eq('tipo', 'djen');

    // Atualiza o progresso do run a cada lote (evita ficar "preso" sem números quando a continuação falha)
    if (hasMore && run) {
      await supabase.from('djen_runs')
        .update({
          status: 'em_andamento',
          processados: run.totals.processados,
          novas: run.totals.novas,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          erros: run.totals.erros,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          duracao_segundos: run.totals.duracao_s,
        })
        .eq('run_id', runId);
    }

    // Update run record and create history when complete
    if (!hasMore && run) {
      await supabase.from('djen_runs')
        .update({
          status: 'concluido',
          finalizado_em: nowIso,
          processados: run.totals.processados,
          novas: run.totals.novas,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          erros: run.totals.erros,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          duracao_segundos: run.totals.duracao_s,
        })
        .eq('run_id', runId);

      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen',
        executado_em: nowIso,
        processos_verificados: run.totals.processados,
        novos_andamentos: run.totals.novas,
        processos_com_novos: run.totals.novas,
        erros: run.totals.erros,
        detalhes: {
          run_id: run.run_id,
          started_at: run.started_at,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          duracao_s: run.totals.duracao_s,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          tribunais_stats: (tribunaisFinal ?? []).slice(0, 30),
        },
      });
    }

    // Auto-continuation
    if (completeRun && hasMore && typeof nextOffset === 'number') {
      const nextUrl = `${supabaseUrl}/functions/v1/monitorar-djen?offset=${nextOffset}`;
      const nextBody = {
        completeRun: true,
        scheduled: true,
        continued: true,
        parentRunId: runId,
      };

      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const incomingAuth = req.headers.get('authorization') || '';
      const authHeader = incomingAuth.startsWith('Bearer ')
        ? incomingAuth
        : (supabaseAnonKey ? `Bearer ${supabaseAnonKey}` : '');

      if (!authHeader) {
        console.error('[DJEN] No Authorization header available for auto-continuation');
      } else {
        const maxAttempts = 3;
        let queued = false;
        let lastErr: unknown = null;

        for (let attempt = 1; attempt <= maxAttempts && !queued; attempt++) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 55_000);

          try {
            const r = await fetch(nextUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
              },
              body: JSON.stringify(nextBody),
              signal: controller.signal,
            });

            clearTimeout(timeout);

            if (r.ok) {
              console.log(`[DJEN] Queued next batch offset=${nextOffset} (attempt ${attempt}/${maxAttempts})`);
              queued = true;
              break;
            }

            const t = await r.text().catch(() => '');
            lastErr = new Error(`HTTP ${r.status}`);
            console.error(`[DJEN] Failed to queue next batch offset=${nextOffset} status=${r.status} body=${t.slice(0, 200)}`);
          } catch (e) {
            clearTimeout(timeout);
            lastErr = e;
            console.error(`[DJEN] Failed to queue next batch offset=${nextOffset} (attempt ${attempt}/${maxAttempts})`, e);
            if (attempt < maxAttempts) {
              await new Promise((res) => setTimeout(res, 800 * attempt));
            }
          }
        }

        // Se não conseguiu enfileirar, encerra o run para não ficar preso em "em_andamento"
        if (!queued) {
          console.error('[DJEN] Giving up queuing next batch', lastErr);

          try {
            await supabase
              .from('djen_runs')
              .update({
                status: 'erro',
                finalizado_em: nowIso,
                motivo_erro: 'failed_to_queue_next_batch',
              })
              .eq('run_id', runId);
          } catch (e) {
            console.error('[DJEN] Failed to mark run as erro after queue failure', e);
          }

          // Limpa a continuação para a próxima execução não somar em cima de um run quebrado
          try {
            await supabase
              .from('configuracoes_monitoramento')
              .update({
                metadata: {
                  ...updatedMeta,
                  has_more: false,
                  next_offset: null,
                  djen_run: null,
                },
              })
              .eq('tipo', 'djen');
          } catch (e) {
            console.error('[DJEN] Failed to clear metadata after queue failure', e);
          }
        }
      }
    }

    console.log(`Done: ${processedCount} processed, ${totalNovas} new, ${totalPaginas} pages, ${duration}s | hasMore=${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: processedCount,
        novasPublicacoes: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        erros: errorCount,
        duracaoSegundos: duration,
        totalPaginas,
        totalResultados,
        tribunaisStats: allTribunaisStats,
        hasMore,
        nextOffset,
        queuedNext: completeRun && hasMore,
        runId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
