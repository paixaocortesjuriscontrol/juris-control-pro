/** Motor Kurier em etapas curtas, retomáveis e protegidas por lease. */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WINDOW_MIN = 30;
const DEFAULT_LOTE_SIZE = 25;
const MIN_LOTE_SIZE = 10;
const MAX_LOTE_SIZE = 50;
const LOTE_STEPS = [MIN_LOTE_SIZE, DEFAULT_LOTE_SIZE, MAX_LOTE_SIZE];
/** Rodadas consecutivas sem erro necessárias para aumentar o lote de novo. */
const HOPS_PARA_CRESCER = 2;
const DEFAULT_MAX_LOTES = 2;
const MAX_HOPS = 300;
/** A partir deste número de lotes na mesma credencial, os outros logins passam na frente. */
const ADIAR_APOS_LOTES = 6;
const MAX_LIMIT_ERRORS = 3;
const INNER_TIMEOUT_MS = 75_000;
const NEXT_HOP_DELAY_MS = 1_500;
const STALE_MINUTES = 10;

type SupabaseClient = ReturnType<typeof createClient>;
type TrackStatus = "pendente" | "executando" | "concluido" | "erro" | "cancelado";

interface KurierTrack {
  credencialId: string;
  login: string;
  status: TrackStatus;
  novas: number;
  duplicadas: number;
  descartadas: number;
  confirmadas: number;
  recebidas: number;
  lotes: number;
  mensagem: string;
  erro: string | null;
  loteSize: number;
  maxLotes: number;
  errosLimite: number;
  hopsSemErro?: number;
  adiado?: boolean;
}

interface JobOptions {
  coordenacaoId?: string;
  monitoramentoIds?: string[];
  dataInicio?: string;
  dataFim?: string;
  modoPersonalizado: boolean;
  drenarBacklog: boolean;
  /** Modo drenagem: roda uma credencial só, até a fila esvaziar. */
  credencialId?: string;
  drenagem?: boolean;
}

interface JobState {
  tracks: KurierTrack[];
  currentIndex: number;
  hop: number;
  opts: JobOptions;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function brtNow(): { ymd: string; hour: number; minute: number } {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const t = new Date().toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  }).split(", ")[1];
  const [h, m] = t.split(":").map(Number);
  return { ymd, hour: h === 24 ? 0 : h, minute: m };
}

function brtWeekday(ymd: string): number {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay();
}

function resolveHorarioDoDia(horarios: (string | null)[] | null, weekday: number) {
  if (!horarios?.length) return null;
  if (horarios.length === 1) return horarios[0] || null;
  const value = horarios[weekday];
  return value?.trim() ? value : null;
}

function totals(tracks: KurierTrack[]) {
  return {
    novas: tracks.reduce((sum, item) => sum + item.novas, 0),
    duplicadas: tracks.reduce((sum, item) => sum + item.duplicadas, 0),
    descartadas: tracks.reduce((sum, item) => sum + item.descartadas, 0),
    confirmadas: tracks.reduce((sum, item) => sum + item.confirmadas, 0),
    recebidas: tracks.reduce((sum, item) => sum + item.recebidas, 0),
    credenciaisConcluidas: tracks.filter((item) => ["concluido", "erro", "cancelado"].includes(item.status)).length,
  };
}

async function saveState(
  supabase: SupabaseClient,
  execId: string,
  state: JobState,
  leaseToken: string,
  status = "executando",
  finalizado = false,
) {
  const sum = totals(state.tracks);
  const { error } = await supabase.from("execucoes_agendadas").update({
    status,
    registros_encontrados: sum.novas,
    registros_processados: sum.recebidas,
    finalizado_em: finalizado ? new Date().toISOString() : null,
    ultimo_erro: status === "falhou"
      ? state.tracks.find((item) => item.status === "erro")?.erro || "Execução Kurier interrompida"
      : null,
    detalhes: {
      ...sum,
      totalCredenciais: state.tracks.length,
      tracks: state.tracks,
      currentIndex: state.currentIndex,
      hop: state.hop,
      opts: state.opts,
      modo: state.opts.drenagem ? "drenagem" : "normal",
      atualizado_em: new Date().toISOString(),
      lease_token: leaseToken,
      lease_until: new Date(Date.now() + 120_000).toISOString(),
    },
  }).eq("id", execId).neq("status", "cancelado");
  if (error) throw error;
}

function parseState(details: unknown): JobState | null {
  const value = (details || {}) as Record<string, unknown>;
  if (!Array.isArray(value.tracks) || !value.opts) return null;
  return {
    tracks: value.tracks as KurierTrack[],
    currentIndex: Number(value.currentIndex || 0),
    hop: Number(value.hop || 0),
    opts: value.opts as JobOptions,
  };
}

