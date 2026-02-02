import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const dataInicio = body?.dataInicio as string | undefined;
    const dataFim = body?.dataFim as string | undefined;
    const conservative = body?.conservative === true;
    const indexMode = body?.indexMode as string | undefined;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Limpar flag de cancelamento antes de disparar (evita “clique sem efeito”)
    try {
      const { data } = await supabase
        .from("configuracoes_monitoramento")
        .select("metadata")
        .eq("tipo", "djen")
        .is("coordenacao_id", null)
        .maybeSingle();
      const meta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from("configuracoes_monitoramento")
        .update({
          metadata: {
            ...meta,
            cancelado: false,
            paused_globally: false,
            status: "aguardando",
            last_stop_reason: null,
            mensagem: "Disparo enviado ao backend",
          },
        })
        .eq("tipo", "djen")
        .is("coordenacao_id", null);
    } catch (e) {
      console.warn("[DJEN Trigger] Falha ao limpar cancelado:", e);
    }

    // Criar execução para o dashboard e obter execucaoId
    let execucaoId: string | undefined;
    try {
      const { data: execucao, error: execucaoError } = await supabase
        .from("execucoes_agendadas")
        .insert({
          tipo: "djen",
          status: "executando",
          iniciado_em: new Date().toISOString(),
          detalhes: {
            progress: { current: 0, total: 0, percentage: 0 },
            modo: "background",
          },
        })
        .select("id")
        .single();
      if (execucaoError) throw execucaoError;
      execucaoId = execucao?.id;

      // Salvar execucaoId no metadata para referência
      const { data } = await supabase
        .from("configuracoes_monitoramento")
        .select("metadata")
        .eq("tipo", "djen")
        .is("coordenacao_id", null)
        .maybeSingle();
      const meta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from("configuracoes_monitoramento")
        .update({
          metadata: {
            ...meta,
            execucaoId,
            paused_globally: false,
            status: "em_andamento",
            current: 0,
            total: 0,
            percentage: 0,
          },
        })
        .eq("tipo", "djen")
        .is("coordenacao_id", null);
    } catch (e) {
      console.warn("[DJEN Trigger] Falha ao criar execucao_agendada:", e);
    }

    // Disparar execução principal em background (fire-and-forget)
    const url = `${supabaseUrl}/functions/v1/monitorar-djen`;
    const payload = {
      completeRun: true,
      dataInicio,
      dataFim,
      conservative,
      scheduled: true,
      continued: false,
      manual: true,
      indexMode,
      execucaoId,
    };

    const dispatchPromise = fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error("[DJEN Trigger] Failed to dispatch:", err);
    });

    // Garantir que o background continue após resposta (quando suportado)
    const waitUntil = (globalThis as any)?.EdgeRuntime?.waitUntil;
    if (typeof waitUntil === "function") {
      waitUntil(dispatchPromise);
    }

    return new Response(
      JSON.stringify({ success: true, dispatched: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
