import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_TIMEOUT_MS = 10_000;

function limparNumero(num: string): string {
  return num.replace(/[^0-9]/g, "");
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

async function queryEndpoint(
  endpoint: string,
  digits: string,
  requestSignal?: AbortSignal,
): Promise<{ hits: any[]; error?: string }> {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;

  let abortFromClient: (() => void) | undefined;

  try {
    const controller = new AbortController();
    abortFromClient = () => controller.abort("client-aborted");
    requestSignal?.addEventListener("abort", abortFromClient, { once: true });
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
      return { hits: [], error: requestSignal?.aborted ? "Cancelado" : "Timeout na API" };
    }
    return { hits: [], error: err.message || "Erro desconhecido" };
  } finally {
    if (abortFromClient) {
      requestSignal?.removeEventListener("abort", abortFromClient);
    }
  }
}

async function buscarTipoRecurso(numero: string, requestSignal?: AbortSignal): Promise<ResultadoTipoRecurso> {
  const digits = limparNumero(numero);
  if (digits.length < 10) {
    return { numero, tipo_recurso: null, fonte: null, erro: "Número inválido" };
  }

  if (requestSignal?.aborted) {
    return { numero, tipo_recurso: null, fonte: null, erro: "Cancelado" };
  }

  let bestClasse: string | null = null;
  let lastError: string | null = null;

  const result = await queryEndpoint("api_publica_tst", digits, requestSignal);
  if (result.error === "Cancelado") {
    return { numero, tipo_recurso: null, fonte: null, erro: "Cancelado" };
  }
  if (result.error) lastError = result.error;

  for (const hit of result.hits) {
    const classeNome = hit._source?.classe?.nome;
    if (classeNome) {
      bestClasse = classeNome;
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

  console.log(`Processo ${numero}: classe="${bestClasse}" fonte=TST`);
  return { numero, tipo_recurso: bestClasse, fonte: "TST", erro: null };
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
    const requestSignal = req.signal;

    if (!processos.length) {
      return respond({ ok: false, resultados: [], error: "Nenhum processo informado" });
    }

    const resultados: ResultadoTipoRecurso[] = [];

    for (let i = 0; i < processos.length; i++) {
      if (requestSignal.aborted) {
        break;
      }

      const resultado = await buscarTipoRecurso(processos[i], requestSignal);
      if (resultado.erro === "Cancelado") {
        break;
      }

      resultados.push(resultado);
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
