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

// API endpoint for PJE Comunica
const PJE_API_BASE = "https://comunica.pje.jus.br/api/v1";

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

async function searchPJE(params: SearchParams): Promise<any> {
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
      url = `${PJE_API_BASE}/comunicacao/advogado/${oab}/${uf.toUpperCase()}`;
      break;
      
    case "palavra-chave":
      if (!palavraChave) {
        throw new Error("Palavra-chave é obrigatória");
      }
      const encodedKeyword = encodeURIComponent(palavraChave);
      url = `${PJE_API_BASE}/comunicacao/pesquisa?texto=${encodedKeyword}`;
      break;
      
    case "processo":
      if (!numeroProcesso) {
        throw new Error("Número do processo é obrigatório");
      }
      const cleanedNumber = numeroProcesso.replace(/\D/g, '');
      url = `${PJE_API_BASE}/comunicacao/processo/${cleanedNumber}`;
      break;
      
    default:
      throw new Error("Tipo de busca inválido");
  }

  // Add pagination and date filters
  const queryParams = new URLSearchParams();
  queryParams.append("pagina", pagina.toString());
  queryParams.append("tamanhoPagina", tamanhoPagina.toString());
  
  if (dataInicio) {
    queryParams.append("dataInicio", dataInicio);
  }
  if (dataFim) {
    queryParams.append("dataFim", dataFim);
  }
  
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}${queryParams.toString()}`;
  
  console.log("Fetching PJE API:", fullUrl);
  
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("PJE API error:", response.status, errorText);
    
    // 422 means "not found" - return empty results instead of error
    if (response.status === 422 || response.status === 404) {
      console.log("PJE returned not found, returning empty results");
      return { 
        publicacoes: [], 
        items: [],
        comunicacoes: [],
        totalElements: 0, 
        totalPages: 0,
        message: "Nenhuma comunicação encontrada para os critérios informados"
      };
    }
    
    throw new Error(`Erro na API do PJE: ${response.status}`);
  }

  return await response.json();
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

    console.log("PJE Search request:", JSON.stringify(body));

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

    const result = await searchPJE({
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
    console.error("PJE function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