async function invokeNextHop(supabaseUrl: string, serviceKey: string, execId: string) {
  await new Promise((resolve) => setTimeout(resolve, NEXT_HOP_DELAY_MS));
  const response = await fetch(`${supabaseUrl}/functions/v1/executar-kurier-agendado`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ resume: true, exec_id: execId }),
  });
  if (!response.ok) throw new Error(`Falha ao agendar próxima etapa: HTTP ${response.status}`);
}

async function processHop(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  execId: string,
) {
  const leaseToken = crypto.randomUUID();
  const { data: acquired, error: leaseError } = await supabase.rpc("acquire_kurier_execution_lease", {
    _exec_id: execId,
    _lease_token: leaseToken,
    _lease_seconds: 120,
  });
  if (leaseError) throw leaseError;
  if (!acquired) return;

  let scheduleNext = false;
  try {
    const { data: execution, error } = await supabase
      .from("execucoes_agendadas")
      .select("status, detalhes")
      .eq("id", execId)
      .maybeSingle();
    if (error) throw error;
    if (!execution || !["pendente", "executando"].includes(execution.status)) return;

    const state = parseState(execution.detalhes);
    if (!state) throw new Error("Estado de retomada do Kurier inválido");
    if (state.hop >= MAX_HOPS) {
      const current = state.tracks[state.currentIndex];
      if (current) {
        current.status = "erro";
        current.erro = "Limite de etapas atingido; retome para continuar";
        current.mensagem = current.erro;
      }
      await saveState(supabase, execId, state, leaseToken, "falhou", true);
      return;
    }

    while (state.currentIndex < state.tracks.length && state.tracks[state.currentIndex].status === "concluido") {
      state.currentIndex++;
    }
    const track = state.tracks[state.currentIndex];
    if (!track) {
      await saveState(supabase, execId, state, leaseToken, "concluido", true);
      return;
    }

    track.status = "executando";
    track.mensagem = `Consultando lote ${track.maxLotes}×${track.loteSize}...`;
    state.hop++;
    await saveState(supabase, execId, state, leaseToken);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INNER_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/kurier-consultar-publicacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          credencial_id: track.credencialId,
          max_lotes: track.maxLotes,
          lote_size: track.loteSize,
          monitoramento_ids: state.opts.monitoramentoIds?.length ? state.opts.monitoramentoIds : undefined,
          coordenacao_id: state.opts.coordenacaoId,
          data_inicio: state.opts.dataInicio,
          data_fim: state.opts.dataFim,
          modo_personalizado: state.opts.modoPersonalizado && !state.opts.drenarBacklog,
          execucao_id: execId,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      if ((fetchError as Error)?.name !== "AbortError") throw fetchError;
      response = new Response("Tempo limite da consulta excedido", { status: 504 });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      if ([546, 503, 504].includes(response.status)) {
        track.errosLimite++;
        track.maxLotes = 1;
        track.loteSize = MIN_LOTE_SIZE;
        track.hopsSemErro = 0;
        if (track.errosLimite >= MAX_LIMIT_ERRORS) {
          track.status = "erro";
          track.erro = `Limite do servidor persistiu por ${MAX_LIMIT_ERRORS} tentativas (HTTP ${response.status})`;
          track.mensagem = track.erro;
          state.currentIndex++;
        } else {
          track.mensagem = `Limite do servidor; nova tentativa ${track.errosLimite}/${MAX_LIMIT_ERRORS} em 1×10`;
        }
      } else {
        track.status = "erro";
        track.erro = `HTTP ${response.status}: ${responseText.slice(0, 160)}`;
        track.mensagem = `Erro: ${track.erro}`;
        state.currentIndex++;
      }
    } else {
      const result = await response.json() as Record<string, unknown>;
      if (result.error || result.ok === false) {
        track.status = "erro";
        track.erro = String(result.error || result.erro || "Erro Kurier").slice(0, 200);
        track.mensagem = `Erro: ${track.erro}`;
        state.currentIndex++;
      } else {
        const recebidas = Number(result.total_recebidas || 0);
        const lotes = Number(result.lotes_processados || 0);
        track.novas += Number(result.total_novas || 0);
        track.duplicadas += Number(result.total_duplicadas || 0);
        track.descartadas += Number(result.total_descartadas || 0);
        track.confirmadas += Number(result.total_confirmadas || 0);
        track.recebidas += recebidas;
        track.lotes += lotes;
        track.errosLimite = 0;
        // Recuperação do tamanho de lote: depois de um erro de limite o lote cai
        // para 10; aqui ele volta a crescer (10 → 25 → 50) a cada duas rodadas
        // sem erro, evitando drenar backlog grande de 10 em 10.
        track.hopsSemErro = (track.hopsSemErro ?? 0) + 1;
        if (track.hopsSemErro >= HOPS_PARA_CRESCER && track.loteSize < MAX_LOTE_SIZE) {
          const proximo = LOTE_STEPS.find((step) => step > track.loteSize) ?? MAX_LOTE_SIZE;
          track.loteSize = proximo;
          track.maxLotes = DEFAULT_MAX_LOTES;
          track.hopsSemErro = 0;
        }
        track.mensagem = `${track.novas} novas, ${track.duplicadas} dup, ${track.confirmadas} confirm em ${track.lotes} lote(s)`;
        const terminou = state.opts.modoPersonalizado && !state.opts.drenarBacklog && !state.opts.drenagem
          || result.fila_vazia === true
          || result.janela_ultrapassada === true
          || recebidas === 0
          || lotes === 0;
        if (terminou) {
          track.status = "concluido";
          state.currentIndex++;
        } else if (
          !state.opts.drenagem
          && !track.adiado
          && track.lotes >= ADIAR_APOS_LOTES
          && state.tracks.some((item, index) => index > state.currentIndex && item.status !== "concluido")
        ) {
          // Um login com fila acumulada não segura os demais: ele é movido para o
          // fim da lista e retomado depois que os outros terminarem.
          track.adiado = true;
          track.status = "pendente";
          track.mensagem = `Fila acumulada — retomando após os outros logins (${track.lotes} lote(s) já drenados)`;
          state.tracks.splice(state.currentIndex, 1);
          state.tracks.push(track);
        } else if (state.opts.drenagem) {
          track.mensagem = `Fila acumulada — drenando: ${track.mensagem}`;
        }
      }
    }

    const hasRemaining = state.currentIndex < state.tracks.length;
    const hasErrors = state.tracks.some((item) => item.status === "erro");
    if (!hasRemaining) {
      await saveState(supabase, execId, state, leaseToken, hasErrors ? "falhou" : "concluido", true);
    } else {
      await saveState(supabase, execId, state, leaseToken);
      scheduleNext = true;
    }
  } catch (error) {
    console.error("[executar-kurier-agendado] etapa falhou:", error);
    const message = String((error as Error)?.message || error).slice(0, 300);
    await supabase.from("execucoes_agendadas").update({
      status: "falhou",
      finalizado_em: new Date().toISOString(),
      ultimo_erro: message,
    }).eq("id", execId).neq("status", "cancelado");
  } finally {
    await supabase.rpc("release_kurier_execution_lease", {
      _exec_id: execId,
      _lease_token: leaseToken,
    });
  }

  if (scheduleNext) await invokeNextHop(supabaseUrl, serviceKey, execId);
}

