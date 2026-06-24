import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Job de Acompanhamento Especial — usa Judit para varrer todos os processos
 * marcados com `acompanhamento_especial=true`. Para cada novo step encontrado
 * (com `step_date` posterior ao `acompanhamento_ultimo_step_date`):
 *  - grava em `acompanhamento_especial_eventos`
 *  - notifica responsáveis (sino)
 *  - opcional: cria tarefa automática
 *
 * Pensado para rodar via pg_cron a cada hora. Cada processo só é checado se
 * já passou pelo menos `24/freq_diaria` horas desde a última checagem.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const juditApiKey = Deno.env.get("JUDIT_API_KEY");

  if (!juditApiKey) {
    return new Response(JSON.stringify({ error: "JUDIT_API_KEY não configurada" }), {
      status: 500,
      headers,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Permite forçar apenas um processo (uso manual via UI / debug)
  let forcedProcessoId: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    forcedProcessoId = body?.processo_id ?? null;
  } catch (_) {
    /* ignore */
  }

  // ── Selecionar processos ──
  let query = supabase
    .from("processos")
    .select(
      "id, numero, acompanhamento_freq_diaria, acompanhamento_com_anexos, acompanhamento_ultima_checagem_em, acompanhamento_ultimo_step_date"
    )
    .eq("acompanhamento_especial", true);
  if (forcedProcessoId) query = query.eq("id", forcedProcessoId);

  const { data: processos, error: procErr } = await query;
  if (procErr) {
    return new Response(JSON.stringify({ error: procErr.message }), {
      status: 500,
      headers,
    });
  }

  const agora = Date.now();
  const resultados: any[] = [];

  for (const p of processos ?? []) {
    try {
      const freq = Math.max(1, Math.min(6, p.acompanhamento_freq_diaria ?? 1));
      const intervaloMs = (24 / freq) * 3600 * 1000;
      if (
        !forcedProcessoId &&
        p.acompanhamento_ultima_checagem_em &&
        agora - new Date(p.acompanhamento_ultima_checagem_em).getTime() < intervaloMs
      ) {
        resultados.push({ processo_id: p.id, skipped: "intervalo" });
        continue;
      }

      const cnj = (p.numero || "").trim();
      if (!cnj) {
        resultados.push({ processo_id: p.id, skipped: "sem-cnj" });
        continue;
      }

      // ── Chamar Judit ──
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 30_000);
      let payload: any = null;
      let erro: string | null = null;
      let statusHttp = 0;
      try {
        const r = await fetch(
          `https://lawsuits.production.judit.io/lawsuits/${encodeURIComponent(cnj)}${
            p.acompanhamento_com_anexos ? "?with_attachments=true" : ""
          }`,
          { headers: { "api-key": juditApiKey, "Content-Type": "application/json" }, signal: ctl.signal }
        );
        statusHttp = r.status;
        if (r.ok) payload = await r.json();
        else erro = await r.text();
      } catch (e: any) {
        erro = e?.name === "AbortError" ? "timeout" : e?.message ?? "erro";
      } finally {
        clearTimeout(to);
      }

      await supabase.from("consultas_judit").insert({
        processo_id: p.id,
        requisitada_em: new Date().toISOString(),
        status_http: statusHttp,
        payload_resposta: payload,
        erro,
      });

      if (erro || !payload) {
        await supabase
          .from("processos")
          .update({ acompanhamento_ultima_checagem_em: new Date().toISOString() })
          .eq("id", p.id);
        resultados.push({ processo_id: p.id, erro });
        continue;
      }

      const rd = payload.response_data || payload;
      const steps: any[] = rd.steps || payload.steps || [];
      const tribunal = rd.tribunal_acronym || rd.tribunal || rd.court || null;
      const instancia = rd.instance || rd.instancia || null;

      const ultimoConhecido = p.acompanhamento_ultimo_step_date
        ? new Date(p.acompanhamento_ultimo_step_date).getTime()
        : 0;
      let maiorStepDate = ultimoConhecido;
      let novos = 0;

      for (const step of steps) {
        const dataStr = step.step_date || step.date || step.movement_date;
        if (!dataStr) continue;
        const dt = new Date(dataStr).getTime();
        if (!Number.isFinite(dt)) continue;
        if (dt > maiorStepDate) maiorStepDate = dt;
        if (ultimoConhecido && dt <= ultimoConhecido) continue;
        // primeira execução: pula tudo (apenas marca baseline)
        if (!ultimoConhecido) continue;

        const stepId =
          step.step_id || step.id || `${dataStr}-${(step.content || step.title || "").slice(0, 40)}`;
        const conteudo =
          step.content || step.title || step.description || JSON.stringify(step).slice(0, 500);
        const anexosCount = Array.isArray(step.attachments)
          ? step.attachments.length
          : Array.isArray(step.documents)
          ? step.documents.length
          : 0;

        const { data: evento, error: evErr } = await supabase
          .from("acompanhamento_especial_eventos")
          .insert({
            processo_id: p.id,
            step_id: String(stepId),
            step_date: new Date(dataStr).toISOString(),
            conteudo: typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo),
            instancia,
            tribunal,
            anexos_count: anexosCount,
          })
          .select("id")
          .maybeSingle();

        if (evErr) {
          // possivelmente unique violation — ignora
          continue;
        }

        novos++;

        // Notificar responsáveis do processo
        const { data: resps } = await supabase
          .from("processos_responsaveis")
          .select("usuario_id")
          .eq("processo_id", p.id)
          .eq("ativo", true);

        for (const r of resps ?? []) {
          if (!r.usuario_id) continue;
          await supabase.from("notificacoes").insert({
            usuario_id: r.usuario_id,
            titulo: `Novidade em ${cnj}`,
            mensagem: (typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo)).slice(0, 280),
            tipo: "acompanhamento_especial",
            lida: false,
            link: `/processos/${p.id}`,
            dados: { processo_id: p.id, evento_id: evento?.id ?? null, step_date: dataStr },
          });
        }

        await supabase
          .from("acompanhamento_especial_eventos")
          .update({ notificou_em: new Date().toISOString() })
          .eq("id", evento!.id);
      }

      await supabase
        .from("processos")
        .update({
          acompanhamento_ultima_checagem_em: new Date().toISOString(),
          acompanhamento_ultimo_step_date:
            maiorStepDate > 0 ? new Date(maiorStepDate).toISOString() : null,
        })
        .eq("id", p.id);

      resultados.push({ processo_id: p.id, novos, total_steps: steps.length });
    } catch (e: any) {
      resultados.push({ processo_id: p.id, erro: e?.message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processados: resultados.length, resultados }),
    { headers }
  );
});