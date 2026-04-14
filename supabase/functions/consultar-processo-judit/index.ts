import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extrairOrgaoJulgador } from "../_shared/extrair-relator.ts";

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

    // Verificar usuário autenticado
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
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

    // ── Buscar processo (RLS garante que user só vê seus dados) ──
    const { data: processo, error: procError } = await anonClient
      .from("processos")
      .select("id, numero")
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

    console.log(`[consultar-processo-judit] CNJ: ${numeroCnj}`);

    // ── Chamar API Judit ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let juditResponse: Response;
    let statusHttp: number;
    let payloadResposta: any = null;
    let erro: string | null = null;

    try {
      juditResponse = await fetch(
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
          ? "Timeout de 30s excedido na chamada à Judit"
          : fetchError.message;
    } finally {
      clearTimeout(timeout);
    }

    // ── Gravar consulta bruta (auditoria) ──
    await supabaseAuth.from("consultas_judit").insert({
      processo_id,
      requisitada_em: new Date().toISOString(),
      status_http: statusHttp,
      payload_resposta: payloadResposta,
      erro,
    });

    // Se houve erro na Judit, retornar 502
    if (erro || !payloadResposta) {
      console.error(`[consultar-processo-judit] Judit error: ${erro}`);
      return new Response(
        JSON.stringify({
          error: `Erro na API Judit (HTTP ${statusHttp})`,
          detalhe: erro,
        }),
        { status: 502, headers }
      );
    }

    // ── Extrair e persistir movimentações ──
    const rd = payloadResposta.response_data || payloadResposta;
    const steps = rd.steps || payloadResposta.steps || [];

    console.log(`[consultar-processo-judit] ${steps.length} steps encontrados`);

    let movCount = 0;

    for (const step of steps) {
      const dataMovimentacao =
        step.step_date || step.date || step.movement_date;
      const descricao =
        step.content || step.title || step.description || "";
      const codigo = step.code || step.movement_code || null;

      if (!dataMovimentacao || !descricao) continue;

      // UPSERT: usa processo_id + data + descricao como chave lógica
      const { error: upsertError } = await supabaseAuth
        .from("movimentacoes")
        .upsert(
          {
            processo_id,
            data_movimentacao: dataMovimentacao,
            descricao: typeof descricao === "string" ? descricao : JSON.stringify(descricao),
            codigo,
            tipo: "judit",
            fonte: "judit_api",
            raw: step,
            // NÃO preenche eh_decisao_recorrivel, eh_recurso_interposto, eh_certidao_transito
            // Isso é feito pelo classificador (Prompt 3)
          },
          {
            onConflict: "processo_id,data_movimentacao,descricao",
            ignoreDuplicates: true,
          }
        );

      if (upsertError) {
        // Se falhar por conflito, inserir individualmente ignorando duplicatas
        console.warn(`[consultar-processo-judit] upsert warn: ${upsertError.message}`);
        // Tenta insert simples ignorando erro de duplicata
        await supabaseAuth.from("movimentacoes").insert({
          processo_id,
          data_movimentacao: dataMovimentacao,
          descricao: typeof descricao === "string" ? descricao : JSON.stringify(descricao),
          codigo,
          tipo: "judit",
          fonte: "judit_api",
          raw: step,
        });
      }

      movCount++;
    }

    // ── Extrair relator e turma dos movimentos ──
    const orgaoJulgador = extrairOrgaoJulgador(steps);
    console.log(`[consultar-processo-judit] Órgão julgador extraído:`, JSON.stringify(orgaoJulgador));

    // ── Atualizar processo com metadados ──
    const updateData: Record<string, unknown> = {
      ultima_consulta_judit: new Date().toISOString(),
    };

    if (orgaoJulgador.relator) {
      updateData.relator = orgaoJulgador.relator;
    }
    if (orgaoJulgador.turma) {
      // Usa tribunal (ex: "TST") + turma (ex: "6ª Turma") como tribunal_atual
      updateData.tribunal = orgaoJulgador.turma;
    }

    await supabaseAuth
      .from("processos")
      .update(updateData)
      .eq("id", processo_id);

    console.log(
      `[consultar-processo-judit] Concluído: ${movCount} movimentações processadas`
    );

    return new Response(
      JSON.stringify({ success: true, movimentacoes_count: movCount }),
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error("[consultar-processo-judit] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers }
    );
  }
});