async function markStaleExecutions(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data } = await supabase
    .from("execucoes_agendadas")
    .select("id, detalhes, iniciado_em")
    .eq("tipo", "djen_kurier")
    .in("status", ["pendente", "executando"]);
  for (const row of data || []) {
    const details = (row.detalhes || {}) as Record<string, unknown>;
    const heartbeat = String(details.atualizado_em || row.iniciado_em || "");
    if (heartbeat && heartbeat < cutoff) {
      await supabase.from("execucoes_agendadas").update({
        status: "falhou",
        finalizado_em: new Date().toISOString(),
        ultimo_erro: "Execução interrompida por ausência de atualização do servidor",
        detalhes: {
          ...details,
          interrompida: true,
          mensagem_interrupcao: "Execução interrompida por ausência de atualização do servidor",
          interrompida_em: new Date().toISOString(),
        },
      }).eq("id", row.id);
    }
  }
}

async function createInitialState(supabase: SupabaseClient, opts: JobOptions): Promise<JobState> {
  let query = supabase
    .from("kurier_credenciais")
    .select("id, login")
    .eq("ativo", true)
    .not("senha_encrypted", "is", null)
    .order("prioridade", { ascending: false });
  if (opts.coordenacaoId) {
    const { data: links } = await supabase
      .from("kurier_credencial_coordenacoes")
      .select("credencial_id")
      .eq("coordenacao_id", opts.coordenacaoId);
    const ids = (links || []).map((item: { credencial_id: string }) => item.credencial_id);
    if (!ids.length) return { tracks: [], currentIndex: 0, hop: 0, opts };
    query = query.in("id", ids);
  }
  const { data, error } = await query;
  if (error) throw error;
  return {
    currentIndex: 0,
    hop: 0,
    opts,
    tracks: (data || []).map((credential: { id: string; login: string }) => ({
      credencialId: credential.id,
      login: credential.login,
      status: "pendente" as const,
      novas: 0,
      duplicadas: 0,
      descartadas: 0,
      confirmadas: 0,
      recebidas: 0,
      lotes: 0,
      mensagem: "Aguardando...",
      erro: null,
      loteSize: DEFAULT_LOTE_SIZE,
      maxLotes: DEFAULT_MAX_LOTES,
      errosLimite: 0,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuração Supabase ausente" }, 500);
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    if (body.resume === true && typeof body.exec_id === "string") {
      const task = processHop(supabase, supabaseUrl, serviceKey, body.exec_id);
      // @ts-ignore EdgeRuntime existe no Supabase Deno Deploy
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(task);
      else task.catch(console.error);
      return json({ resumed: true, exec_id: body.exec_id }, 202);
    }

    await markStaleExecutions(supabase);
    const force = body.force === true || body.manual === true;
    const now = brtNow();
    const { data: config } = await supabase
      .from("configuracoes_monitoramento")
      .select("id, ativo, horarios_execucao, metadata")
      .eq("tipo", "kurier")
      .maybeSingle();
    if (!force && (!config || !config.ativo)) return json({ skipped: "inativo" });

    if (!force && config) {
      const metadata = (config.metadata || {}) as Record<string, unknown>;
      const days = Array.isArray(metadata.dias_semana) ? metadata.dias_semana as number[] : [1, 2, 3, 4, 5];
      const weekday = brtWeekday(now.ymd);
      if (!days.includes(weekday)) return json({ skipped: "dia_desativado", weekday });
      const schedules = config.horarios_execucao as (string | null)[] | null;
      const schedule = resolveHorarioDoDia(schedules, weekday) || schedules?.[0] || null;
      if (!schedule) return json({ skipped: "sem_horario" });
      const slots = schedules?.filter((item): item is string => !!item && /^\d{2}:\d{2}$/.test(item)) || [schedule];
      const nowMinutes = now.hour * 60 + now.minute;
      const insideWindow = slots.some((slot) => {
        const [hour, minute] = slot.split(":").map(Number);
        const target = hour * 60 + minute;
        return nowMinutes >= target && nowMinutes <= target + WINDOW_MIN;
      });
      if (!insideWindow) return json({ skipped: "fora_janela", slots });

      const start = `${now.ymd}T00:00:00-03:00`;
      const end = `${now.ymd}T23:59:59-03:00`;
      const { data: existing } = await supabase.from("execucoes_agendadas")
        .select("id, status").eq("tipo", "djen_kurier").gte("iniciado_em", start).lte("iniciado_em", end);
      if ((existing || []).some((item: { status: string }) => item.status !== "falhou")) {
        return json({ skipped: "ja_executou_hoje" });
      }
    }

    const opts: JobOptions = {
      coordenacaoId: typeof body.coordenacao_id === "string" ? body.coordenacao_id : undefined,
      monitoramentoIds: Array.isArray(body.monitoramento_ids) ? body.monitoramento_ids : undefined,
      dataInicio: typeof body.data_inicio === "string" ? body.data_inicio : undefined,
      dataFim: typeof body.data_fim === "string" ? body.data_fim : undefined,
      modoPersonalizado: body.modo_personalizado === true,
      drenarBacklog: body.drenar_backlog === true,
    };
    const state = await createInitialState(supabase, opts);
    if (!state.tracks.length) return json({ skipped: "nenhuma_credencial_ativa" });

    const initialTotals = totals(state.tracks);
    const { data: execution, error } = await supabase.from("execucoes_agendadas").insert({
      tipo: "djen_kurier",
      status: "executando",
      job_name: "DJEN Termos Kurier (Servidor)",
      iniciado_em: new Date().toISOString(),
      detalhes: {
        ...initialTotals,
        totalCredenciais: state.tracks.length,
        tracks: state.tracks,
        currentIndex: 0,
        hop: 0,
        opts,
        atualizado_em: new Date().toISOString(),
      },
    }).select("id").single();
    if (error || !execution) throw new Error(`Falha ao criar execução: ${error?.message || "sem id"}`);

    if (config?.id) {
      await supabase.from("configuracoes_monitoramento")
        .update({ ultima_execucao: new Date().toISOString() }).eq("id", config.id);
    }

    const task = processHop(supabase, supabaseUrl, serviceKey, execution.id as string);
    // @ts-ignore EdgeRuntime existe no Supabase Deno Deploy
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(task);
    else task.catch(console.error);
    return json({ started: true, exec_id: execution.id }, 202);
  } catch (error) {
    console.error("[executar-kurier-agendado] handler:", error);
    return json({ error: String((error as Error)?.message || error) }, 500);
  }
});