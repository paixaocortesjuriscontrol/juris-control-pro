import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  extrairCamposDoJuditRaw,
  extrairPartesDoJuditRaw,
  extrairStepsDoJuditRaw,
} from "../_shared/juditRawCampos.ts";
import { coordenacaoDoUsuario } from "../_shared/coordenacao-usuario.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "JurisControl <alertas@juriscontrol.adv.br>";

/** Envia e-mail via Resend. Nunca lança — retorna status para o histórico. */
async function enviarEmailResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    if (!resp.ok) return { ok: false, erro: `resend ${resp.status}: ${await resp.text()}` };
    await resp.json().catch(() => null);
    return { ok: true as const, erro: null };
  } catch (e) {
    return { ok: false, erro: String((e as Error)?.message ?? e) };
  }
}

// Campos do formulário "Visão Geral" que a Judit consegue preencher.
// Regra: NUNCA sobrescrever valor já preenchido pelo advogado — só grava
// quando o campo está vazio. Divergências são registradas para aviso no painel.
const CAMPOS_SINCRONIZAVEIS = [
  "tribunal", "orgao_julgador", "classe", "natureza", "assunto", "materia",
  "comarca", "vara", "uf", "instancia", "justica", "esfera", "area", "sistema",
  "data_distribuicao", "data_citacao", "data_recebimento", "valor_causa",
  "polo_ativo", "polo_passivo", "reclamante", "reclamados",
  "terceiro_envolvido", "pedidos", "fase", "segredo_justica",
] as const;

const vazio = (v: any) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

const comparavel = (v: any) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).trim().toLowerCase().replace(/\s+/g, " ");
};

/**
 * Aplica no processo o MESMO efeito do botão Judit da tela Processos e Casos:
 *  - `processos`: só preenche campos vazios (jamais sobrescreve o advogado)
 *  - `processos_partes` (aba Partes): sempre regravada a partir da Judit
 *  - `movimentacoes` (aba Andamentos): insere novos, com dedup data+descrição
 *  - `consultas_judit` (aba Análise Judit): já gravada pelo fluxo principal
 * Divergências (campo preenchido pelo advogado ≠ valor da Judit) são
 * registradas em `acompanhamento_especial_divergencias`.
 */
