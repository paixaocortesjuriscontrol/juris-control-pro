import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS
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

// API endpoints for DJEN
const DJEN_API_BASE = "https://comunicaapi.pje.jus.br/api/v1";

// Types of searches available
type SearchType = "advogado" | "palavra-chave" | "processo";

interface SearchParams {
  tipo: SearchType;
  oab?: string;
  uf?: string;
  palavraChave?: string;
  numeroProcesso?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

async function searchDJEN(params: SearchParams): Promise<any> {
  const {
    tipo,
    oab,
    uf,
    palavraChave,
    numeroProcesso,
    dataInicio,
    dataFim,
    pagina = 0,
    tamanhoPagina = 20
  } = params;

  let url: string;
  
  // Build URL based on search type
  switch (tipo) {
    case "advogado":
      if (!oab || !uf) {
        throw new Error("OAB e UF são obrigatórios para busca por advogado");
      }
      url = `${DJEN_API_BASE}/comunicacao/advogado/${oab}/${uf.toUpperCase()}`;
      break;
      
    case "palavra-chave":
      if (!palavraChave) {
        throw new Error("Palavra-chave é obrigatória");
      }
      // The DJEN API may require specific encoding
      const encodedKeyword = encodeURIComponent(palavraChave);
      url = `${DJEN_API_BASE}/comunicacao/pesquisa?texto=${encodedKeyword}`;
      break;
      
    case "processo":
      if (!numeroProcesso) {
        throw new Error("Número do processo é obrigatório");
      }
      const cleanedNumber = numeroProcesso.replace(/\D/g, '');
      url = `${DJEN_API_BASE}/comunicacao/processo/${cleanedNumber}`;
      break;
      
    default:
      throw new Error("Tipo de busca inválido");
  }

  // Add pagination and date filters
  const queryParams = new URLSearchParams();
  queryParams.append("pagina", pagina.toString());
  queryParams.append("tamanhoPagina", tamanhoPagina.toString());
  
  if (dataInicio) {
    queryParams.append("dataDisponibilizacaoInicio", dataInicio);
  }
  if (dataFim) {
    queryParams.append("dataDisponibilizacaoFim", dataFim);
  }
  
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}${queryParams.toString()}`;
  
  console.log("Fetching DJEN API:", fullUrl);
  
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DJEN API error:", response.status, errorText);
    
    // 422 means "not found" - return empty results instead of error
    if (response.status === 422) {
      console.log("DJEN returned 422 (not found), returning empty results");
      return { 
        publicacoes: [], 
        items: [],
        comunicacoes: [],
        totalElements: 0, 
        totalPages: 0,
        message: "Nenhuma comunicação encontrada para os critérios informados"
      };
    }
    
    // Try alternative endpoint structure for 404/403
    if (response.status === 404 || response.status === 403) {
      if (tipo === "processo" && numeroProcesso) {
        return await searchDataJudPublicacoes(numeroProcesso);
      }
    }
    
    throw new Error(`Erro na API do DJEN: ${response.status}`);
  }

  return await response.json();
}

// Fallback to DataJud API for process publications
async function searchDataJudPublicacoes(numeroProcesso: string): Promise<any> {
  const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
  const cleanedNumber = numeroProcesso.replace(/\D/g, '').padStart(20, '0');
  
  // Try to find publications in DataJud movements
  const url = "https://api-publica.datajud.cnj.jus.br/api_publica_trt10/_search";
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        bool: {
          should: [
            { match_phrase: { "movimentos.nome": "Publicação" } },
            { match_phrase: { "movimentos.complemento": "Diário" } }
          ],
          must: [
            { match: { numeroProcesso: cleanedNumber } }
          ]
        }
      },
      size: 50
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao consultar DataJud");
  }

  const data = await response.json();
  const hits = data.hits?.hits || [];
  
  if (hits.length === 0) {
    return { publicacoes: [], total: 0 };
  }

  const processo = hits[0]._source;
  const publicacoes = (processo.movimentos || [])
    .filter((m: any) => 
      m.nome?.toLowerCase().includes('publicação') ||
      m.nome?.toLowerCase().includes('diário') ||
      m.complemento?.toLowerCase().includes('dje')
    )
    .map((m: any) => ({
      data: m.dataHora,
      tipo: m.nome,
      conteudo: m.complemento || m.nome,
      processo: processo.numeroProcesso
    }));

  return {
    publicacoes,
    total: publicacoes.length,
    fonte: "DataJud"
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { 
      tipo = "palavra-chave",
      oab,
      uf,
      palavraChave,
      numeroProcesso,
      dataInicio,
      dataFim,
      pagina = 0,
      tamanhoPagina = 20
    } = body;

    console.log("DJEN Search request:", JSON.stringify(body));

    // Validate inputs
    if (tipo === "advogado") {
      if (!oab || !uf) {
        return new Response(
          JSON.stringify({ error: "OAB e UF são obrigatórios para busca por advogado" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (tipo === "palavra-chave") {
      if (!palavraChave || palavraChave.length < 3) {
        return new Response(
          JSON.stringify({ error: "Palavra-chave deve ter pelo menos 3 caracteres" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (tipo === "processo") {
      if (!numeroProcesso) {
        return new Response(
          JSON.stringify({ error: "Número do processo é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const result = await searchDJEN({
      tipo,
      oab,
      uf,
      palavraChave,
      numeroProcesso,
      dataInicio,
      dataFim,
      pagina,
      tamanhoPagina
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("DJEN function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
