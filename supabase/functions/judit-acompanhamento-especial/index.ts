import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Job de Acompanhamento Especial — roda em horários fixos BRT (10h/14h/18h),
 * disparados por 3 cron jobs distintos que enviam `slot` no body:
 *  - slot 10 → processa freq >= 1
 *  - slot 14 → processa freq >= 3
 *  - slot 18 → processa freq >= 2
 * (freq máximo permitido = 3)
 *
 * Para cada novo step encontrado grava em `acompanhamento_especial_eventos`,
 * cria notificação no sino e envia email + WhatsApp aos responsáveis ativos.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const juditApiKey = Deno.env.get("JUDIT_API_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!juditApiKey) {
    return new Response(JSON.stringify({ error: "JUDIT_API_KEY não configurada" }), {
      status: 500,
      headers,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // slot BRT (10 | 14 | 18) + processo_id forçado (uso manual via UI / debug)
  let forcedProcessoId: string | null = null;
  let slot: number | null = null;
  let invocadoPor: string | null = null;
  let disparo = "automatico";
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    forcedProcessoId = body?.processo_id ?? null;
    slot = typeof body?.slot === "number" ? body.slot : null;
    invocadoPor = body?.invocado_por ?? null;
    if (body?.manual || body?.disparo === "manual" || invocadoPor) disparo = "manual";
  } catch (_) {
    /* ignore */
  }

  // ── Registra início da execução ──
  const iniciadoEm = new Date();
  const { data: execRow } = await supabase
    .from("execucoes_acompanhamento_especial")
    .insert({
      slot,
      disparo,
      status: "executando",
      iniciado_em: iniciadoEm.toISOString(),
      invocado_por: invocadoPor,
    })
    .select("id")
    .maybeSingle();
  const execId: string | null = execRow?.id ?? null;

  // Determina qual freq mínima roda neste slot
  const minFreqBySlot: Record<number, number> = { 10: 1, 14: 3, 18: 2 };
  const minFreqRequired = slot && minFreqBySlot[slot] ? minFreqBySlot[slot] : 1;

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
    if (execId) {
      await supabase
        .from("execucoes_acompanhamento_especial")
        .update({
          status: "erro",
          finalizado_em: new Date().toISOString(),
          duracao_ms: Date.now() - iniciadoEm.getTime(),
          erro: procErr.message,
        })
        .eq("id", execId);
    }
    return new Response(JSON.stringify({ error: procErr.message }), {
      status: 500,
      headers,
    });
  }

  const resultados: any[] = [];
  // Data BRT (YYYY-MM-DD) para guard anti-duplicidade no mesmo slot/dia
  const nowBrt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dataBrtStr = nowBrt.toISOString().slice(0, 10);

  for (const p of processos ?? []) {
    try {
      const freq = Math.max(1, Math.min(3, p.acompanhamento_freq_diaria ?? 1));

      // Filtra por slot: só roda se a freq do processo alcança este slot
      // (execuções manuais via UI ignoram esse guard)
      if (disparo !== "manual" && !forcedProcessoId && slot && freq < minFreqRequired) {
        resultados.push({ processo_id: p.id, skipped: "slot-fora-da-freq" });
        continue;
      }

      // Evita rodar duas vezes no mesmo slot no mesmo dia BRT
      // (execuções manuais via UI ignoram esse guard — a intenção é justamente forçar)
      if (disparo !== "manual" && !forcedProcessoId && p.acompanhamento_ultima_checagem_em) {
        const ult = new Date(
          new Date(p.acompanhamento_ultima_checagem_em).getTime() - 3 * 60 * 60 * 1000
        );
        const ultDia = ult.toISOString().slice(0, 10);
        const ultHora = ult.getUTCHours(); // já ajustado para BRT
        if (slot && ultDia === dataBrtStr && ultHora === slot) {
          resultados.push({ processo_id: p.id, skipped: "ja-rodou-neste-slot" });
          continue;
        }
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
      const inicioReq = Date.now();
      const comAnexosProc = !!p.acompanhamento_com_anexos;
      try {
        const r = await fetch(
          `https://lawsuits.production.judit.io/lawsuits/${encodeURIComponent(cnj)}${
            comAnexosProc ? "?with_attachments=true" : ""
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

      // Log unificado em judit_logs para aparecer na tela Consumo Judit.
      // Resolve o dono do processo em profiles quando existir (via dono do
      // registro em dados_benner). Fallback: user_email = "cron".
      try {
        let userEmail: string | null = "cron";
        try {
          const { data: dbRow } = await supabase
            .from("dados_benner")
            .select("user_id")
            .eq("processo", cnj)
            .limit(1)
            .maybeSingle();
          const donoId = (dbRow as any)?.user_id ?? null;
          if (donoId) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", donoId)
              .maybeSingle();
            if ((prof as any)?.email) userEmail = (prof as any).email;
          }
        } catch (_) { /* resolve best-effort */ }

        const logStatus =
          erro ? "erro_api" : (payload ? "sucesso" : "erro_api");
        await supabase.from("judit_logs").insert({
          processo_numero: cnj,
          tribunal: null,
          request_payload: {
            numero_processo: cnj,
            with_attachments: comAnexosProc,
            slot,
            origem: "acompanhamento-especial",
          },
          raw_response: payload ?? null,
          status: logStatus,
          error_message: erro,
          created_by: null,
          origem: "acompanhamento-especial",
          tipo_cobranca: comAnexosProc ? "com_anexos" : "sem_anexos",
          user_email: userEmail,
          duracao_ms: Date.now() - inicioReq,
        } as any);
      } catch (logErr) {
        console.warn("[acomp-especial] falha ao gravar judit_logs:", (logErr as Error).message);
      }

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
      const novosResumo: { data: string; conteudo: string }[] = [];

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
        const conteudoStr = typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo);
        novosResumo.push({ data: dataStr, conteudo: conteudoStr.slice(0, 500) });

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
            mensagem: conteudoStr.slice(0, 280),
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

      // Envio consolidado (1 email + 1 WhatsApp por processo, listando todos os novos)
      if (novos > 0 && novosResumo.length > 0) {
        try {
          const { data: resps2 } = await supabase
            .from("processos_responsaveis")
            .select("usuario_id")
            .eq("processo_id", p.id)
            .eq("ativo", true);
          const userIds = (resps2 ?? []).map((r: any) => r.usuario_id).filter(Boolean);
          if (userIds.length > 0) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("id, nome, email, telefone")
              .in("id", userIds);

            const linhasTxt = novosResumo
              .map((n) => `• ${new Date(n.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} — ${n.conteudo}`)
              .join("\n");
            const linhasHtml = novosResumo
              .map(
                (n) =>
                  `<li><strong>${new Date(n.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong> — ${n.conteudo.replace(/</g, "&lt;")}</li>`
              )
              .join("");

            // Email via Resend
            if (resendApiKey) {
              const emails = (profs ?? []).map((p: any) => p.email).filter(Boolean);
              if (emails.length > 0) {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "JurisControl <alertas@juriscontrol.adv.br>",
                    to: emails,
                    subject: `[Acompanhamento Especial] ${novos} nova(s) movimentação(ões) em ${cnj}`,
                    html: `<p>Foram encontradas <strong>${novos}</strong> nova(s) movimentação(ões) no processo <strong>${cnj}</strong>:</p><ul>${linhasHtml}</ul><p><a href="https://juriscontrol.adv.br/processos/${p.id}">Abrir processo</a></p>`,
                  }),
                }).catch((e) => console.error("[acomp-especial] erro email:", e));
              }
            }

            // WhatsApp via Z-API
            const telefones = (profs ?? []).map((p: any) => p.telefone).filter(Boolean);
            if (telefones.length > 0) {
              await supabase.functions
                .invoke("enviar-whatsapp-zapi", {
                  body: {
                    telefones,
                    mensagem: `📌 *Acompanhamento Especial*\nProcesso: *${cnj}*\n${novos} nova(s) movimentação(ões):\n\n${linhasTxt}`,
                    tipo: "evento",
                  },
                })
                .catch((e) => console.error("[acomp-especial] erro whatsapp:", e));
            }
          }
        } catch (notifyErr) {
          console.error("[acomp-especial] erro notificação email/whatsapp:", notifyErr);
        }
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

  // ── Finaliza log de execução ──
  if (execId) {
    const totalNovos = resultados.reduce(
      (acc: number, r: any) => acc + (typeof r?.novos === "number" ? r.novos : 0),
      0
    );
    const totalErros = resultados.filter((r: any) => r?.erro).length;
    const finalizadoEm = new Date();
    await supabase
      .from("execucoes_acompanhamento_especial")
      .update({
        status: "concluido",
        finalizado_em: finalizadoEm.toISOString(),
        duracao_ms: finalizadoEm.getTime() - iniciadoEm.getTime(),
        total_processos: resultados.length,
        total_novos_eventos: totalNovos,
        total_erros: totalErros,
        detalhes: { resultados },
      })
      .eq("id", execId);
  }

  return new Response(
    JSON.stringify({ ok: true, slot, processados: resultados.length, resultados }),
    { headers }
  );
});