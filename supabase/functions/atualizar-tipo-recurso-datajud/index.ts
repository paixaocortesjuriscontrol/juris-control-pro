import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_TIMEOUT_MS = 10_000;

const TRT_ENDPOINTS: Record<string, { endpoint: string; nome: string }> = {
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
};

function limparNumero(num: string): string {
  return num.replace(/[^0-9]/g, "");
}

function getTRTFromProcesso(digits: string): string | null {
  if (digits.length >= 16) {
    const trt = parseInt(digits.substring(14, 16), 10).toString();
    if (TRT_ENDPOINTS[trt]) return trt;
  }
  return null;
}

function getEndpoints(numero: string): { endpoint: string; nome: string }[] {
  const digits = limparNumero(numero);
  const trt = getTRTFromProcesso(digits);

  if (trt && TRT_ENDPOINTS[trt]) {
    return [TRT_ENDPOINTS[trt], { endpoint: "api_publica_tst", nome: "TST" }];
  }

  return [{ endpoint: "api_publica_tst", nome: "TST" }];
}

interface ResultadoTipoRecurso {
  numero: string;
  tipo_recurso: string | null;
  fonte: string | null;
  erro: string | null;
}

function respond(payload: { ok: boolean; resultados: ResultadoTipoRecurso[]; error?: string }) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function queryEndpoint(endpoint: string, digits: string): Promise<{ hits: any[]; error?: string }> {
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
        size: 5,
        _source: ["numeroProcesso", "classe", "grau"],
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

async function buscarTipoRecurso(numero: string): Promise<ResultadoTipoRecurso> {
  const digits = limparNumero(numero);
  if (digits.length < 10) {
    return { numero, tipo_recurso: null, fonte: null, erro: "Número inválido" };
  }

  const endpoints = getEndpoints(numero);
  let bestClasse: string | null = null;
  let bestFonte: string | null = null;
  let lastError: string | null = null;

  for (const ep of endpoints) {
    const result = await queryEndpoint(ep.endpoint, digits);
    if (result.error) lastError = result.error;

    for (const hit of result.hits) {
      const classeNome = hit._source?.classe?.nome;
      if (classeNome) {
        // TST takes priority, so keep overwriting
        bestClasse = classeNome;
        bestFonte = ep.nome;
      }
    }
  }

  if (!bestClasse) {
    return {
      numero,
      tipo_recurso: null,
      fonte: null,
      erro: lastError || "Classe não encontrada",
    };
  }

  console.log(`Processo ${numero}: classe="${bestClasse}" fonte=${bestFonte}`);
  return { numero, tipo_recurso: bestClasse, fonte: bestFonte, erro: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let processos: string[] = [];

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ ok: false, resultados: [], error: "Não autorizado" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !user) {
      return respond({ ok: false, resultados: [], error: "Não autorizado" });
    }

    const body = await req.json();
    processos = body?.processos || [];
    const ids_benner: string[] = body?.ids_benner || [];

    if (!processos.length) {
      return respond({ ok: false, resultados: [], error: "Nenhum processo informado" });
    }

    const BATCH_SIZE = 2;
    const resultados: ResultadoTipoRecurso[] = [];

    for (let i = 0; i < processos.length; i += BATCH_SIZE) {
      const batch = processos.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((p) => buscarTipoRecurso(p)));
      resultados.push(...batchResults);

      if (i + BATCH_SIZE < processos.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Update dados_benner with found tipo_recurso
    if (ids_benner.length > 0) {
      for (let i = 0; i < ids_benner.length; i++) {
        const id = ids_benner[i];
        const resultado = resultados[i];
        if (resultado && resultado.tipo_recurso) {
          await supabase
            .from("dados_benner")
            .update({
              tipo_recurso: resultado.tipo_recurso,
              tipo_recurso_auto: true,
            } as any)
            .eq("id", id);
        }
      }
    }

    return respond({ ok: true, resultados });
  } catch (err: any) {
    console.error("Erro:", err);
    return respond({
      ok: false,
      error: err.message || "Erro interno",
      resultados: processos.map((numero) => ({
        numero,
        tipo_recurso: null,
        fonte: null,
        erro: err.message || "Erro interno",
      })),
    });
  }
});
