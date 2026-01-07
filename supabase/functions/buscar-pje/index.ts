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

// API endpoint - same as DJEN (PJE Comunica)
const PJE_API_BASE = "https://comunicaapi.pje.jus.br/api/v1";

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
  
  // Build URL based on search type - same structure as DJEN
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

  console.log("PJE API response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("PJE API error:", response.status, errorText.substring(0, 500));
    
    // 422 means "not found" - return empty results instead of error
    if (response.status === 422) {
      console.log("PJE returned 422 (not found), returning empty results");
      return { 
        publicacoes: [], 
        items: [],
        comunicacoes: [],
        totalElements: 0, 
        totalPages: 0,
        message: "Nenhuma comunicação encontrada para os critérios informados"
      };
    }
    
    // Try fallback to DataJud for 404/403
    if (response.status === 404 || response.status === 403) {
      if (tipo === "processo" && numeroProcesso) {
        console.log("Trying DataJud fallback for process search");
        return await searchDataJudPublicacoes(numeroProcesso);
      }
      
      // For advogado/palavra-chave, return empty results (API limitation)
      console.log(`PJE API returned ${response.status} for ${tipo} search, returning empty results`);
      return { 
        publicacoes: [], 
        items: [],
        comunicacoes: [],
        totalElements: 0, 
        totalPages: 0,
        message: `A API do PJE Comunica não retornou resultados para esta busca. Tente buscar pelo número do processo ou consulte diretamente o portal do tribunal.`
      };
    }
    
    throw new Error(`Erro na API do PJE: ${response.status}`);
  }

  const data = await response.json();
  console.log("PJE API response data keys:", Object.keys(data));
  
  return data;
}

// Fallback to DataJud API for process publications
async function searchDataJudPublicacoes(numeroProcesso: string): Promise<any> {
  const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
  const cleanedNumber = numeroProcesso.replace(/\D/g, '').padStart(20, '0');
  
  // Detect tribunal from CNJ number
  const tribunalCode = cleanedNumber.substring(13, 16);
  let tribunalEndpoint = "trt10"; // default
  
  // Map tribunal codes
  const tribunalMap: Record<string, string> = {
    "510": "trt10", // TRT10
    "501": "trt1",  // TRT1
    "502": "trt2",  // TRT2
    // State courts (8.XX)
    "801": "tjac", "802": "tjal", "803": "tjap", "804": "tjam",
    "805": "tjba", "806": "tjce", "807": "tjdf", "808": "tjes",
    "809": "tjgo", "810": "tjma", "811": "tjmt", "812": "tjms",
    "813": "tjmg", "814": "tjpa", "815": "tjpb", "816": "tjpr",
    "817": "tjpe", "818": "tjpi", "819": "tjrj", "820": "tjrn",
    "821": "tjrs", "822": "tjro", "823": "tjrr", "824": "tjsc",
    "825": "tjsp", "826": "tjse", "827": "tjto",
  };
  
  if (tribunalMap[tribunalCode]) {
    tribunalEndpoint = tribunalMap[tribunalCode];
  }
  
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalEndpoint}/_search`;
  
  console.log("DataJud fallback URL:", url);
  
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
    console.error("DataJud fallback error:", response.status);
    return { 
      publicacoes: [], 
      items: [],
      comunicacoes: [],
      totalElements: 0, 
      totalPages: 0,
      message: "Nenhuma publicação encontrada"
    };
  }

  const data = await response.json();
  const hits = data.hits?.hits || [];
  
  console.log("DataJud fallback hits:", hits.length);
  
  if (hits.length === 0) {
    return { 
      publicacoes: [], 
      items: [],
      comunicacoes: [],
      totalElements: 0, 
      totalPages: 0,
      message: "Nenhuma publicação encontrada para este processo"
    };
  }

  const processo = hits[0]._source;
  const publicacoes = (processo.movimentos || [])
    .filter((m: any) => 
      m.nome?.toLowerCase().includes('publicação') ||
      m.nome?.toLowerCase().includes('diário') ||
      m.complemento?.toLowerCase().includes('dje') ||
      m.complemento?.toLowerCase().includes('intimação')
    )
    .map((m: any) => ({
      dataPublicacao: m.dataHora,
      tipo: m.nome,
      conteudo: m.complemento || m.nome,
      numeroProcesso: processo.numeroProcesso,
      fonte: "DataJud"
    }));

  return {
    publicacoes,
    items: publicacoes,
    comunicacoes: publicacoes,
    totalElements: publicacoes.length,
    totalPages: 1,
    fonte: "DataJud",
    success: true
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

    console.log("PJE Search request:", JSON.stringify(body));

    // Input validation
    const validationErrors: string[] = [];

    // Validate tipo
    const validTipos = ["advogado", "palavra-chave", "processo"];
    if (!validTipos.includes(tipo)) {
      validationErrors.push(`Tipo de busca inválido. Use: ${validTipos.join(", ")}`);
    }

    // Validate uf format (2 uppercase letters)
    if (uf && (typeof uf !== 'string' || !/^[A-Za-z]{2}$/.test(uf))) {
      validationErrors.push("UF deve ter exatamente 2 letras");
    }

    // Validate oab format
    if (oab && (typeof oab !== 'string' || oab.length > 20)) {
      validationErrors.push("OAB deve ter no máximo 20 caracteres");
    }

    // Validate date formats (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dataInicio && (typeof dataInicio !== 'string' || !datePattern.test(dataInicio))) {
      validationErrors.push("Data início deve estar no formato YYYY-MM-DD");
    }
    if (dataFim && (typeof dataFim !== 'string' || !datePattern.test(dataFim))) {
      validationErrors.push("Data fim deve estar no formato YYYY-MM-DD");
    }

    // Validate palavraChave length
    if (palavraChave && (typeof palavraChave !== 'string' || palavraChave.length > 200)) {
      validationErrors.push("Palavra-chave deve ter no máximo 200 caracteres");
    }

    // Validate numeroProcesso
    if (numeroProcesso) {
      const cleaned = String(numeroProcesso).replace(/\D/g, '');
      if (cleaned.length > 25) {
        validationErrors.push("Número do processo muito longo");
      }
    }

    // Validate pagination
    const validatedPagina = typeof pagina === 'number' ? Math.max(0, pagina) : 0;
    const validatedTamanhoPagina = typeof tamanhoPagina === 'number' ? Math.min(Math.max(1, tamanhoPagina), 100) : 20;

    // Return validation errors
    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Dados de entrada inválidos",
          details: validationErrors,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate type-specific requirements
    if (tipo === "advogado") {
      if (!oab || !uf) {
        return new Response(
          JSON.stringify({ error: "OAB e UF são obrigatórios para busca por advogado", success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (tipo === "palavra-chave") {
      if (!palavraChave || palavraChave.length < 3) {
        return new Response(
          JSON.stringify({ error: "Palavra-chave deve ter pelo menos 3 caracteres", success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (tipo === "processo") {
      if (!numeroProcesso) {
        return new Response(
          JSON.stringify({ error: "Número do processo é obrigatório", success: false }),
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
      pagina: validatedPagina,
      tamanhoPagina: validatedTamanhoPagina
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
