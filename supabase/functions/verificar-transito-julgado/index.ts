import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_TIMEOUT_MS = 20_000;

const TRIBUNAIS_MAP: Record<string, Record<string, { endpoint: string; nome: string }>> = {
  "5": {
    "0": { endpoint: "api_publica_tst", nome: "TST" },
    "1": { endpoint: "api_publica_trt1", nome: "TRT1" },
    "2": { endpoint: "api_publica_trt2", nome: "TRT2" },
    "3": { endpoint: "api_publica_trt3", nome: "TRT3" },
    "4": { endpoint: "api_publica_trt4", nome: "TRT4" },
    "5": { endpoint: "api_publica_trt5", nome: "TRT5" },
    "6": { endpoint: "api_publica_trt6", nome: "TRT6" },
    "7": { endpoint: "api_publica_trt7", nome: "TRT7" },
    "8": { endpoint: "api_publica_trt8", nome: "TRT8" },
    "9": { endpoint: "api_publica_trt9", nome: "TRT9" },
    "10": { endpoint: "api_publica_trt10", nome: "TRT10" },
    "11": { endpoint: "api_publica_trt11", nome: "TRT11" },
    "12": { endpoint: "api_publica_trt12", nome: "TRT12" },
    "13": { endpoint: "api_publica_trt13", nome: "TRT13" },
    "14": { endpoint: "api_publica_trt14", nome: "TRT14" },
    "15": { endpoint: "api_publica_trt15", nome: "TRT15" },
    "16": { endpoint: "api_publica_trt16", nome: "TRT16" },
    "17": { endpoint: "api_publica_trt17", nome: "TRT17" },
    "18": { endpoint: "api_publica_trt18", nome: "TRT18" },
    "19": { endpoint: "api_publica_trt19", nome: "TRT19" },
    "20": { endpoint: "api_publica_trt20", nome: "TRT20" },
    "21": { endpoint: "api_publica_trt21", nome: "TRT21" },
    "22": { endpoint: "api_publica_trt22", nome: "TRT22" },
    "23": { endpoint: "api_publica_trt23", nome: "TRT23" },
    "24": { endpoint: "api_publica_trt24", nome: "TRT24" },
  },
};

function limparNumero(num: string): string {
  return num.replace(/[^0-9]/g, "");
}

function getEndpoints(numero: string): { endpoint: string; nome: string }[] {
  const digits = limparNumero(numero);
  const endpoints: { endpoint: string; nome: string }[] = [];

  if (digits.length >= 16) {
    const j = digits[13]; // Justice segment
    const tt = digits.substring(14, 16);
    const ttNum = parseInt(tt, 10);

    if (j === "5") {
      // TRT origin endpoint (where process was filed)
      const trt = TRIBUNAIS_MAP["5"]?.[String(ttNum)];
      if (trt) endpoints.push(trt);
      // Also search TST (superior court)
      if (ttNum !== 0) endpoints.push({ endpoint: "api_publica_tst", nome: "TST" });
    }
  }

  if (endpoints.length === 0) {
    endpoints.push({ endpoint: "api_publica_tst", nome: "TST" });
  }

  return endpoints;
}

interface ResultadoProcesso {
  numero: string;
  situacao: string;
  data_transito: string | null;
  grau: string | null;
  erro: string | null;
}

function checkTransitoInMovimentos(movimentos: any[]): { found: boolean; date: string | null } {
  // Search for movement code 848 (Trânsito em Julgado)
  for (const mov of movimentos) {
    const codigo = mov?.codigo ?? mov?.movimentoNacional?.codigoNacional;
    if (codigo === 848 || codigo === "848") {
      return { found: true, date: mov?.dataHora || mov?.data || null };
    }
    // Check complementos
    const complementos = mov?.complementosTabelados || [];
    for (const comp of complementos) {
      if (comp?.codigo === 848 || comp?.codigo === "848") {
        return { found: true, date: mov?.dataHora || mov?.data || null };
      }
    }
  }

  // Search by movement name
  for (const mov of movimentos) {
    const nome = (mov?.nome || mov?.descricao || "").toLowerCase();
    if (nome.includes("trânsito em julgado") || nome.includes("transito em julgado")) {
      return { found: true, date: mov?.dataHora || mov?.data || null };
    }
  }

  // Note: code 22 (Baixa Definitiva) was removed as indicator because it often just means
  // records were returned to a lower court after an appeal, not actual trânsito em julgado.

  return { found: false, date: null };
}

