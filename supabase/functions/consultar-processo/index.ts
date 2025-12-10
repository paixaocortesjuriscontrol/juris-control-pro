import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - restrict to application domains
const ALLOWED_ORIGINS = [
  'https://bfxahrrvoqxcdmfsvnrk.supabase.co',
  'https://lovable.dev',
  'https://juriscontrol.adv.br',
  'https://www.juriscontrol.adv.br',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin.startsWith('http://localhost:')) return true;
  if (origin.endsWith('.lovable.app')) return true;
  if (origin.endsWith('.lovableproject.com')) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// API Key pública do DataJud/CNJ
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Mapa de tribunais baseado na numeração única de processos
const tribunais: Record<string, Record<string, { endpoint: string; nome: string }>> = {
  "3": {
    "0": { endpoint: "api_publica_stj", nome: "Superior Tribunal de Justiça" }
  },
  "4": {
    "1": { endpoint: "api_publica_trf1", nome: "TRF da 1ª Região" },
    "2": { endpoint: "api_publica_trf2", nome: "TRF da 2ª Região" },
    "3": { endpoint: "api_publica_trf3", nome: "TRF da 3ª Região" },
    "4": { endpoint: "api_publica_trf4", nome: "TRF da 4ª Região" },
    "5": { endpoint: "api_publica_trf5", nome: "TRF da 5ª Região" },
    "6": { endpoint: "api_publica_trf6", nome: "TRF da 6ª Região" }
  },
  "5": {
    "0": { endpoint: "api_publica_tst", nome: "Tribunal Superior do Trabalho" },
    "1": { endpoint: "api_publica_trt1", nome: "TRT da 1ª Região" },
    "2": { endpoint: "api_publica_trt2", nome: "TRT da 2ª Região" },
    "3": { endpoint: "api_publica_trt3", nome: "TRT da 3ª Região" },
    "4": { endpoint: "api_publica_trt4", nome: "TRT da 4ª Região" },
    "5": { endpoint: "api_publica_trt5", nome: "TRT da 5ª Região" },
    "6": { endpoint: "api_publica_trt6", nome: "TRT da 6ª Região" },
    "7": { endpoint: "api_publica_trt7", nome: "TRT da 7ª Região" },
    "8": { endpoint: "api_publica_trt8", nome: "TRT da 8ª Região" },
    "9": { endpoint: "api_publica_trt9", nome: "TRT da 9ª Região" },
    "10": { endpoint: "api_publica_trt10", nome: "TRT da 10ª Região" },
    "11": { endpoint: "api_publica_trt11", nome: "TRT da 11ª Região" },
    "12": { endpoint: "api_publica_trt12", nome: "TRT da 12ª Região" },
    "13": { endpoint: "api_publica_trt13", nome: "TRT da 13ª Região" },
    "14": { endpoint: "api_publica_trt14", nome: "TRT da 14ª Região" },
    "15": { endpoint: "api_publica_trt15", nome: "TRT da 15ª Região" },
    "16": { endpoint: "api_publica_trt16", nome: "TRT da 16ª Região" },
    "17": { endpoint: "api_publica_trt17", nome: "TRT da 17ª Região" },
    "18": { endpoint: "api_publica_trt18", nome: "TRT da 18ª Região" },
    "19": { endpoint: "api_publica_trt19", nome: "TRT da 19ª Região" },
    "20": { endpoint: "api_publica_trt20", nome: "TRT da 20ª Região" },
    "21": { endpoint: "api_publica_trt21", nome: "TRT da 21ª Região" },
    "22": { endpoint: "api_publica_trt22", nome: "TRT da 22ª Região" },
    "23": { endpoint: "api_publica_trt23", nome: "TRT da 23ª Região" },
    "24": { endpoint: "api_publica_trt24", nome: "TRT da 24ª Região" }
  },
  "6": {
    "0": { endpoint: "api_publica_tse", nome: "Tribunal Superior Eleitoral" }
  },
  "7": {
    "0": { endpoint: "api_publica_stm", nome: "Superior Tribunal Militar" }
  },
  "8": {
    "1": { endpoint: "api_publica_tjac", nome: "TJAC" },
    "2": { endpoint: "api_publica_tjal", nome: "TJAL" },
    "3": { endpoint: "api_publica_tjap", nome: "TJAP" },
    "4": { endpoint: "api_publica_tjam", nome: "TJAM" },
    "5": { endpoint: "api_publica_tjba", nome: "TJBA" },
    "6": { endpoint: "api_publica_tjce", nome: "TJCE" },
    "7": { endpoint: "api_publica_tjdft", nome: "TJDFT" },
    "8": { endpoint: "api_publica_tjes", nome: "TJES" },
    "9": { endpoint: "api_publica_tjgo", nome: "TJGO" },
    "10": { endpoint: "api_publica_tjma", nome: "TJMA" },
    "11": { endpoint: "api_publica_tjmt", nome: "TJMT" },
    "12": { endpoint: "api_publica_tjms", nome: "TJMS" },
    "13": { endpoint: "api_publica_tjmg", nome: "TJMG" },
    "14": { endpoint: "api_publica_tjpa", nome: "TJPA" },
    "15": { endpoint: "api_publica_tjpb", nome: "TJPB" },
    "16": { endpoint: "api_publica_tjpr", nome: "TJPR" },
    "17": { endpoint: "api_publica_tjpe", nome: "TJPE" },
    "18": { endpoint: "api_publica_tjpi", nome: "TJPI" },
    "19": { endpoint: "api_publica_tjrj", nome: "TJRJ" },
    "20": { endpoint: "api_publica_tjrn", nome: "TJRN" },
    "21": { endpoint: "api_publica_tjrs", nome: "TJRS" },
    "22": { endpoint: "api_publica_tjro", nome: "TJRO" },
    "23": { endpoint: "api_publica_tjrr", nome: "TJRR" },
    "24": { endpoint: "api_publica_tjsc", nome: "TJSC" },
    "25": { endpoint: "api_publica_tjse", nome: "TJSE" },
    "26": { endpoint: "api_publica_tjsp", nome: "TJSP" },
    "27": { endpoint: "api_publica_tjto", nome: "TJTO" }
  }
};