async function sincronizarProcessoComJudit(
  supabase: any,
  processoId: string,
  cnj: string,
  payloadJudit: any,
  execucaoId: string | null,
) {
  const resumo = { campos_preenchidos: 0, partes: 0, andamentos: 0, divergencias: 0 };
  const wrapper = { _judit_raw: { cache_lookup: payloadJudit?.response_data || payloadJudit, crawler: null } };

  // ── 1. Campos do formulário ───────────────────────────────────────────────
  const campos = extrairCamposDoJuditRaw(wrapper);
  const { data: atual } = await supabase
    .from("processos")
    .select(`id, judit_campos, ${CAMPOS_SINCRONIZAVEIS.join(", ")}`)
    .eq("id", processoId)
    .maybeSingle();

  if (atual) {
    const update: Record<string, any> = {};
    const jaJudit = new Set<string>(
      Array.isArray(atual.judit_campos) ? atual.judit_campos.map(String) : [],
    );
    const divergencias: any[] = [];

    for (const campo of CAMPOS_SINCRONIZAVEIS) {
      const valorJudit = (campos as any)[campo];
      if (vazio(valorJudit)) continue;
      const valorAtual = (atual as any)[campo];
      if (vazio(valorAtual)) {
        update[campo] = valorJudit;
        jaJudit.add(campo);
        continue;
      }
      // Campo já preenchido — se o valor era da própria Judit, atualiza;
      // se foi digitado pelo advogado, preserva e registra a divergência.
      if (comparavel(valorAtual) === comparavel(valorJudit)) continue;
      if (jaJudit.has(campo)) {
        update[campo] = valorJudit;
        continue;
      }
      divergencias.push({
        processo_id: processoId,
        processo_numero: cnj,
        campo,
        valor_atual: String(valorAtual).slice(0, 500),
        valor_judit: String(valorJudit).slice(0, 500),
        execucao_id: execucaoId,
      });
    }

    if (Object.keys(update).length > 0) {
      update.judit_campos = Array.from(jaJudit);
      const { error: upErr } = await supabase.from("processos").update(update).eq("id", processoId);
      if (!upErr) resumo.campos_preenchidos = Object.keys(update).length - 1;
      else console.warn("[acomp-especial] update processos:", upErr.message);
    }

    if (divergencias.length > 0) {
      // Substitui as divergências pendentes do mesmo campo (mantém 1 por campo)
      for (const d of divergencias) {
        await supabase
          .from("acompanhamento_especial_divergencias")
          .delete()
          .eq("processo_id", processoId)
          .eq("campo", d.campo)
          .is("resolvido_em", null);
      }
      const { error: divErr } = await supabase
        .from("acompanhamento_especial_divergencias")
        .insert(divergencias);
      if (!divErr) resumo.divergencias = divergencias.length;
      else console.warn("[acomp-especial] divergencias:", divErr.message);
    }
  }

  // ── 2. Partes + advogados (aba Partes) — sempre atualizada ────────────────
  try {
    const partes = extrairPartesDoJuditRaw(wrapper);
    if (partes.length > 0) {
      await supabase
        .from("processos_partes")
        .delete()
        .eq("processo_id", processoId)
        .eq("fonte", "judit");
      const rows = partes.map((p: any) => ({
        processo_id: processoId,
        nome: p.nome,
        documento: p.documento,
        tipo_pessoa: p.tipo_pessoa,
        polo: p.polo,
        lado_efetivo: p.lado_efetivo,
        is_advogado: p.is_advogado,
        fonte: "judit",
        raw: { ...(p.raw || {}), advogado_de: p.advogado_de, oab: p.oab },
      }));
      for (let i = 0; i < rows.length; i += 200) {
        await supabase.from("processos_partes").insert(rows.slice(i, i + 200));
      }
      resumo.partes = rows.length;
      const advogados = partes
        .filter((p: any) => p.is_advogado && p.nome)
        .map((p: any) => ({
          nome: p.nome,
          documento: p.documento || null,
          oab: p.oab || null,
          advogado_de: p.advogado_de || null,
          polo: p.polo || null,
          fonte: "judit",
        }));
      if (advogados.length > 0) {
        await supabase
          .from("processos")
          .update({ advogados_identificados: advogados })
          .eq("id", processoId);
      }
    }
  } catch (e) {
    console.warn("[acomp-especial] partes:", (e as Error).message);
  }

  // ── 3. Andamentos (aba Andamentos) — sempre atualizada, com dedup ─────────
  try {
    const steps = extrairStepsDoJuditRaw(wrapper);
    if (steps.length > 0) {
      const { data: existentes } = await supabase
        .from("movimentacoes")
        .select("data_movimentacao, descricao")
        .eq("processo_id", processoId)
        .limit(5000);
      const jaTem = new Set(
        ((existentes as any[]) || []).map(
          (m) => `${String(m.data_movimentacao || "").substring(0, 10)}|${String(m.descricao || "").trim()}`,
        ),
      );
      const rows = steps
        .filter((s: any) => !jaTem.has(`${s.data}|${s.descricao}`))
        .map((s: any) => ({
          processo_id: processoId,
          data_movimentacao: `${s.data}T12:00:00.000Z`,
          descricao: s.descricao,
          tipo: null,
          fonte: "judit",
          codigo: s.codigo != null ? String(s.codigo) : null,
          raw: s.raw ?? null,
        }));
      for (let i = 0; i < rows.length; i += 200) {
        await supabase.from("movimentacoes").insert(rows.slice(i, i + 200));
      }
      resumo.andamentos = rows.length;
    }
  } catch (e) {
    console.warn("[acomp-especial] andamentos:", (e as Error).message);
  }

  return resumo;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Fallback de crawler Judit ───────────────────────────────────────────────
// O endpoint de cache (`GET /lawsuits/{cnj}`) devolve vazio (ou LAWSUIT_NOT_FOUND)
// quando a Judit ainda não tem o processo indexado. Nesses casos criamos uma
// requisição de crawler e aguardamos o resultado, senão o acompanhamento nunca
// enxerga movimentação nova e o usuário nunca é avisado.
const JUDIT_REQUESTS_URL = "https://requests.prod.judit.io/requests";
const JUDIT_RESPONSES_URL = "https://requests.prod.judit.io/responses";
const CRAWLER_POLL_TIMEOUT_MS = 45_000;
const CRAWLER_POLL_INTERVAL_MS = 3_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function temDadosUteis(rd: any) {
  if (!rd || typeof rd !== "object") return false;
  // Movimentações são o objetivo do acompanhamento: se o cache voltou sem
  // steps, tratamos como "sem dados úteis" para forçar o crawler.
  return !!rd.steps?.length;
}

async function juditCrawler(
  apiKey: string,
  cnj: string,
  withAttachments: boolean,
): Promise<any | null> {
  try {
    const r = await fetch(JUDIT_REQUESTS_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        search: { search_type: "lawsuit_cnj", search_key: cnj, cache_ttl_in_days: 0 },
        with_attachments: withAttachments,
      }),
    });
    if (!r.ok) {
      console.warn(`[acomp-especial] POST /requests ${r.status}: ${await r.text()}`);
      return null;
    }
    const requestId = (await r.json())?.request_id;
    if (!requestId) return null;

    const deadline = Date.now() + CRAWLER_POLL_TIMEOUT_MS;
    let melhor: any = null;
    while (Date.now() < deadline) {
      await sleep(CRAWLER_POLL_INTERVAL_MS);
      const url = new URL(JUDIT_RESPONSES_URL);
      url.searchParams.set("request_id", String(requestId));
      url.searchParams.set("page_size", "50");
      const rr = await fetch(url.toString(), { headers: { "api-key": apiKey } });
      if (!rr.ok) { await rr.text(); continue; }
      const data = await rr.json();
      const candidatos: any[] = (data?.page_data || data?.data || [])
        .map((it: any) => it?.response_data)
        .filter(temDadosUteis);
      candidatos.sort((a, b) => (b?.steps?.length || 0) - (a?.steps?.length || 0));
      if (candidatos[0]) melhor = candidatos[0];
      if (data?.request_status === "completed" || data?.request_status === "cancelled") break;
    }
    return melhor ? { response_data: melhor, _origem: "crawler" } : null;
  } catch (e) {
    console.warn("[acomp-especial] crawler falhou:", (e as Error).message);
    return null;
  }
}

