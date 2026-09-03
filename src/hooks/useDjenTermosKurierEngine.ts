/**
 * DJEN Termos Kurier Engine v2.0 — Servidor
 *
 * Antes rodava as credenciais Kurier direto no navegador. Agora dispara a
 * execução no servidor (edge `executar-kurier-agendado`, que por sua vez chama
 * `kurier-consultar-publicacoes` em pool com concorrência 3 do lado do
 * servidor) e apenas polla `execucoes_agendadas` (tipo='djen_kurier') para
 * refletir o progresso na UI.
 *
 * A gravação continua indo para `publicacoes_djen` (tabela oficial do Browser).
 * Nenhum motor Servidor DJEN é tocado.
 */

import { supabase } from "@/integrations/supabase/client";

export type TrackStatus = "pendente" | "executando" | "concluido" | "erro" | "cancelado";

export interface KurierTrack {
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
  startedAt: number | null;
  finishedAt: number | null;
}

export interface KurierProgress {
  status: "idle" | "executando" | "concluido" | "cancelado" | "erro";
  tracks: KurierTrack[];
  totalCredenciais: number;
  credenciaisConcluidas: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  confirmadas: number;
  recebidas: number;
  percentage: number;
  mensagem: string;
  tempoDecorrido: number;
  iniciadoEm: string | null;
  concorrencia: number;
}

interface Checkpoint {
  runKey: string;
  credenciaisConcluidas: string[];
  novas: number;
  duplicadas: number;
  descartadas: number;
  confirmadas: number;
  tempoInicio: number;
}

const MAX_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 2000;
const STALE_HEARTBEAT_MS = 3 * 60 * 1000;

function initialProgress(): KurierProgress {
  return {
    status: "idle",
    tracks: [],
    totalCredenciais: 0,
    credenciaisConcluidas: 0,
    novas: 0,
    duplicadas: 0,
    descartadas: 0,
    confirmadas: 0,
    recebidas: 0,
    percentage: 0,
    mensagem: "",
    tempoDecorrido: 0,
    iniciadoEm: null,
    concorrencia: MAX_CONCURRENCY,
  };
}

let progress: KurierProgress = initialProgress();
let running = false;
let listeners = new Set<(p: KurierProgress) => void>();
let currentExecucaoId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l({ ...progress, tracks: progress.tracks.map((t) => ({ ...t })) });
}

export function getCheckpointKurier(): Checkpoint | null { return null; }
export function isDjenTermosKurierRunning() { return running; }
export function getDjenTermosKurierProgress(): KurierProgress { return { ...progress, tracks: progress.tracks.map((t) => ({ ...t })) }; }

export function subscribeDjenTermosKurier(fn: (p: KurierProgress) => void): () => void {
  listeners.add(fn);
  fn(getDjenTermosKurierProgress());
  return () => { listeners.delete(fn); };
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function applyRemoteState(row: {
  status: string;
  registros_encontrados: number | null;
  registros_processados: number | null;
  detalhes: unknown;
  iniciado_em: string | null;
  finalizado_em: string | null;
}) {
  const d = (row.detalhes as Record<string, unknown> | null) || {};
  const tracksIn = Array.isArray(d.tracks) ? (d.tracks as Array<Record<string, unknown>>) : [];
  progress.tracks = tracksIn.map((t): KurierTrack => ({
    credencialId: String(t.credencialId || ""),
    login: String(t.login || ""),
    status: (t.status as KurierTrack["status"]) || "pendente",
    novas: Number(t.novas ?? 0),
    duplicadas: Number(t.duplicadas ?? 0),
    descartadas: Number(t.descartadas ?? 0),
    confirmadas: Number(t.confirmadas ?? 0),
    recebidas: Number(t.recebidas ?? 0),
    lotes: Number(t.lotes ?? 0),
    mensagem: String(t.mensagem ?? ""),
    erro: (t.erro as string | null) ?? null,
    startedAt: null,
    finishedAt: null,
  }));
  progress.totalCredenciais = Number(d.totalCredenciais ?? progress.tracks.length);
  progress.credenciaisConcluidas = Number(d.credenciaisConcluidas ?? 0);
  progress.novas = Number(d.novas ?? row.registros_encontrados ?? 0);
  progress.duplicadas = Number(d.duplicadas ?? 0);
  progress.descartadas = Number(d.descartadas ?? 0);
  progress.confirmadas = Number(d.confirmadas ?? 0);
  progress.recebidas = Number(d.recebidas ?? row.registros_processados ?? 0);
  progress.percentage = progress.totalCredenciais > 0
    ? Math.floor((progress.credenciaisConcluidas / progress.totalCredenciais) * 100)
    : 0;
  if (row.iniciado_em) progress.iniciadoEm = row.iniciado_em;

  const s = row.status;
  if (s === "executando" || s === "pendente") {
    const heartbeatValue = typeof d.atualizado_em === "string" ? Date.parse(d.atualizado_em) : NaN;
    if (Number.isFinite(heartbeatValue) && Date.now() - heartbeatValue > STALE_HEARTBEAT_MS) {
      progress.status = "erro";
      progress.mensagem = "Execução interrompida: o servidor parou de atualizar";
      running = false;
      stopPolling();
      emit();
      return;
    }
    progress.status = "executando";
    running = true;
    progress.mensagem = progress.tracks.find((t) => t.status === "executando")?.mensagem
      || `Executando no servidor (${progress.credenciaisConcluidas}/${progress.totalCredenciais})`;
  } else if (s === "concluido") {
    progress.status = "concluido";
    progress.mensagem = `Concluído: ${progress.novas} novas, ${progress.duplicadas} dup, ${progress.confirmadas} confirmadas`;
    running = false;
    stopPolling();
  } else if (s === "cancelado") {
    progress.status = "cancelado";
    progress.mensagem = "Cancelado pelo usuário";
    running = false;
    stopPolling();
  } else {
    progress.status = "erro";
    progress.mensagem = "Erro na execução Kurier";
    running = false;
    stopPolling();
  }
  emit();
}

async function pollOnce() {
  if (!currentExecucaoId) return;
  const { data } = await (supabase as any)
    .from("execucoes_agendadas")
    .select("status, registros_encontrados, registros_processados, detalhes, iniciado_em, finalizado_em")
    .eq("id", currentExecucaoId)
    .maybeSingle();
  if (data) applyRemoteState(data);
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { void pollOnce(); }, POLL_INTERVAL_MS);
  void pollOnce();
}