function limparNumeroProcesso(numero: string): string {
  return numero.replace(/\D/g, '').padStart(20, '0');
}

function extrairInfoTribunal(numeroLimpo: string): { j: string; tr: string } | null {
  if (numeroLimpo.length !== 20) return null;
  const j = numeroLimpo.charAt(13);
  const tr = numeroLimpo.substring(14, 16).replace(/^0+/, '') || "0";
  return { j, tr };
}

function getTribunalInfo(numeroProcesso: string): { endpoint: string; nome: string } | null {
  const numeroLimpo = limparNumeroProcesso(numeroProcesso);
  const info = extrairInfoTribunal(numeroLimpo);
  
  if (!info) return null;
  
  const jurisdicao = tribunais[info.j];
  if (!jurisdicao) return null;
  
  return jurisdicao[info.tr] || null;
}

function extrairPartes(partes: any[]): { poloAtivo: string[]; poloPassivo: string[] } {
  const poloAtivo: string[] = [];
  const poloPassivo: string[] = [];
  
  if (!partes || !Array.isArray(partes)) {
    return { poloAtivo, poloPassivo };
  }
  
  for (const parte of partes) {
    const nome = parte.nome || parte.pessoa?.nome || '';
    if (!nome) continue;
    
    const polo = (parte.polo || parte.tipoParte || '').toUpperCase();
    
    if (polo.includes('AT') || polo.includes('ATIVO') || polo.includes('AUTOR') || 
        polo.includes('REQUERENTE') || polo.includes('RECLAMANTE') || polo.includes('EXEQUENTE')) {
      poloAtivo.push(nome);
    } 
    else if (polo.includes('PA') || polo.includes('PASSIVO') || polo.includes('REU') || 
             polo.includes('REQUERIDO') || polo.includes('RECLAMADO') || polo.includes('EXECUTADO')) {
      poloPassivo.push(nome);
    }
    else {
      const tipoParte = (parte.tipoParte || '').toLowerCase();
      if (tipoParte.includes('autor') || tipoParte.includes('requerente') || tipoParte.includes('reclamante')) {
        poloAtivo.push(nome);
      } else if (tipoParte.includes('reu') || tipoParte.includes('réu') || tipoParte.includes('requerido') || tipoParte.includes('reclamado')) {
        poloPassivo.push(nome);
      }
    }
  }
  
  return { poloAtivo, poloPassivo };
}

