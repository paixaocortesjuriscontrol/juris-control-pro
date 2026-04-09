import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_TIMEOUT_MS = 15_000;

// Mapa de tribunais baseado na numeração única
const TRIBUNAIS_MAP: Record<string, { endpoint: string; nome: string }> = {
  "5": {
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

function getEndpoint(numero: string): string | null {
  const digits = limparNumero(numero);
  // TST processes: segment J=5, tribunal=00 or specific pattern
  // Format: NNNNNNN-DD.AAAA.J.TT.OOOO (20 digits without punctuation)
  if (digits.length >= 14) {
    const j = digits[13]; // Justice segment (position 14, 0-indexed 13)
    if (j === "5") {
      const tt = digits.substring(14, 16); // tribunal code
      const ttNum = parseInt(tt, 10);
      if (ttNum === 0) return "api_publica_tst";
      const trt = TRIBUNAIS_MAP["5"]?.[String(ttNum)];
      if (trt) return trt.endpoint;
    }
  }
  // Default to TST for most cases
  return "api_publica_tst";
}

interface ResultadoProcesso {
  numero: string;
  situacao: string;
  data_transito: string | null;
  erro: string | null;
}

async function verificarProcesso(numero: string): Promise<ResultadoProcesso> {
  const digits = limparNumero(numero);
  if (digits.length < 10) {
    return { numero, situacao: "Erro", data_transito: null, erro: "Número inválido" };
  }

  const endpoint = getEndpoint(numero);
  if (!endpoint) {
    return { numero, situacao: "Erro", data_transito: null, erro: "Tribunal não identificado" };
  }

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
        query: {
          match: { numeroProcesso: digits },
        },
        size: 1,
        _source: ["numeroProcesso", "movimentos", "classe", "dataAjuizamento", "grau"],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      console.error(`Erro API ${endpoint}:`, response.status, text);
      return { numero, situacao: "Erro", data_transito: null, erro: `API retornou ${response.status}` };
    }

    const data = await response.json();
    const hits = data?.hits?.hits || [];

    if (hits.length === 0) {
      return { numero, situacao: "Não encontrado", data_transito: null, erro: null };
    }

    const source = hits[0]._source;
    const movimentos = source?.movimentos || [];

    // Search for movement code 848 (Trânsito em Julgado)
    let transitoDate: string | null = null;
    for (const mov of movimentos) {
      const codigo = mov?.codigo ?? mov?.movimentoNacional?.codigoNacional;
      if (codigo === 848 || codigo === "848") {
        transitoDate = mov?.dataHora || mov?.data || null;
        break;
      }
      // Also check complementos and nested codes
      const complementos = mov?.complementosTabelados || [];
      for (const comp of complementos) {
        if (comp?.codigo === 848 || comp?.codigo === "848") {
          transitoDate = mov?.dataHora || mov?.data || null;
          break;
        }
      }
      if (transitoDate) break;
    }

    // Also check if "Trânsito em Julgado" appears in movement names
    if (!transitoDate) {
      for (const mov of movimentos) {
        const nome = (mov?.nome || mov?.descricao || "").toLowerCase();
        if (nome.includes("trânsito em julgado") || nome.includes("transito em julgado")) {
          transitoDate = mov?.dataHora || mov?.data || null;
          break;
        }
      }
    }

    if (transitoDate) {
      return {
        numero,
        situacao: "Trânsito em Julgado",
        data_transito: transitoDate.substring(0, 10),
        erro: null,
      };
    }

    return { numero, situacao: "Ativo", data_transito: null, erro: null };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { numero, situacao: "Erro", data_transito: null, erro: "Timeout na API" };
    }
    return { numero, situacao: "Erro", data_transito: null, erro: err.message || "Erro desconhecido" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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

    // Validate user
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

    // Process in batches of 5 to respect rate limits
    const BATCH_SIZE = 5;
    const resultados: ResultadoProcesso[] = [];

    for (let i = 0; i < processos.length; i += BATCH_SIZE) {
      const batch = processos.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((p) => verificarProcesso(p)));
      resultados.push(...batchResults);

      // Small delay between batches
      if (i + BATCH_SIZE < processos.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Update dados_benner situacao_processo for matching records
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
