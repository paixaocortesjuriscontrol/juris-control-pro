/**
 * executar-kurier-agendado
 *
 * Motor Kurier no servidor. Espelha o loop do antigo engine cliente
 * (`useDjenTermosKurierEngine.ts`), rodando via edge function:
 *   1) Lê `configuracoes_monitoramento` (tipo='kurier') para validar
 *      janela BRT / dias / última execução — pulado quando `force=true`.
 *   2) Cria linha em `execucoes_agendadas` (tipo='djen_kurier') e
 *      atualiza `detalhes.progresso` a cada credencial processada.
 *   3) Enumera credenciais Kurier ativas (opcionalmente filtradas por
 *      coordenação) e chama `kurier-consultar-publicacoes` em pool de
 *      concorrência 3 — a edge existente já persiste em `publicacoes_djen`
 *      (tabela oficial do Browser) com origem='kurier'.
 *
 * Este motor NUNCA grava em `publicacoes_djen_servidor`.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WINDOW_MIN = 30;
const MAX_CONCURRENCY = 3;
const MAX_CALLS_PER_CREDENCIAL = 200;
const DEFAULT_LOTE_SIZE = 25;
const MIN_LOTE_SIZE = 10;

function brtNow(): { ymd: string; hour: number; minute: number } {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const t = new Date()
    .toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour12: false })
    .split(", ")[1];
  const [h, m] = t.split(":").map(Number);
  return { ymd, hour: h === 24 ? 0 : h, minute: m };
}

function brtWeekday(ymd: string): number {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
}

function resolveHorarioDoDia(horarios: (string | null)[] | null, weekday: number): string | null {
  if (!horarios || horarios.length === 0) return null;
  if (horarios.length === 1) return horarios[0] || null;
  const v = horarios[weekday];
  return v && v.trim() !== "" ? v : null;
}

interface KurierTrack {
  credencialId: string;
  login: string;
  status: "pendente" | "executando" | "concluido" | "erro" | "cancelado";
  novas: number;
  duplicadas: number;
  descartadas: number;
  confirmadas: number;
  recebidas: number;
  lotes: number;
  mensagem: string;
  erro: string | null;
}

async function isExecCancelada(supabase: ReturnType<typeof createClient>, execId: string) {
  const { data } = await supabase
    .from("execucoes_agendadas")
    .select("status, detalhes")
    .eq("id", execId)
    .maybeSingle();
  if (!data) return false;
  if (data.status === "cancelado" || data.status === "falhou") return true;
  const d = (data.detalhes as Record<string, unknown>) || {};
  return d.cancel_request === true;
}

async function flushProgresso(
  supabase: ReturnType<typeof createClient>,
  execId: string,
  tracks: KurierTrack[],
  extra: Record<string, unknown> = {},
) {
  const novas = tracks.reduce((s, t) => s + t.novas, 0);
  const duplicadas = tracks.reduce((s, t) => s + t.duplicadas, 0);
  const descartadas = tracks.reduce((s, t) => s + t.descartadas, 0);
  const confirmadas = tracks.reduce((s, t) => s + t.confirmadas, 0);
  const recebidas = tracks.reduce((s, t) => s + t.recebidas, 0);
  const concluidas = tracks.filter((t) =>
    ["concluido", "erro", "cancelado"].includes(t.status)
  ).length;

  await supabase
    .from("execucoes_agendadas")
    .update({
      registros_encontrados: novas,
      registros_processados: recebidas,
      detalhes: {
        ...extra,
        totalCredenciais: tracks.length,
        credenciaisConcluidas: concluidas,
        novas,
        duplicadas,
        descartadas,
        confirmadas,
        recebidas,
        tracks: tracks.slice(-100),
        atualizado_em: new Date().toISOString(),
      },
    })
    .eq("id", execId)
    .neq("status", "cancelado");
}

async function processarCredencial(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  execId: string,
  track: KurierTrack,
  opts: {
    monitoramentoIds?: string[];
    coordenacaoId?: string;
    dataInicio?: string;
    dataFim?: string;
    modoPersonalizado: boolean;
    drenarBacklog: boolean;
  },
  cancelState: { cancelled: boolean },
  onTick: () => Promise<void>,
) {
  track.status = "executando";
  track.mensagem = "Consultando lotes...";
  await onTick();
  try {
    let loteSize = DEFAULT_LOTE_SIZE;
    for (let chamada = 1; chamada <= MAX_CALLS_PER_CREDENCIAL; chamada++) {
      if (cancelState.cancelled) break;
      if (await isExecCancelada(supabase, execId)) {
        cancelState.cancelled = true;
        break;
      }
      const resp = await fetch(`${supabaseUrl}/functions/v1/kurier-consultar-publicacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          credencial_id: track.credencialId,
          max_lotes: 1,
          lote_size: loteSize,
          monitoramento_ids: opts.monitoramentoIds?.length ? opts.monitoramentoIds : undefined,
          coordenacao_id: opts.coordenacaoId || undefined,
          data_inicio: opts.dataInicio || undefined,
          data_fim: opts.dataFim || undefined,
          modo_personalizado: opts.modoPersonalizado && !opts.drenarBacklog,
          execucao_id: execId,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        if ([546, 503, 504].includes(resp.status) && loteSize > MIN_LOTE_SIZE) {
          loteSize = MIN_LOTE_SIZE;
          track.mensagem = `Limite do servidor; retomando em lotes de ${loteSize}...`;
          await onTick();
          continue;
        }
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      const r = await resp.json() as Record<string, unknown>;
      if (r?.error) throw new Error(String(r.error));

      const recebidas = Number(r?.total_recebidas ?? 0);
      track.novas += Number(r?.total_novas ?? 0);
      track.duplicadas += Number(r?.total_duplicadas ?? 0);
      track.descartadas += Number(r?.total_descartadas ?? 0);
      track.confirmadas += Number(r?.total_confirmadas ?? 0);
      track.recebidas += recebidas;
      track.lotes += Number(r?.lotes_processados ?? 0);
      track.mensagem = opts.modoPersonalizado
        ? `${track.recebidas} recebidas, ${track.novas} novas, ${track.duplicadas} dup em ${track.lotes} lote(s)`
        : `${track.novas} novas, ${track.duplicadas} dup, ${track.confirmadas} confirm em ${track.lotes} lote(s)`;
      await onTick();

      if (r?.ok === false) throw new Error(String(r?.erro ?? "erro Kurier"));
      if (opts.modoPersonalizado && !opts.drenarBacklog) break;
      if (recebidas === 0 || Number(r?.lotes_processados ?? 0) === 0) break;
      if (r?.janela_ultrapassada === true) break;
    }
    track.status = cancelState.cancelled ? "cancelado" : "concluido";
  } catch (e) {
    track.status = "erro";
    track.erro = String((e as Error)?.message ?? e).slice(0, 200);
    track.mensagem = `Erro: ${track.erro?.slice(0, 80)}`;
  }
  await onTick();
}

async function runJob(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  execId: string,
  opts: {
    coordenacaoId?: string;
    monitoramentoIds?: string[];
    dataInicio?: string;
    dataFim?: string;
    modoPersonalizado: boolean;
    drenarBacklog: boolean;
  },
) {
  const startedAt = Date.now();
  const cancelState = { cancelled: false };

  try {
    let credQuery = supabase
      .from("kurier_credenciais")
      .select("id, login")
      .eq("ativo", true)
      .not("senha_encrypted", "is", null)
      .order("prioridade", { ascending: false });

    if (opts.coordenacaoId) {
      const { data: vinc } = await supabase
        .from("kurier_credencial_coordenacoes")
        .select("credencial_id")
        .eq("coordenacao_id", opts.coordenacaoId);
      const ids = (vinc || []).map((v: { credencial_id: string }) => v.credencial_id);
      if (ids.length === 0) {
        await supabase.from("execucoes_agendadas").update({
          status: "concluido",
          finalizado_em: new Date().toISOString(),
          detalhes: { motivo: "sem_credenciais_para_coordenacao" },
        }).eq("id", execId);
        return;
      }
      credQuery = credQuery.in("id", ids);
    }

    const { data: creds, error: credErr } = await credQuery;
    if (credErr) throw credErr;

    const tracks: KurierTrack[] = (creds || []).map((c: { id: string; login: string }) => ({
      credencialId: c.id,
      login: c.login,
      status: "pendente",
      novas: 0,
      duplicadas: 0,
      descartadas: 0,
      confirmadas: 0,
      recebidas: 0,
      lotes: 0,
      mensagem: "Aguardando...",
      erro: null,
    }));

    if (tracks.length === 0) {
      await supabase.from("execucoes_agendadas").update({
        status: "concluido",
        finalizado_em: new Date().toISOString(),
        detalhes: { motivo: "nenhuma_credencial_ativa" },
      }).eq("id", execId);
      return;
    }

    let lastFlush = 0;
    const flushIfDue = async () => {
      const now = Date.now();
      if (now - lastFlush < 800) return;
      lastFlush = now;
      await flushProgresso(supabase, execId, tracks);
    };
    await flushProgresso(supabase, execId, tracks);

    let idx = 0;
    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, tracks.length) }, async () => {
      while (!cancelState.cancelled) {
        const i = idx++;
        if (i >= tracks.length) return;
        await processarCredencial(
          supabase, supabaseUrl, serviceKey, execId, tracks[i], opts, cancelState, flushIfDue,
        );
      }
    });
    await Promise.all(workers);

    if (cancelState.cancelled) {
      for (const t of tracks) if (t.status === "pendente") { t.status = "cancelado"; t.mensagem = "Cancelado"; }
    }

    const houveErro = tracks.some((t) => t.status === "erro");
    const statusFinal = cancelState.cancelled ? "cancelado" : (houveErro ? "erro" : "concluido");
    await flushProgresso(supabase, execId, tracks, { duracao_ms: Date.now() - startedAt });
    await supabase.from("execucoes_agendadas").update({
      status: statusFinal,
      finalizado_em: new Date().toISOString(),
    }).eq("id", execId);
  } catch (e) {
    console.error("[executar-kurier-agendado] erro fatal:", e);
    await supabase.from("execucoes_agendadas").update({
      status: "falhou",
      finalizado_em: new Date().toISOString(),
      ultimo_erro: String((e as Error)?.message ?? e),
    }).eq("id", execId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true || body?.manual === true;
    const coordenacaoId: string | undefined = typeof body?.coordenacao_id === "string" ? body.coordenacao_id : undefined;
    const monitoramentoIds: string[] | undefined = Array.isArray(body?.monitoramento_ids) ? body.monitoramento_ids : undefined;
    const dataInicio: string | undefined = typeof body?.data_inicio === "string" ? body.data_inicio : undefined;
    const dataFim: string | undefined = typeof body?.data_fim === "string" ? body.data_fim : undefined;
    const modoPersonalizado = body?.modo_personalizado === true;
    const drenarBacklog = body?.drenar_backlog === true;

    // 1) Ler configuração
    const { data: cfg } = await supabase
      .from("configuracoes_monitoramento")
      .select("id, ativo, horarios_execucao, metadata")
      .eq("tipo", "kurier")
      .maybeSingle();

    if (!force && (!cfg || !cfg.ativo)) {
      return new Response(JSON.stringify({ skipped: "inativo" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = brtNow();

    // 2) Janela de horário / dia
    if (!force && cfg) {
      const meta = (cfg.metadata as Record<string, unknown>) || {};
      const dias = Array.isArray(meta.dias_semana) ? (meta.dias_semana as number[]) : [1, 2, 3, 4, 5];
      const wd = brtWeekday(now.ymd);
      if (!dias.includes(wd)) {
        return new Response(JSON.stringify({ skipped: "dia_desativado", weekday: wd }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const horarios = cfg.horarios_execucao as (string | null)[] | null;
      const horario = resolveHorarioDoDia(horarios, wd) || (horarios && horarios[0]) || null;
      if (!horario) {
        return new Response(JSON.stringify({ skipped: "sem_horario" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Casa qualquer um dos horários salvos
      const slots = Array.isArray(horarios) ? horarios.filter((h): h is string => !!h && /^\d{2}:\d{2}$/.test(h)) : [horario];
      const nowMin = now.hour * 60 + now.minute;
      const dentroJanela = slots.some((s) => {
        const [hh, mm] = s.split(":").map(Number);
        const tgt = hh * 60 + mm;
        return nowMin >= tgt && nowMin <= tgt + WINDOW_MIN;
      });
      if (!dentroJanela) {
        return new Response(JSON.stringify({ skipped: "fora_janela", now: `${now.hour}:${now.minute}`, slots }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3) Trava do dia (para disparos automáticos apenas)
    if (!force) {
      const ymdStart = `${now.ymd}T00:00:00-03:00`;
      const ymdEnd = `${now.ymd}T23:59:59-03:00`;
      const { data: existentes } = await supabase
        .from("execucoes_agendadas")
        .select("id, status")
        .eq("tipo", "djen_kurier")
        .gte("iniciado_em", ymdStart)
        .lte("iniciado_em", ymdEnd);
      const jaTem = (existentes || []).some((r: { status: string }) => r.status !== "falhou");
      if (jaTem) {
        return new Response(JSON.stringify({ skipped: "ja_executou_hoje" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4) Cria execução
    const { data: exec, error: execErr } = await supabase
      .from("execucoes_agendadas")
      .insert({
        tipo: "djen_kurier",
        status: "executando",
        job_name: "DJEN Termos Kurier (Servidor)",
        iniciado_em: new Date().toISOString(),
        detalhes: {
          coordenacao_id: coordenacaoId ?? null,
          modo_personalizado: modoPersonalizado,
          drenar_backlog: drenarBacklog,
          data_inicio: dataInicio ?? null,
          data_fim: dataFim ?? null,
        },
      })
      .select("id")
      .single();
    if (execErr || !exec) throw new Error(`falha ao criar execucao_agendada: ${execErr?.message}`);

    // 5) ultima_execucao para o scheduler ignorar próxima janela
    if (cfg?.id) {
      await supabase
        .from("configuracoes_monitoramento")
        .update({ ultima_execucao: new Date().toISOString() })
        .eq("id", cfg.id);
    }

    // 6) Task em background
    const task = runJob(supabase, supabaseUrl, serviceKey, exec.id as string, {
      coordenacaoId, monitoramentoIds, dataInicio, dataFim,
      modoPersonalizado, drenarBacklog,
    });
    // @ts-ignore EdgeRuntime existe no Supabase Deno Deploy
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(task);
    } else {
      task.catch((e) => console.error("[executar-kurier-agendado] task error:", e));
    }

    return new Response(JSON.stringify({ started: true, exec_id: exec.id }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[executar-kurier-agendado] handler erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});