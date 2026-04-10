import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_TIMEOUT_MS = 8_000;

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

async function queryEndpoint(endpoint: string, digits: string): Promise<{ classe: string | null; fonte: string; error?: string }> {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);

    const reqBody = {
      query: { match: { numeroProcesso: digits } },
      size: 1,
      _source: ["numeroProcesso", "classe"],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DataJud] ${endpoint} HTTP ${response.status} for ${digits}: ${errorText.substring(0, 200)}`);
      return { classe: null, fonte: endpoint, error: `API ${response.status}` };
    }

    const data = await response.json();
    const totalHits = data?.hits?.total?.value ?? data?.hits?.total ?? 0;
    const hits = data?.hits?.hits || [];
    
    console.log(`[DataJud] ${endpoint} | processo=${digits} | totalHits=${totalHits} | hits=${hits.length}`);
    
    if (hits.length > 0) {
      const source = hits[0]._source;
      console.log(`[DataJud] ${endpoint} | _source=${JSON.stringify(source)}`);
      const classeNome = source?.classe?.nome;
      if (classeNome) {
        return { classe: classeNome, fonte: endpoint };
      }
    }
    return { classe: null, fonte: endpoint };
  } catch (err: any) {
    const errMsg = err.name === "AbortError" ? "Timeout" : (err.message || "Erro");
    console.error(`[DataJud] ${endpoint} | processo=${digits} | error=${errMsg}`);
    return { classe: null, fonte: endpoint, error: errMsg };
  }
}

async function buscarTipoRecurso(numero: string): Promise<ResultadoTipoRecurso> {
  const digits = limparNumero(numero);
  if (digits.length < 10) {
    return { numero, tipo_recurso: null, fonte: null, erro: "Número inválido" };
  }

  const trt = getTRTFromProcesso(digits);

  // Query TRT and TST in PARALLEL
  const trtPromise = trt && TRT_ENDPOINTS[trt]
    ? queryEndpoint(TRT_ENDPOINTS[trt].endpoint, digits)
    : Promise.resolve(null);
  const tstPromise = queryEndpoint("api_publica_tst", digits);

  const [trtResult, tstResult] = await Promise.all([trtPromise, tstPromise]);

  // TST takes priority over TRT
  if (tstResult.classe) {
    return { numero, tipo_recurso: tstResult.classe, fonte: "TST", erro: null };
  }
  if (trtResult?.classe) {
    const trtNome = TRT_ENDPOINTS[trt!]?.nome || `TRT${trt}`;
    return { numero, tipo_recurso: trtResult.classe, fonte: trtNome, erro: null };
  }

  const lastError = tstResult.error || trtResult?.error || "Classe não encontrada";
  return { numero, tipo_recurso: null, fonte: null, erro: lastError };
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

    console.log(`[DataJud] Recebidos ${processos.length} processos. Primeiros: ${processos.slice(0, 3).join(", ")}`);

    // Process ALL in parallel (no sub-batching, no delays)
    const resultados = await Promise.all(processos.map((p) => buscarTipoRecurso(p)));

    const encontrados = resultados.filter(r => r.tipo_recurso).length;
    const erros = resultados.filter(r => r.erro).length;
    console.log(`[DataJud] Resultados: ${encontrados} encontrados, ${erros} erros de ${processos.length} total`);

    // Update dados_benner with found tipo_recurso
    const updates = ids_benner
      .map((id, i) => ({ id, resultado: resultados[i] }))
      .filter(({ resultado }) => resultado?.tipo_recurso);

    if (updates.length > 0) {
      await Promise.all(
        updates.map(({ id, resultado }) =>
          supabase
            .from("dados_benner")
            .update({
              tipo_recurso: resultado.tipo_recurso,
              tipo_recurso_auto: true,
            } as any)
            .eq("id", id)
        )
      );
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
