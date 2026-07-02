/**
 * DJET Pautas Paralela Engine v2.0 — Servidor
 *
 * O motor agora roda inteiramente no servidor (edge `executar-djet-pautas-agendado`
 * com `persistMode='browser'`). Este arquivo cliente apenas dispara a execução
 * e polla `execucoes_agendadas` (tipo='djet_pautas') para refletir progresso
 * agregado na UI. A gravação continua indo para `publicacoes_djen` com
 * `tipo_publicacao='pauta'` (tabela oficial do Browser).
 */

import { supabase } from "@/integrations/supabase/client";

export type TrackStatus = "pendente" | "executando" | "concluido" | "erro" | "cancelado";

export interface TrackProgress {
  tribunal: string;
  status: TrackStatus;
  current: number;
  total: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  diasSemPdf: number;
  mensagem: string;
  diaAtual: string | null;
  ultimoErro: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface DjetPautasParalelaProgress {
  status: "idle" | "executando" | "concluido" | "cancelado" | "erro";
  tracks: TrackProgress[];
  totalTribunais: number;
  tribunaisConcluidos: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  percentage: number;
  mensagem: string;
  tempoDecorrido: number;
  iniciadoEm: string | null;
  dataInicioYmd: string | null;
  dataFimYmd: string | null;
  concorrencia: number;
}

interface Checkpoint {
  runKey: string;
  dataInicioYmd: string;
  dataFimYmd: string;
  tribunaisConcluidos: string[];
  novas: number;
  duplicadas: number;
  descartadas: number;
  tempoInicio: number;
}

export const MAX_CONCURRENCY = 1;
const POLL_INTERVAL_MS = 2500;

const TRIBUNAIS_DEJT = [
  "TST",
  "TRT1", "TRT2", "TRT3", "TRT4", "TRT5", "TRT6", "TRT7", "TRT8",
  "TRT9", "TRT10", "TRT11", "TRT12", "TRT13", "TRT14", "TRT15",
  "TRT16", "TRT17", "TRT18", "TRT19", "TRT20", "TRT21", "TRT22",
  "TRT23", "TRT24",
];

export { TRIBUNAIS_DEJT };

function emptyTracks(): TrackProgress[] {
  return TRIBUNAIS_DEJT.map((t) => ({
    tribunal: t,
    status: "pendente" as TrackStatus,
    current: 0,
    total: 0,
    novas: 0,
    duplicadas: 0,
    descartadas: 0,
    diasSemPdf: 0,
    mensagem: "Aguardando",
    diaAtual: null,
    ultimoErro: null,
    startedAt: null,
    finishedAt: null,
  }));
}

function initialProgress(): DjetPautasParalelaProgress {
  return {
    status: "idle",
    tracks: emptyTracks(),
    totalTribunais: TRIBUNAIS_DEJT.length,
    tribunaisConcluidos: 0,
    novas: 0,
    duplicadas: 0,
    descartadas: 0,
    percentage: 0,
    mensagem: "",
    tempoDecorrido: 0,
    iniciadoEm: null,
    dataInicioYmd: null,
    dataFimYmd: null,
    concorrencia: MAX_CONCURRENCY,
  };
}

let progress: DjetPautasParalelaProgress = initialProgress();
let running = false;
let listeners = new Set<(p: DjetPautasParalelaProgress) => void>();
let currentExecucaoId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l({ ...progress, tracks: progress.tracks.map((t) => ({ ...t })) });
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function applyRemoteState(row: {
  status: string;
  registros_encontrados: number | null;
  registros_processados: number | null;
  erros: number | null;
  detalhes: unknown;
  iniciado_em: string | null;
  finalizado_em: string | null;
}) {
  const d = (row.detalhes as Record<string, unknown> | null) || {};
  const progressoRemoto = (d.progresso as Record<string, unknown> | null) || null;
  const itensRemotos = Array.isArray(progressoRemoto?.itens) ? progressoRemoto.itens as Record<string, unknown>[] : [];
  const novas = Number(d.novas ?? row.registros_encontrados ?? 0);
  const duplicadas = Number(d.duplicadas ?? Math.max(0, (row.registros_processados ?? 0) - novas));
  progress.novas = novas;
  progress.duplicadas = duplicadas;
  if (row.iniciado_em) progress.iniciadoEm = row.iniciado_em;

  const s = row.status;
  const statusFromRemote = (status: unknown): TrackStatus => {
    const v = String(status || "pendente");
    return v === "executando" || v === "concluido" || v === "cancelado" || v === "erro" ? v : "pendente";
  };

  if (itensRemotos.length > 0) {
    progress.tracks = itensRemotos.map((item) => ({
      tribunal: String(item.tribunal || item.label || item.id || "DEJT"),
      status: statusFromRemote(item.status),
      current: Number(item.current ?? 0),
      total: Number(item.total ?? 0),
      novas: Number(item.novas ?? 0),
      duplicadas: Number(item.duplicadas ?? item.duplicatas ?? 0),
      descartadas: Number(item.descartadas ?? 0),
      diasSemPdf: Number(item.diasSemPdf ?? 0),
      mensagem: String(item.mensagem || ""),
      diaAtual: (item.diaAtual as string | null) ?? null,
      ultimoErro: (item.ultimoErro as string | null) ?? null,
      startedAt: null,
      finishedAt: null,
    }));
    progress.totalTribunais = Number(progressoRemoto?.totalItens ?? progress.tracks.length);
    progress.tribunaisConcluidos = Number(
      progressoRemoto?.concluidos ?? progress.tracks.filter((t) => ["concluido", "erro", "cancelado"].includes(t.status)).length,
    );
    progress.percentage = progress.totalTribunais > 0
      ? Math.min(100, Math.round((progress.tribunaisConcluidos / progress.totalTribunais) * 100))
      : (["concluido", "cancelado", "erro", "falhou"].includes(s) ? 100 : 0);
  } else {
    progress.tracks = progress.tracks.map((t, idx) => idx === 0 ? {
      ...t,
      tribunal: "Servidor DEJT",
      status: s === "executando" ? "executando" : (s === "concluido" ? "concluido" : s === "cancelado" ? "cancelado" : "erro"),
      novas,
      duplicadas,
      mensagem: s === "executando" ? "Rodando no servidor…" : `Total: ${novas} nova(s)`,
    } : { ...t, status: "pendente" });
    progress.totalTribunais = 1;
    progress.tribunaisConcluidos = ["concluido", "cancelado", "erro", "falhou"].includes(s) ? 1 : 0;
    progress.percentage = ["concluido", "cancelado", "erro", "falhou"].includes(s) ? 100 : 50;
  }

  if (s === "executando" || s === "pendente") {
    progress.status = "executando";
    running = true;
    progress.mensagem = "Executando no servidor…";
  } else if (s === "concluido") {
    progress.status = "concluido";
    progress.mensagem = `Concluído: ${novas} nova(s), ${duplicadas} dup`;
    running = false;
    stopPolling();
  } else if (s === "cancelado") {
    progress.status = "cancelado";
    progress.mensagem = "Cancelado pelo usuário";
    running = false;
    stopPolling();
  } else {
    progress.status = "erro";
    progress.mensagem = String(d.ultimo_erro || "Erro na execução no servidor");
    running = false;
    stopPolling();
  }
  emit();
}

async function pollOnce() {
  if (!currentExecucaoId) return;
  const { data } = await (supabase as any)
    .from("execucoes_agendadas")
    .select("status, registros_encontrados, registros_processados, erros, detalhes, iniciado_em, finalizado_em")
    .eq("id", currentExecucaoId)
    .maybeSingle();
  if (data) applyRemoteState(data);
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { void pollOnce(); }, POLL_INTERVAL_MS);
  void pollOnce();
}

