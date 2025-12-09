import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - restrict to application domains
const ALLOWED_ORIGINS = [
  'https://bfxahrrvoqxcdmfsvnrk.supabase.co',
  'https://lovable.dev',
];

// Check if origin is allowed (also allows localhost for development and Lovable preview domains)
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

// Input validation for process number (CNJ format: 20 digits)
function isValidProcessNumber(numero: string): boolean {
  const cleaned = numero.replace(/\D/g, '');
  return cleaned.length >= 15 && cleaned.length <= 25;
}

// Input validation for tribunal (alphanumeric with underscores only)
function isValidTribunal(tribunal: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(tribunal) && tribunal.length <= 50;
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Reject requests from disallowed origins
  if (!isAllowedOrigin(origin)) {
    console.warn("Blocked request from unauthorized origin:", origin);
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { numeroProcesso, tribunal } = await req.json();
    
    console.log("Consultando processo:", numeroProcesso, "Tribunal:", tribunal);

    // Validate process number
    if (!numeroProcesso || typeof numeroProcesso !== 'string') {
      return new Response(
        JSON.stringify({ error: "Número do processo é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidProcessNumber(numeroProcesso)) {
      return new Response(
        JSON.stringify({ error: "Formato de número de processo inválido" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tribunal if provided
    if (tribunal && !isValidTribunal(tribunal)) {
      return new Response(
        JSON.stringify({ error: "Tribunal inválido" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const numeroLimpo = limparNumeroProcesso(numeroProcesso);
    
    let endpoint: string;
    let tribunalNome: string;
    
    if (tribunal) {
      endpoint = tribunal;
      tribunalNome = tribunal.toUpperCase();
    } else {
      const tribunalInfo = getTribunalInfo(numeroProcesso);
      if (!tribunalInfo) {
        return new Response(
          JSON.stringify({ 
            error: "Não foi possível identificar o tribunal. Por favor, selecione manualmente." 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      endpoint = tribunalInfo.endpoint;
      tribunalNome = tribunalInfo.nome;
    }

    const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;
    
    console.log("URL da API:", url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          match: {
            numeroProcesso: numeroLimpo
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API DataJud:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Erro ao consultar API do tribunal: ${response.status}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log("Resposta da API:", JSON.stringify(data).substring(0, 500));
    
    const hits = data.hits?.hits || [];
    
    if (hits.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          tribunal: tribunalNome,
          message: "Processo não encontrado no tribunal consultado" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processo = hits[0]._source;
    const movimentos = processo.movimentos || [];
    
    return new Response(
      JSON.stringify({
        found: true,
        tribunal: tribunalNome,
        processo: {
          numero: processo.numeroProcesso,
          classe: processo.classe?.nome || processo.classeProcessual,
          assunto: processo.assuntos?.[0]?.nome || processo.assunto,
          orgaoJulgador: processo.orgaoJulgador?.nome,
          dataAjuizamento: processo.dataAjuizamento,
          grau: processo.grau,
          nivelSigilo: processo.nivelSigilo,
          formato: processo.formato?.nome,
          sistema: processo.sistema?.nome,
          tribunal: processo.tribunal,
          partes: processo.partes?.map((p: any) => ({
            tipo: p.tipo,
            nome: p.nome,
            tipoParte: p.tipoParte
          })) || []
        },
        movimentos: movimentos.slice(0, 100).map((m: any) => ({
          data: m.dataHora,
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

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
