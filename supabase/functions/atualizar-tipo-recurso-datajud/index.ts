import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const TIMEOUT_MS = 12_000;

function limparNumero(num: string): string {
  return num.replace(/[^0-9]/g, "");
}

function extrairTRT(numeroProcesso: string): string {
  const digits = limparNumero(numeroProcesso);
  const trtNum = parseInt(digits.slice(14, 16), 10);
  if (Number.isNaN(trtNum) || trtNum < 1 || trtNum > 24) return "trt1";
  return `trt${trtNum}`;
}

interface ResultadoTipoRecurso {
  numero: string;
  tipo_recurso: string | null;
  fonte: string | null;
  erro: string | null;
}

// Same pattern as check-transito: simple fetch with AbortSignal.timeout
async function consultarTribunal(
  tribunal: string,
  digits: string,
): Promise<string | null> {
  const url = `${DATAJUD_BASE}/api_publica_${tribunal}/_search`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        size: 1,
        _source: ["numeroProcesso", "classe", "grau"],
        query: { match: { numeroProcesso: digits } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json() as { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } };
    const source = data?.hits?.hits?.[0]?._source;
    if (!source) return null;
    const classeNome = (source as any)?.classe?.nome;
    return classeNome ? String(classeNome) : null;
  } catch {
    return null;
  }
}

// Same pattern as check-transito: Promise.allSettled for TRT + TST in parallel
async function buscarTipoRecurso(numero: string): Promise<ResultadoTipoRecurso> {
  const digits = limparNumero(numero);
  if (digits.length < 10) {
    return { numero, tipo_recurso: null, fonte: null, erro: "Número inválido" };
  }

  const trtCode = extrairTRT(numero);

  // Parallel query to TRT + TST, exactly like check-transito
  const [resultTRT, resultTST] = await Promise.allSettled([
    consultarTribunal(trtCode, digits),
    consultarTribunal("tst", digits),
  ]);

  const classeTRT = resultTRT.status === "fulfilled" ? resultTRT.value : null;
  const classeTST = resultTST.status === "fulfilled" ? resultTST.value : null;

  // TRT first (origin), then TST
  if (classeTRT) {
    console.log(`[DataJud] FOUND ${digits} => ${classeTRT} (${trtCode.toUpperCase()})`);
    return { numero, tipo_recurso: classeTRT, fonte: trtCode.toUpperCase(), erro: null };
  }
  if (classeTST) {
    console.log(`[DataJud] FOUND ${digits} => ${classeTST} (TST)`);
    return { numero, tipo_recurso: classeTST, fonte: "TST", erro: null };
  }

  return { numero, tipo_recurso: null, fonte: null, erro: "Classe não encontrada" };
}

function respond(payload: { ok: boolean; resultados: ResultadoTipoRecurso[]; error?: string }) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    console.log(`[DataJud] Processando ${processos.length} processos (1 por vez, TRT+TST em paralelo)`);

    const resultados: ResultadoTipoRecurso[] = [];

    for (const processo of processos) {
      const resultado = await buscarTipoRecurso(processo);
      resultados.push(resultado);
    }

    const encontrados = resultados.filter(r => r.tipo_recurso).length;
    console.log(`[DataJud] Resultado: ${encontrados}/${processos.length} encontrados`);

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