export async function executarDjetPautasParalela(
  dataInicioYmd?: string,
  dataFimYmd?: string,
  _retomar = false,
  _coordenacaoId?: string,
  _monitoramentoIds?: string[],
): Promise<void> {
  if (running) return;
  running = true;

  progress = initialProgress();
  progress.status = "executando";
  progress.iniciadoEm = new Date().toISOString();
  progress.dataInicioYmd = dataInicioYmd ?? null;
  progress.dataFimYmd = dataFimYmd ?? null;
  progress.mensagem = "Solicitando execução no servidor…";
  emit();

  try {
    const { data, error } = await supabase.functions.invoke("executar-djet-pautas-agendado", {
      body: {
        force: true,
        persist_mode: "browser",
        dataInicio: dataInicioYmd,
        dataFim: dataFimYmd,
        coordenacaoId: _coordenacaoId,
        monitoramentoIds: _monitoramentoIds,
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
    progress.mensagem = "Executando no servidor…";
    emit();
    startPolling();
  } catch (e: unknown) {
    progress.status = "erro";
    progress.mensagem = `Erro: ${String((e as Error)?.message ?? e)}`;
    running = false;
    emit();
  }
}

export async function cancelarDjetPautasParalela() {
  if (!currentExecucaoId) { running = false; return; }
  try {
    await (supabase as any)
      .from("execucoes_agendadas")
      .update({ status: "cancelado", detalhes: { cancel_request: true } })
      .eq("id", currentExecucaoId);
  } catch (e) {
    console.warn("[DJET Pautas] cancelar falhou:", e);
  }
  progress.status = "cancelado";
  progress.mensagem = "Cancelamento solicitado ao servidor";
  running = false;
  stopPolling();
  emit();
}

export function limparEstadoDjetPautasParalela() {
  if (running) return;
  progress = initialProgress();
  emit();
}

export async function forceKillDjetPautasParalela(_clearCp = false) {
  await cancelarDjetPautasParalela();
  running = false;
  stopPolling();
  currentExecucaoId = null;
  progress.status = "cancelado";
  progress.mensagem = "Force kill";
  emit();
}

export async function resetTotalDjetPautasParalela() {
  running = false;
  stopPolling();
  currentExecucaoId = null;
  progress = initialProgress();
  emit();
}

export function getDjetPautasParalelaProgress(): DjetPautasParalelaProgress {
  return { ...progress, tracks: progress.tracks.map((t) => ({ ...t })) };
}

export function isDjetPautasParalelaRunning(): boolean {
  return running;
}

export function getCheckpointDjetPautas(): Checkpoint | null {
  return null;
}

export function subscribeDjetPautasParalela(fn: (p: DjetPautasParalelaProgress) => void): () => void {
  listeners.add(fn);
  fn(getDjetPautasParalelaProgress());
  return () => { listeners.delete(fn); };
}

// Retoma poll se houver execução ativa quando a página abre.
(async function hydrate() {
  try {
    const { data } = await (supabase as any)
      .from("execucoes_agendadas")
      .select("id, status, registros_encontrados, registros_processados, erros, detalhes, iniciado_em, finalizado_em")
      .eq("tipo", "djet_pautas")
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
})();