export async function executarDjenTermosKurier(
  retomar = false,
  monitoramentoIds?: string[],
  coordenacaoId?: string,
  dataInicioYmd?: string,
  dataFimYmd?: string,
  drenarBacklog = false,
  modoPersonalizado = false,
): Promise<void> {
  if (running) return;
  running = true;
  const ymdValido = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const effInicio = modoPersonalizado && ymdValido(dataInicioYmd) ? dataInicioYmd : undefined;
  const effFim = modoPersonalizado && ymdValido(dataFimYmd) ? dataFimYmd : undefined;

  progress = initialProgress();
  progress.status = "executando";
  progress.iniciadoEm = new Date().toISOString();
  progress.mensagem = "Solicitando execução no servidor...";
  emit();

  try {
    const { data, error } = await supabase.functions.invoke("executar-kurier-agendado", {
      body: {
        manual: true,
        force: true,
        coordenacao_id: coordenacaoId,
        monitoramento_ids: monitoramentoIds,
        data_inicio: effInicio,
        data_fim: effFim,
        modo_personalizado: modoPersonalizado,
        drenar_backlog: drenarBacklog,
      },
    });
    if (error) throw error;
    const r = data as { started?: boolean; exec_id?: string; skipped?: string };
    if (!r?.exec_id) {
      progress.status = "concluido";
      progress.mensagem = r?.skipped ? `Servidor pulou: ${r.skipped}` : "Servidor não retornou exec_id";
      running = false;
      emit();
      return;
    }
    currentExecucaoId = r.exec_id;
    progress.mensagem = "Executando no servidor...";
    emit();
    startPolling();
  } catch (e: unknown) {
    progress.status = "erro";
    progress.mensagem = `Erro: ${String((e as Error)?.message ?? e)}`;
    running = false;
    emit();
  }
}

export async function cancelarDjenTermosKurier(): Promise<void> {
  if (!currentExecucaoId) { running = false; return; }
  try {
      // O status é suficiente para impedir que a próxima etapa seja executada.
    await (supabase as any)
      .from("execucoes_agendadas")
        .update({ status: "cancelado", finalizado_em: new Date().toISOString() })
      .eq("id", currentExecucaoId);
  } catch (e) {
    console.warn("[DJEN Kurier] cancelar falhou:", e);
  }
  progress.status = "cancelado";
  progress.mensagem = "Cancelamento solicitado ao servidor";
  running = false;
  stopPolling();
  emit();
}

export function limparEstadoDjenTermosKurier() {
  if (running) return;
  progress = initialProgress();
  emit();
}

export async function forceKillDjenTermosKurier(_alsoClearCheckpoint = false) {
  await cancelarDjenTermosKurier();
  running = false;
  progress.status = "cancelado";
  progress.mensagem = "Force kill";
  stopPolling();
  currentExecucaoId = null;
  emit();
}

export async function resetTotalDjenTermosKurier() {
  running = false;
  stopPolling();
  currentExecucaoId = null;
  progress = initialProgress();
  emit();
}

/** Reidrata UI a partir da última execução agendada (best effort). */
export async function hydrateDjenTermosKurierFromBackend() {
  // Se houver execução em andamento, reata o poll.
  try {
    const { data } = await (supabase as any)
      .from("execucoes_agendadas")
      .select("id, status, registros_encontrados, registros_processados, detalhes, iniciado_em, finalizado_em")
      .eq("tipo", "djen_kurier")
      .in("status", ["executando", "pendente"])
      .order("iniciado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      currentExecucaoId = data.id;
      running = true;
      applyRemoteState(data);
      startPolling();
    }
  } catch { /* silencioso */ }
}