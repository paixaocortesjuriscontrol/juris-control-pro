/**
 * DJEN Termos Kurier Engine v1.0
 *
 * Singleton em memória + checkpoint em localStorage que processa as credenciais
 * Kurier ativas em paralelo (concorrência 3), chamando a edge function
 * `kurier-consultar-publicacoes` para cada login.
 *
 * Cada track = uma credencial Kurier. Totalmente isolado do DJEN/Paralela.
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
const STORAGE_KEY = "djen-termos-kurier-checkpoint-v1";

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
    percentage: 0,
    mensagem: "",
    tempoDecorrido: 0,
    iniciadoEm: null,
    concorrencia: MAX_CONCURRENCY,
  };
}

let progress: KurierProgress = initialProgress();
let running = false;
let cancelRequested = false;
let listeners = new Set<(p: KurierProgress) => void>();
let runKey: string | null = null;

function emit() {
  for (const l of listeners) l({ ...progress, tracks: progress.tracks.map((t) => ({ ...t })) });
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCheckpoint(cp: Checkpoint) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cp)); } catch {}
}

function clearCheckpoint() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function getCheckpointKurier(): Checkpoint | null { return loadCheckpoint(); }
export function isDjenTermosKurierRunning() { return running; }
export function getDjenTermosKurierProgress(): KurierProgress { return { ...progress, tracks: progress.tracks.map((t) => ({ ...t })) }; }

export function subscribeDjenTermosKurier(fn: (p: KurierProgress) => void): () => void {
  listeners.add(fn);
  fn(getDjenTermosKurierProgress());
  return () => { listeners.delete(fn); };
}

function recompute() {
  progress.totalCredenciais = progress.tracks.length;
  progress.credenciaisConcluidas = progress.tracks.filter((t) => t.status === "concluido" || t.status === "erro" || t.status === "cancelado").length;
  progress.novas = progress.tracks.reduce((s, t) => s + t.novas, 0);
  progress.duplicadas = progress.tracks.reduce((s, t) => s + t.duplicadas, 0);
  progress.descartadas = progress.tracks.reduce((s, t) => s + t.descartadas, 0);
  progress.confirmadas = progress.tracks.reduce((s, t) => s + t.confirmadas, 0);
  progress.percentage = progress.totalCredenciais > 0
    ? Math.floor((progress.credenciaisConcluidas / progress.totalCredenciais) * 100)
    : 0;
}

async function processarCredencial(
  track: KurierTrack,
  monitoramentoIds?: string[],
  coordenacaoId?: string,
  dataInicioYmd?: string,
  dataFimYmd?: string,
) {
  track.status = "executando";
  track.startedAt = Date.now();
  track.mensagem = "Consultando lotes…";
  emit();

  try {
    const { data, error } = await supabase.functions.invoke("kurier-consultar-publicacoes", {
      body: {
        credencial_id: track.credencialId,
        max_lotes: 20,
        monitoramento_ids: monitoramentoIds && monitoramentoIds.length ? monitoramentoIds : undefined,
        coordenacao_id: coordenacaoId || undefined,
        data_inicio: dataInicioYmd || undefined,
        data_fim: dataFimYmd || undefined,
      },
    });
    if (error) throw error;
    const r = data as any;
    if (r?.error) throw new Error(r.error);

    track.novas = Number(r?.total_novas ?? 0);
    track.duplicadas = Number(r?.total_duplicadas ?? 0);
    track.descartadas = Number(r?.total_descartadas ?? 0);
    track.confirmadas = Number(r?.total_confirmadas ?? 0);
    track.recebidas = Number(r?.total_recebidas ?? 0);
    track.lotes = Number(r?.lotes_processados ?? 0);
    track.erro = r?.erro ?? null;
    track.status = r?.ok === false ? "erro" : "concluido";
    track.mensagem = r?.ok === false
      ? `Erro: ${(r?.erro ?? "").slice(0, 80)}`
      : `${track.novas} novas, ${track.duplicadas} dup, ${track.confirmadas} confirm em ${track.lotes} lote(s)`;
  } catch (e: any) {
    track.status = "erro";
    track.erro = String(e?.message ?? e);
    track.mensagem = `Erro: ${track.erro.slice(0, 80)}`;
  } finally {
    track.finishedAt = Date.now();
    recompute();
    // Persiste checkpoint
    if (runKey) {
      saveCheckpoint({
        runKey,
        credenciaisConcluidas: progress.tracks
          .filter((t) => t.status === "concluido" || t.status === "erro")
          .map((t) => t.credencialId),
        novas: progress.novas,
        duplicadas: progress.duplicadas,
        descartadas: progress.descartadas,
        confirmadas: progress.confirmadas,
        tempoInicio: progress.iniciadoEm ? new Date(progress.iniciadoEm).getTime() : Date.now(),
      });
    }
    emit();
  }
}

async function runPool(
  tracks: KurierTrack[],
  monitoramentoIds?: string[],
  coordenacaoId?: string,
  dataInicioYmd?: string,
  dataFimYmd?: string,
) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, tracks.length) }, async () => {
    while (!cancelRequested) {
      const i = idx++;
      if (i >= tracks.length) return;
      await processarCredencial(tracks[i], monitoramentoIds, coordenacaoId, dataInicioYmd, dataFimYmd);
    }
    // Marca pendentes como cancelados
    for (let j = idx; j < tracks.length; j++) {
      if (tracks[j].status === "pendente") {
        tracks[j].status = "cancelado";
        tracks[j].mensagem = "Cancelado antes de iniciar";
      }
    }
  });
  await Promise.all(workers);
}

export async function executarDjenTermosKurier(
  retomar = false,
  monitoramentoIds?: string[],
  coordenacaoId?: string,
  dataInicioYmd?: string,
  dataFimYmd?: string,
): Promise<void> {
  if (running) return;
  running = true;
  cancelRequested = false;
  runKey = retomar ? (loadCheckpoint()?.runKey ?? crypto.randomUUID()) : crypto.randomUUID();

  progress = initialProgress();
  progress.status = "executando";
  progress.iniciadoEm = new Date().toISOString();
  progress.mensagem = "Carregando credenciais ativas…";
  emit();

  try {
    const { data: creds, error } = await (supabase as any)
      .from("kurier_credenciais")
      .select("id, login, senha_encrypted")
      .eq("ativo", true)
      .not("senha_encrypted", "is", null)
      .order("prioridade", { ascending: false });
    if (error) throw error;

    const ckp = retomar ? loadCheckpoint() : null;
    const concluidasPrev = new Set<string>(ckp?.credenciaisConcluidas ?? []);

    const tracks: KurierTrack[] = (creds ?? []).map((c: any) => ({
      credencialId: c.id,
      login: c.login,
      status: concluidasPrev.has(c.id) ? "concluido" : "pendente",
      novas: 0,
      duplicadas: 0,
      descartadas: 0,
      confirmadas: 0,
      recebidas: 0,
      lotes: 0,
      mensagem: concluidasPrev.has(c.id) ? "Já concluído (checkpoint)" : "Aguardando…",
      erro: null,
      startedAt: null,
      finishedAt: null,
    }));

    if (!tracks.length) {
      progress.status = "concluido";
      progress.mensagem = "Nenhuma credencial ativa com senha cadastrada.";
      running = false;
      emit();
      return;
    }

    progress.tracks = tracks;
    recompute();
    emit();

    const aPercorrer = tracks.filter((t) => t.status === "pendente");
    await runPool(aPercorrer, monitoramentoIds, coordenacaoId, dataInicioYmd, dataFimYmd);

    if (cancelRequested) {
      progress.status = "cancelado";
      progress.mensagem = "Execução cancelada";
    } else {
      const houveErro = tracks.some((t) => t.status === "erro");
      progress.status = houveErro ? "erro" : "concluido";
      progress.mensagem = houveErro
        ? `Concluído com erros (${progress.novas} novas)`
        : `Concluído: ${progress.novas} novas, ${progress.duplicadas} dup, ${progress.confirmadas} confirmadas`;
      clearCheckpoint();
    }
  } catch (e: any) {
    progress.status = "erro";
    progress.mensagem = `Erro: ${String(e?.message ?? e)}`;
  } finally {
    running = false;
    cancelRequested = false;
    emit();
  }
}

export async function cancelarDjenTermosKurier(): Promise<void> {
  cancelRequested = true;
}

export function limparEstadoDjenTermosKurier() {
  if (running) return;
  progress = initialProgress();
  emit();
}

export async function forceKillDjenTermosKurier(alsoClearCheckpoint = false) {
  cancelRequested = true;
  running = false;
  progress.status = "cancelado";
  progress.mensagem = "Force kill";
  if (alsoClearCheckpoint) clearCheckpoint();
  emit();
}

export async function resetTotalDjenTermosKurier() {
  cancelRequested = true;
  running = false;
  clearCheckpoint();
  progress = initialProgress();
  emit();
}

/** Reidrata UI a partir da última execução agendada (best effort). */
export async function hydrateDjenTermosKurierFromBackend() {
  // Sem state global no backend ainda: mantemos o que está em memória.
  // (Espaço para evoluir lendo kurier_execucoes recentes.)
}