/** Notifica no sino um conjunto de usuários (dedup automático). */
async function notificarUsuarios(
  supabase: any,
  userIds: string[],
  payload: { titulo: string; mensagem: string; tipo: string; link: string; dados?: any },
) {
  const unicos = Array.from(new Set(userIds.filter(Boolean)));
  if (unicos.length === 0) return;
  await supabase.from("notificacoes").insert(
    unicos.map((usuario_id) => ({
      usuario_id,
      titulo: payload.titulo,
      mensagem: payload.mensagem,
      tipo: payload.tipo,
      lida: false,
      link: payload.link,
      dados: payload.dados ?? null,
    })),
  );
}

/**
 * Destinatários do processo: responsáveis ativos + coordenador titular e
 * coordenadores/assistentes membros da(s) coordenação(ões) responsável(is).
 */
async function destinatariosDoProcesso(supabase: any, processoId: string) {
  const ids = new Set<string>();

  const { data: resps } = await supabase
    .from("processos_responsaveis")
    .select("usuario_id")
    .eq("processo_id", processoId)
    .eq("ativo", true);
  (resps ?? []).forEach((r: any) => r.usuario_id && ids.add(r.usuario_id));

  const coordIds = new Set<string>();
  const { data: proc } = await supabase
    .from("processos")
    .select("coordenacao_id")
    .eq("id", processoId)
    .maybeSingle();
  if ((proc as any)?.coordenacao_id) coordIds.add((proc as any).coordenacao_id);
  const { data: extras } = await supabase
    .from("processos_coordenacoes_responsaveis")
    .select("coordenacao_id")
    .eq("processo_id", processoId);
  (extras ?? []).forEach((c: any) => c.coordenacao_id && coordIds.add(c.coordenacao_id));

  if (coordIds.size > 0) {
    const lista = Array.from(coordIds);
    const { data: coords } = await supabase
      .from("coordenacoes")
      .select("coordenador_id")
      .in("id", lista);
    (coords ?? []).forEach((c: any) => c.coordenador_id && ids.add(c.coordenador_id));

    const { data: membros } = await supabase
      .from("membros_coordenacao")
      .select("usuario_id")
      .in("coordenacao_id", lista);
    const membroIds = (membros ?? []).map((m: any) => m.usuario_id).filter(Boolean);
    if (membroIds.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", membroIds)
        .in("role", ["coordenador", "assistente_coordenador"]);
      (roles ?? []).forEach((r: any) => ids.add(r.user_id));
    }
  }

  return Array.from(ids);
}

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
  // E-mail desativado nesta rotina (reclamações de spam de divergências Judit).

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

      // Fallback: cache sem dados úteis (ou 404) → dispara crawler
      let origemDado = "cache";
      if (!payload || !temDadosUteis(payload.response_data || payload)) {
        const viaCrawler = await juditCrawler(juditApiKey, cnj, comAnexosProc);
        if (viaCrawler) {
          payload = viaCrawler;
          erro = null;
          statusHttp = 200;
          origemDado = "crawler";
        } else if (!erro) {
          erro = "sem dados na Judit (cache e crawler vazios)";
        }
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
            origem_dado: origemDado,
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

      // Grava tudo como se o botão Judit tivesse sido clicado (sem sobrescrever
      // o que o advogado digitou) e detecta divergências para aviso no painel.
      let sync: any = null;
      try {
        sync = await sincronizarProcessoComJudit(supabase, p.id, cnj, payload, execId);
      } catch (e) {
        console.warn("[acomp-especial] sync judit falhou:", (e as Error).message);
      }

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

        // Notificar responsáveis do processo + coordenadores da coordenação
        await notificarUsuarios(supabase, await destinatariosDoProcesso(supabase, p.id), {
          titulo: `Novidade em ${cnj}`,
          mensagem: conteudoStr.slice(0, 280),
          tipo: "acompanhamento_especial",
          link: `/processos/${p.id}`,
          dados: { processo_id: p.id, evento_id: evento?.id ?? null, step_date: dataStr },
        });

        await supabase
          .from("acompanhamento_especial_eventos")
          .update({ notificou_em: new Date().toISOString() })
          .eq("id", evento!.id);
      }

      // Envio consolidado (1 email + 1 WhatsApp por processo, listando todos os novos)
      if (novos > 0 && novosResumo.length > 0) {
        try {
          const userIds = await destinatariosDoProcesso(supabase, p.id);
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

            // Envio de e-mail DESATIVADO nesta rotina (somente sino/WhatsApp).
            void linhasHtml;

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

      resultados.push({ processo_id: p.id, numero: cnj, novos, total_steps: steps.length, sync });
    } catch (e: any) {
      resultados.push({ processo_id: p.id, erro: e?.message ?? String(e) });
    }
  }

  // ── Divergências (Judit × formulário): SEM aviso ──────────────────────────
  // Continuam registradas em `acompanhamento_especial_divergencias` para
  // consulta na tela do processo / Painel de Controle, mas não geram
  // notificação no sino nem e-mail. Aviso ocorre apenas para NOVAS
  // movimentações encontradas pela Judit.

  // ── Aviso de execução com falhas (silêncio ≠ "nada aconteceu") ────────────
  try {
    const comErro = resultados.filter((r: any) => r?.erro);
    if (comErro.length > 0) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (admins ?? []).map((a: any) => a.user_id).filter(Boolean);
      const envolvidos = new Set<string>(adminIds);
      for (const r of comErro) {
        (await destinatariosDoProcesso(supabase, r.processo_id)).forEach((id) => envolvidos.add(id));
      }
      await notificarUsuarios(supabase, Array.from(envolvidos), {
        titulo: "Acompanhamento Especial: processos sem retorno da Judit",
        mensagem: `${comErro.length} processo(s) não retornaram dados nesta execução (slot ${slot ?? "manual"}).`,
        tipo: "acompanhamento_especial",
        link: "/painel-controle",
        dados: { execucao_id: execId, processos_com_erro: comErro.length },
      });
    }
  } catch (e) {
    console.error("[acomp-especial] aviso de falhas:", (e as Error).message);
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