// Build Elasticsearch query based on filters
function buildElasticsearchQuery(params: {
  numeroProcesso?: string;
  nomeParte?: string;
  classeJudicial?: string;
  cpfCnpj?: string;
  oab?: string;
  dataInicio?: string;
  dataFim?: string;
}): any {
  const must: any[] = [];
  const should: any[] = [];
  
  // Número do processo (exact or partial match)
  if (params.numeroProcesso) {
    const numeroLimpo = params.numeroProcesso.replace(/\D/g, '');
    if (numeroLimpo.length >= 15) {
      must.push({ match: { numeroProcesso: numeroLimpo.padStart(20, '0') } });
    } else if (numeroLimpo.length >= 5) {
      must.push({ wildcard: { numeroProcesso: `*${numeroLimpo}*` } });
    }
  }
  
  // Nome da parte
  if (params.nomeParte) {
    must.push({
      nested: {
        path: "partes",
        query: {
          match_phrase_prefix: { "partes.nome": params.nomeParte }
        }
      }
    });
  }
  
  // Classe Judicial
  if (params.classeJudicial) {
    should.push({ match_phrase_prefix: { "classe.nome": params.classeJudicial } });
    should.push({ match_phrase_prefix: { classeProcessual: params.classeJudicial } });
  }
  
  // CPF ou CNPJ
  if (params.cpfCnpj) {
    const documento = params.cpfCnpj.replace(/\D/g, '');
    must.push({
      nested: {
        path: "partes",
        query: {
          bool: {
            should: [
              { match: { "partes.cpf": documento } },
              { match: { "partes.cnpj": documento } },
              { match: { "partes.documento": documento } },
              { match: { "partes.pessoa.cpf": documento } },
              { match: { "partes.pessoa.cnpj": documento } }
            ]
          }
        }
      }
    });
  }
  
  // OAB
  if (params.oab) {
    must.push({
      nested: {
        path: "partes",
        query: {
          nested: {
            path: "partes.advogados",
            query: {
              bool: {
                should: [
                  { match: { "partes.advogados.inscricao": params.oab } },
                  { match: { "partes.advogados.numeroOAB": params.oab } }
                ]
              }
            }
          }
        }
      }
    });
  }
  
  // Data de Autuação (range)
  if (params.dataInicio || params.dataFim) {
    const range: any = {};
    if (params.dataInicio) {
      range.gte = params.dataInicio;
    }
    if (params.dataFim) {
      range.lte = params.dataFim;
    }
    must.push({ range: { dataAjuizamento: range } });
  }
  
  // Build final query
  const query: any = { bool: {} };
  
  if (must.length > 0) {
    query.bool.must = must;
  }
  
  if (should.length > 0) {
    query.bool.should = should;
    query.bool.minimum_should_match = should.length > 0 && must.length === 0 ? 1 : 0;
  }
  
  // If no filters provided, match all
  if (must.length === 0 && should.length === 0) {
    return { match_all: {} };
  }
  
  return query;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAllowedOrigin(origin)) {
    console.warn("Blocked request from unauthorized origin:", origin);
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { 
      numeroProcesso, 
      tribunal,
      nomeParte,
      classeJudicial,
      cpfCnpj,
      oab,
      uf,
      dataInicio,
      dataFim,
      size = 20
    } = body;
    
    console.log("Consulta com filtros:", JSON.stringify({ numeroProcesso, tribunal, nomeParte, classeJudicial, cpfCnpj, oab, uf, dataInicio, dataFim }));

    // Determine endpoint
    let endpoint: string;
    let tribunalNome: string;
    
    if (tribunal && tribunal !== 'auto') {
      endpoint = `api_publica_${tribunal}`;
      tribunalNome = tribunal.toUpperCase();
    } else if (numeroProcesso) {
      const numeroLimpo = numeroProcesso.replace(/\D/g, '');
      if (numeroLimpo.length >= 15) {
        const tribunalInfo = getTribunalInfo(numeroProcesso);
        if (tribunalInfo) {
          endpoint = tribunalInfo.endpoint;
          tribunalNome = tribunalInfo.nome;
        } else {
          return new Response(
            JSON.stringify({ error: "Não foi possível identificar o tribunal pelo número. Por favor, selecione manualmente." }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Por favor, selecione o tribunal para buscas com número parcial ou outros filtros." }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (uf) {
      // Map UF to tribunal endpoint
      const ufToTribunal: Record<string, string> = {
        'AC': 'tjac', 'AL': 'tjal', 'AP': 'tjap', 'AM': 'tjam', 'BA': 'tjba',
        'CE': 'tjce', 'DF': 'tjdft', 'ES': 'tjes', 'GO': 'tjgo', 'MA': 'tjma',
        'MT': 'tjmt', 'MS': 'tjms', 'MG': 'tjmg', 'PA': 'tjpa', 'PB': 'tjpb',
        'PR': 'tjpr', 'PE': 'tjpe', 'PI': 'tjpi', 'RJ': 'tjrj', 'RN': 'tjrn',
        'RS': 'tjrs', 'RO': 'tjro', 'RR': 'tjrr', 'SC': 'tjsc', 'SP': 'tjsp',
        'SE': 'tjse', 'TO': 'tjto'
      };
      endpoint = `api_publica_${ufToTribunal[uf] || 'tjsp'}`;
      tribunalNome = `TJ${uf}`;
    } else {
      return new Response(
        JSON.stringify({ error: "Por favor, informe o número do processo, selecione o tribunal ou a UF." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;
    console.log("URL da API:", url);
    
    // Build query
    const query = buildElasticsearchQuery({
      numeroProcesso,
      nomeParte,
      classeJudicial,
      cpfCnpj,
      oab,
      dataInicio,
      dataFim
    });
    
    console.log("Query Elasticsearch:", JSON.stringify(query));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        size: Math.min(size, 100),
        sort: [{ dataAjuizamento: { order: "desc" } }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API DataJud:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro ao consultar API do tribunal: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const totalHits = data.hits?.total?.value || 0;
    console.log("Resposta da API - hits:", totalHits);
    
    const hits = data.hits?.hits || [];
    
    if (hits.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          tribunal: tribunalNome,
          total: 0,
          processos: [],
          message: "Nenhum processo encontrado com os critérios informados" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If single result (searching by number), return full details
    if (hits.length === 1 && numeroProcesso && numeroProcesso.replace(/\D/g, '').length >= 15) {
      const processo = hits[0]._source;
      const movimentos = processo.movimentos || [];
      const { poloAtivo, poloPassivo } = extrairPartes(processo.partes);
      
      return new Response(
        JSON.stringify({
          found: true,
          tribunal: tribunalNome,
          total: 1,
          processo: {
            numero: processo.numeroProcesso,
            classe: processo.classe?.nome || processo.classeProcessual,
            assunto: processo.assuntos?.[0]?.nome || processo.assunto,
            orgaoJulgador: processo.orgaoJulgador?.nome,
            dataDistribuicao: processo.dataAjuizamento,
            dataAjuizamento: processo.dataAjuizamento,
            grau: processo.grau,
            nivelSigilo: processo.nivelSigilo,
            formato: processo.formato?.nome,
            sistema: processo.sistema?.nome,
            tribunal: processo.tribunal,
            valorCausa: processo.valorCausa,
            poloAtivo,
            poloPassivo
          },
          movimentacoes: movimentos.slice(0, 100).map((m: any) => ({
            dataHora: m.dataHora,
            nome: m.nome || m.movimentoNacional?.nome,
            codigo: m.codigo || m.movimentoNacional?.codigo,
            codigoNacional: m.movimentoNacional?.codigoNacional || m.codigoNacional,
            complemento: m.complementosTabelados?.map((c: any) => 
              `${c.nome}: ${c.valor}`
            ).join(' | ') || m.complemento || ''
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Multiple results - return list
    const processos = hits.map((hit: any) => {
      const p = hit._source;
      const { poloAtivo, poloPassivo } = extrairPartes(p.partes);
      
      return {
        numero: p.numeroProcesso,
        classe: p.classe?.nome || p.classeProcessual,
        assunto: p.assuntos?.[0]?.nome || p.assunto,
        orgaoJulgador: p.orgaoJulgador?.nome,
        dataDistribuicao: p.dataAjuizamento,
        tribunal: p.tribunal,
        valorCausa: p.valorCausa,
        poloAtivo,
        poloPassivo
      };
    });

    return new Response(
      JSON.stringify({
        found: true,
        tribunal: tribunalNome,
        total: totalHits,
        processos
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
