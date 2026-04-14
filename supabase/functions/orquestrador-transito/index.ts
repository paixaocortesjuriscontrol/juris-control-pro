import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { classificarMovimento } from "../_shared/classificador.ts";
import {
  calcularStatusTransito,
  MovimentacaoClassificada,
} from "../_shared/calculador-transito.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação ausente" }),
        { status: 401, headers }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const juditApiKey = Deno.env.get("JUDIT_API_KEY");

    if (!juditApiKey) {
      return new Response(
        JSON.stringify({ error: "JUDIT_API_KEY não configurada" }),
        { status: 500, headers }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers }
      );
    }

    // ── Input ──
    const { processo_id } = await req.json();
    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: "processo_id é obrigatório" }),
        { status: 400, headers }
      );
    }

    // ── Buscar processo ──
    const { data: processo, error: procError } = await anonClient
      .from("processos")
      .select("id, numero, tribunal")
      .eq("id", processo_id)
      .maybeSingle();

    if (procError || !processo) {
      return new Response(
        JSON.stringify({ error: "Processo não encontrado ou sem acesso" }),
        { status: 404, headers }
      );
    }

    const numeroCnj = processo.numero?.trim();
    if (!numeroCnj) {
      return new Response(
        JSON.stringify({ error: "Processo sem número CNJ cadastrado" }),
        { status: 400, headers }
      );
    }

    console.log(`[orquestrador] Início para CNJ: ${numeroCnj}`);

    // ══════════════════════════════════════════════════════
    // ETAPA 1: Consultar API Judit e gravar resposta bruta
    // ══════════════════════════════════════════════════════
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let payloadResposta: any = null;
    let statusHttp: number;
    let erro: string | null = null;

    try {
      const juditResponse = await fetch(
        `https://lawsuits.production.judit.io/lawsuits/${encodeURIComponent(numeroCnj)}`,
        {
          method: "GET",
          headers: {
            "api-key": juditApiKey,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );
      statusHttp = juditResponse.status;

      if (juditResponse.ok) {
        payloadResposta = await juditResponse.json();
      } else {
        erro = await juditResponse.text();
      }
    } catch (fetchError: any) {
      statusHttp = 0;
      erro =
        fetchError.name === "AbortError"
          ? "Timeout de 30s excedido"
          : fetchError.message;
    } finally {
      clearTimeout(timeout);
    }

    // Gravar consulta bruta para auditoria
    await serviceClient.from("consultas_judit").insert({
      processo_id,
      requisitada_em: new Date().toISOString(),
      status_http: statusHttp,
      payload_resposta: payloadResposta,
      erro,
    });

    if (erro || !payloadResposta) {
      console.error(`[orquestrador] Judit error: ${erro}`);
      return new Response(
        JSON.stringify({
          error: `Erro na API Judit (HTTP ${statusHttp})`,
          detalhe: erro,
        }),
        { status: 502, headers }
      );
    }

    // ══════════════════════════════════════════════════════
    // ETAPA 2: Extrair e persistir movimentações brutas
    // ══════════════════════════════════════════════════════
    const rd = payloadResposta.response_data || payloadResposta;
    const steps = rd.steps || payloadResposta.steps || [];

    console.log(`[orquestrador] ${steps.length} steps encontrados`);

    let movCount = 0;
    const movimentacoesParaClassificar: Array<{
      data: string;
      descricao: string;
      codigo: string | null;
    }> = [];

    for (const step of steps) {
      const dataMovimentacao =
        step.step_date || step.date || step.movement_date;
      const descricao =
        step.content || step.title || step.description || "";
      const codigo = step.code || step.movement_code || null;

      if (!dataMovimentacao || !descricao) continue;

      const descStr =
        typeof descricao === "string" ? descricao : JSON.stringify(descricao);
      const dataStr =
        typeof dataMovimentacao === "string"
          ? dataMovimentacao.substring(0, 10)
          : dataMovimentacao;

      movimentacoesParaClassificar.push({
        data: dataStr,
        descricao: descStr,
        codigo,
      });

      // Inserir no banco (ignorar duplicatas)
      await serviceClient.from("movimentacoes").upsert(
        {
          processo_id,
          data_movimentacao: dataMovimentacao,
          descricao: descStr,
          codigo,
          tipo: "judit",
          fonte: "judit_api",
          raw: step,
        },
        { onConflict: "processo_id,data_movimentacao,descricao", ignoreDuplicates: true }
      );

      movCount++;
    }

    // ══════════════════════════════════════════════════════
    // ETAPA 3: Classificar movimentações
    // ══════════════════════════════════════════════════════
    console.log(`[orquestrador] Classificando ${movimentacoesParaClassificar.length} movimentações`);

    const movimentacoesClassificadas: MovimentacaoClassificada[] =
      movimentacoesParaClassificar.map((m) => {
        const classificacao = classificarMovimento({
          codigo: m.codigo,
          descricao: m.descricao,
          data: m.data,
        });

        return {
          data: m.data,
          descricao: m.descricao,
          codigo: m.codigo,
          ...classificacao,
        };
      });

    // Atualizar flags de classificação no banco
    for (const mc of movimentacoesClassificadas) {
      if (
        mc.eh_decisao_recorrivel ||
        mc.eh_recurso_interposto ||
        mc.eh_certidao_transito
      ) {
        // Atualizar apenas os que têm algum flag verdadeiro
        await serviceClient
          .from("movimentacoes")
          .update({
            eh_decisao_recorrivel: mc.eh_decisao_recorrivel,
            eh_recurso_interposto: mc.eh_recurso_interposto,
            eh_certidao_transito: mc.eh_certidao_transito,
          })
          .eq("processo_id", processo_id)
          .eq("descricao", mc.descricao)
          .gte("data_movimentacao", mc.data + "T00:00:00")
          .lte("data_movimentacao", mc.data + "T23:59:59");
      }
    }

    // ══════════════════════════════════════════════════════
    // ETAPA 4: Calcular status de trânsito em julgado
    // ══════════════════════════════════════════════════════
    const tribunalOrigem = processo.tribunal || "TRT";

    const resultado = calcularStatusTransito(movimentacoesClassificadas, {
      tribunal_origem: tribunalOrigem,
    });

    console.log(
      `[orquestrador] Status: ${resultado.status} | Justificativa: ${resultado.justificativa}`
    );

    // ══════════════════════════════════════════════════════
    // ETAPA 5: Atualizar processo no banco
    // ══════════════════════════════════════════════════════
    const updateData: Record<string, any> = {
      ultima_consulta_judit: new Date().toISOString(),
      status_transito: resultado.status === "transitado_confirmado"
        ? "transitado_confirmado"
        : resultado.status === "transitado_provavel"
        ? "transitado_provavel"
        : "em_curso",
    };

    if (resultado.data_transito_estimada) {
      updateData.data_transito_estimada = resultado.data_transito_estimada;
    }

    // Atualizar também o campo boolean legado transitado_julgado
    if (
      resultado.status === "transitado_confirmado" ||
      resultado.status === "transitado_provavel"
    ) {
      updateData.transitado_julgado = true;
    }

    await serviceClient
      .from("processos")
      .update(updateData)
      .eq("id", processo_id);

    console.log(`[orquestrador] Processo ${processo_id} atualizado`);

    // ── Resposta final ──
    return new Response(
      JSON.stringify({
        success: true,
        movimentacoes_count: movCount,
        classificadas: movimentacoesClassificadas.filter(
          (m) =>
            m.eh_decisao_recorrivel ||
            m.eh_recurso_interposto ||
            m.eh_certidao_transito
        ).length,
        status_transito: resultado.status,
        data_transito_estimada: resultado.data_transito_estimada,
        justificativa: resultado.justificativa,
      }),
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error("[orquestrador] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers }
    );
  }
});