async function queryEndpoint(
  endpoint: string,
  digits: string
): Promise<{ hits: any[]; error?: string }> {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: digits } },
        size: 10, // Get ALL graus/instances
        _source: ["numeroProcesso", "movimentos", "classe", "grau"],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      console.error(`Erro API ${endpoint}:`, response.status, text);
      return { hits: [], error: `API retornou ${response.status}` };
    }

    const data = await response.json();
    return { hits: data?.hits?.hits || [] };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { hits: [], error: "Timeout na API" };
    }
    return { hits: [], error: err.message || "Erro desconhecido" };
  }
}

async function verificarProcesso(numero: string): Promise<ResultadoProcesso> {
  const digits = limparNumero(numero);
  if (digits.length < 10) {
    return { numero, situacao: "Erro", data_transito: null, grau: null, erro: "Número inválido" };
  }

  const endpoints = getEndpoints(numero);
  let allHits: any[] = [];
  let lastError: string | null = null;

  // Query all relevant endpoints (TRT + TST)
  for (const ep of endpoints) {
    const result = await queryEndpoint(ep.endpoint, digits);
    if (result.hits.length > 0) {
      allHits.push(...result.hits);
    }
    if (result.error) lastError = result.error;
  }

  if (allHits.length === 0) {
    return {
      numero,
      situacao: lastError ? "Erro" : "Não encontrado",
      data_transito: null,
      grau: null,
      erro: lastError,
    };
  }

  console.log(`Processo ${numero}: ${allHits.length} instância(s) encontrada(s) em ${endpoints.map(e => e.nome).join(", ")}`);

  // Check each instance/grau for Trânsito em Julgado
  for (const hit of allHits) {
    const source = hit._source;
    const movimentos = source?.movimentos || [];
    const grau = source?.grau || "?";
    const classe = source?.classe?.nome || "";

    const result = checkTransitoInMovimentos(movimentos);
    if (result.found) {
      const dateStr = result.date ? result.date.substring(0, 10) : null;
      console.log(`  Trânsito encontrado em ${grau} (${classe}): ${dateStr}`);
      return {
        numero,
        situacao: "Trânsito em Julgado",
        data_transito: dateStr,
        grau: `${grau} - ${classe}`,
        erro: null,
      };
    }
  }

  // List graus found for debugging
  const graus = allHits.map(h => `${h._source?.grau || "?"} (${h._source?.classe?.nome || ""})`).join(", ");
  console.log(`  Nenhum trânsito encontrado. Graus: ${graus}`);

  return { numero, situacao: "Ativo", data_transito: null, grau: graus, erro: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const processos: string[] = body?.processos || [];
    const ids_benner: string[] = body?.ids_benner || [];

    if (!processos.length) {
      return new Response(JSON.stringify({ error: "Nenhum processo informado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in batches of 3 (each process now queries multiple endpoints)
    const BATCH_SIZE = 3;
    const resultados: ResultadoProcesso[] = [];

    for (let i = 0; i < processos.length; i += BATCH_SIZE) {
      const batch = processos.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((p) => verificarProcesso(p)));
      resultados.push(...batchResults);

      if (i + BATCH_SIZE < processos.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // Update dados_benner situacao_processo
    if (ids_benner.length > 0) {
      for (let i = 0; i < ids_benner.length; i++) {
        const id = ids_benner[i];
        const resultado = resultados[i];
        if (resultado && resultado.situacao !== "Erro" && resultado.situacao !== "Não encontrado") {
          const situacaoTexto = resultado.data_transito
            ? `${resultado.situacao} (${resultado.data_transito})`
            : resultado.situacao;
          await supabase
            .from("dados_benner")
            .update({ situacao_processo: situacaoTexto } as any)
            .eq("id", id);
        }
      }
    }

    return new Response(JSON.stringify({ resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
