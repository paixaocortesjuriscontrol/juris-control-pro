/**
 * DJEN Termos Paralela Scheduler
 *
 * Igual ao Pro Scheduler, mas para o motor Paralela.
 * Persiste horário e status ativo na tabela configuracoes_monitoramento (tipo='djen_paralela').
 * Dispara automaticamente após o horário alvo (BRT).
 * Se o browser abrir depois, executa assim que possível.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  executarDjenTermosParalela,
  isDjenTermosParalelaRunning,
} from './useDjenTermosParalelaEngine';

export interface DjenTermosParalelaSchedulerStatus {
  ativo: boolean;
  proximoHorario: string | null;
  ultimaExecucao: string | null;
  /** Horários BRT (HH:MM), até 3 slots. */
  horarios: string[];
  /** Dias da semana ativos (0=Dom, 1=Seg, …, 6=Sáb). */
  diasSemana: number[];
}

let schedulerInstance: DjenTermosParalelaScheduler | null = null;
const subscribersSet: Set<(status: DjenTermosParalelaSchedulerStatus) => void> = new Set();

const DEFAULT_DIAS_SEMANA = [1, 2, 3, 4, 5];
const MAX_SLOTS = 3;

function normalizarHorarios(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const ok = arr
    .map((v) => String(v ?? '').trim())
    .filter((v) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(v))
    .map((v) => {
      const [h, m] = v.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    });
  return Array.from(new Set(ok)).sort().slice(0, MAX_SLOTS);
}

class DjenTermosParalelaScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastCheckTime = 0;
  private lastToastTime = 0;
  private dbConfigId: string | null = null;
  private dbLoaded = false;
  private dbLoadPromise: Promise<void>;

  private readonly INTERVAL_MS = 30000;
  // Default: 5h BRT
  private horarios: string[] = ['05:00'];
  private diasSemana: number[] = [...DEFAULT_DIAS_SEMANA];
  // Janela máxima após o horário alvo em que ainda é permitido disparar
  // automaticamente (em minutos). Fora dessa janela, esperamos o próximo dia.
  private readonly TARGET_WINDOW_MINUTES = 30;
  private readonly TOAST_COOLDOWN_MS = 60000;

  constructor() {
    this.dbLoadPromise = this.loadFromDb();
  }

  private async loadFromDb() {
    try {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, ativo, horarios_execucao, metadata')
        .eq('tipo', 'djen_paralela')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Paralela Scheduler] Erro ao carregar config do DB:', error);
        return;
      }

      if (data) {
        this.dbConfigId = data.id;
        const horarios = normalizarHorarios(data.horarios_execucao);
        if (horarios.length > 0) this.horarios = horarios;
        const meta = (data.metadata as any) || {};
        if (Array.isArray(meta.dias_semana) && meta.dias_semana.length > 0) {
          this.diasSemana = meta.dias_semana
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6);
          if (this.diasSemana.length === 0) this.diasSemana = [...DEFAULT_DIAS_SEMANA];
        }
        if (data.ativo && !this.isRunning) {
          this.startInternal();
        }
      }
      this.dbLoaded = true;
      this.notifySubscribers();
    } catch (err) {
      console.error('[Paralela Scheduler] Erro ao carregar config do DB:', err);
    }
  }

  private async saveToDb() {
    await this.dbLoadPromise;
    try {
      if (this.dbConfigId) {
        const { data: existing } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('id', this.dbConfigId)
          .maybeSingle();
        const meta = {
          ...((existing?.metadata as any) || {}),
          dias_semana: this.diasSemana,
        };
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .update({
            ativo: this.isRunning,
            horarios_execucao: this.horarios,
            metadata: meta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', this.dbConfigId);
        if (error) {
          console.error('[Paralela Scheduler] Erro ao atualizar config no DB:', error);
        }
      } else {
        const { data, error } = await supabase
          .from('configuracoes_monitoramento')
          .insert({
            tipo: 'djen_paralela',
            ativo: this.isRunning,
            horarios_execucao: this.horarios,
            frequencia: 'diario',
            metadata: { dias_semana: this.diasSemana },
          })
          .select('id')
          .single();
        if (error) {
          console.error('[Paralela Scheduler] Erro ao inserir config no DB:', error);
        } else if (data) {
          this.dbConfigId = data.id;
        }
      }
    } catch (err) {
      console.error('[Paralela Scheduler] Erro ao salvar config no DB:', err);
    }
  }

  private slotRanKey(ymd: string, slot: string): string {
    return `djen-paralela-scheduler-last-run-${ymd}-${slot}`;
  }

  private slotJaRodou(ymd: string, slot: string): boolean {
    return !!localStorage.getItem(this.slotRanKey(ymd, slot));
  }

  private marcarSlotRodado(ymd: string, slot: string) {
    localStorage.setItem(this.slotRanKey(ymd, slot), String(Date.now()));
  }

  private getDayOfWeekBrt(): number {
    // 0=Dom..6=Sáb
    const s = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[s.slice(0, 3)] ?? new Date().getDay();
  }

  private getTodayYmd(): string {
    const parts = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      .split('-');
    return parts.join('-');
  }

  private getBrtHourMinute(): { hour: number; minute: number } {
    const str = new Date().toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour12: false,
    });
    const timePart = str.split(', ')[1];
    const [h, m] = timePart.split(':').map(Number);
    return { hour: h === 24 ? 0 : h, minute: m };
  }

  /** Retorna o slot HH:MM que deve disparar agora (janela aberta + não rodou hoje), ou null. */
  private slotPendente(): string | null {
    if (!this.diasSemana.includes(this.getDayOfWeekBrt())) return null;
    const { hour, minute } = this.getBrtHourMinute();
    const nowMinutes = hour * 60 + minute;
    const ymd = this.getTodayYmd();
    for (const slot of this.horarios) {
      const [h, m] = slot.split(':').map(Number);
      const target = h * 60 + m;
      if (nowMinutes >= target && nowMinutes <= target + this.TARGET_WINDOW_MINUTES) {
        if (!this.slotJaRodou(ymd, slot)) return slot;
      }
    }
    return null;
  }

  private async checkAndRun() {
    const now = Date.now();
    if (now - this.lastCheckTime < 10000) return;
    this.lastCheckTime = now;

    const slot = this.slotPendente();
    if (!slot) return;
    const todayYmd = this.getTodayYmd();

    if (isDjenTermosParalelaRunning()) {
      this.showToast('DJEN Termos Paralela já está em execução', 'info');
      return;
    }

    try {
      // Considera apenas execuções iniciadas a partir do horário alvo (BRT)
      // para que execuções manuais feitas antes do horário não bloqueiem o agendamento.
      const [sh, sm] = slot.split(':').map(Number);
      const targetUtcHour = (sh + 3) % 24;
      const dayOffset = sh + 3 >= 24 ? 1 : 0;
      const targetDate = new Date(`${todayYmd}T00:00:00.000Z`);
      targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);
      targetDate.setUTCHours(targetUtcHour, sm, 0, 0);
      const targetStartIso = targetDate.toISOString();
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('id, status, detalhes, iniciado_em')
        .eq('tipo', 'djen_paralela')
        .gte('created_at', targetStartIso)
        .in('status', ['executando', 'concluido'])
        .limit(1);

      if (error) {
        console.error('[Paralela Scheduler] Erro ao verificar execução:', error);
        return;
      }

      if (data && data.length > 0) {
        const exec = data[0] as any;
        const heartbeatMs = exec?.detalhes?.heartbeat_at ? new Date(exec.detalhes.heartbeat_at).getTime() : 0;
        const iniciadoMs = exec?.iniciado_em ? new Date(exec.iniciado_em).getTime() : 0;
        const staleRunning = exec.status === 'executando' && (
          heartbeatMs > 0
            ? Date.now() - heartbeatMs > 15 * 60 * 1000
            : iniciadoMs > 0 && Date.now() - iniciadoMs > 20 * 60 * 1000
        );
        if (staleRunning) {
          const detalhes = exec.detalhes && typeof exec.detalhes === 'object' && !Array.isArray(exec.detalhes)
            ? exec.detalhes
            : {};
          await supabase
            .from('execucoes_agendadas')
            .update({
              status: 'erro',
              finalizado_em: new Date().toISOString(),
              detalhes: { ...detalhes, mensagem: 'Erro: execução órfã sem heartbeat recente' },
            })
            .eq('id', exec.id);
        } else {
          if (exec.status === 'executando') {
            this.showToast('DJEN Termos Paralela já está em execução no banco', 'info');
          } else {
            this.marcarSlotRodado(todayYmd, slot);
            this.notifySubscribers();
          }
          return;
        }
      }
    } catch (err) {
      console.error('[Paralela Scheduler] Erro ao verificar execução no banco:', err);
      return;
    }

    // Marcar antes de iniciar para evitar re-execuções
    this.marcarSlotRodado(todayYmd, slot);
    this.notifySubscribers();

    try {
      this.showToast(`Iniciando DJEN Termos Paralela agendado (${slot})...`, 'info');
      executarDjenTermosParalela(todayYmd, todayYmd, false);

      if (this.dbConfigId) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({ ultima_execucao: new Date().toISOString() })
          .eq('id', this.dbConfigId);
      }

      this.showToast('DJEN Termos Paralela iniciado com sucesso', 'success');
      this.notifySubscribers();
    } catch (err) {
      console.error('[Paralela Scheduler] Erro ao executar:', err);
      this.showToast('Erro ao executar DJEN Termos Paralela', 'error');
    }
  }

  private showToast(msg: string, type: 'info' | 'success' | 'error') {
    const now = Date.now();
    if (now - this.lastToastTime < this.TOAST_COOLDOWN_MS) return;
    this.lastToastTime = now;
    if (type === 'success') toast.success(msg);
    else if (type === 'error') toast.error(msg);
    else toast.info(msg);
  }

  private notifySubscribers() {
    const status = this.getStatus();
    subscribersSet.forEach((cb) => {
      try { cb(status); } catch (err) { console.error(err); }
    });
  }

  private startInternal() {
    if (this.isRunning) return;
    this.isRunning = true;
    setTimeout(() => this.checkAndRun(), 2000);
    this.intervalId = setInterval(() => {
      this.checkAndRun();
    }, this.INTERVAL_MS);
    this.notifySubscribers();
  }

  start() {
    this.startInternal();
    this.saveToDb();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.saveToDb();
    this.notifySubscribers();
  }

  getStatus(): DjenTermosParalelaSchedulerStatus {
    let proximoHorario: string | null = null;
    if (this.isRunning && this.horarios.length > 0) {
      const ymd = this.getTodayYmd();
      const { hour, minute } = this.getBrtHourMinute();
      const nowMinutes = hour * 60 + minute;
      // Próximo slot hoje que ainda não rodou e cuja janela não passou
      let restantes = this.horarios
        .filter((slot) => {
          if (this.slotJaRodou(ymd, slot)) return false;
          const [h, m] = slot.split(':').map(Number);
          const target = h * 60 + m;
          return nowMinutes <= target + this.TARGET_WINDOW_MINUTES;
        })
        .sort();
      const diaOk = this.diasSemana.includes(this.getDayOfWeekBrt());
      if (diaOk && this.slotPendente()) {
        proximoHorario = 'Em breve (aguardando)';
      } else if (diaOk && restantes.length > 0) {
        proximoHorario = `Hoje às ${restantes[0]}`;
      } else {
        proximoHorario = `Amanhã às ${this.horarios[0]}`;
      }
    }

    return {
      ativo: this.isRunning,
      proximoHorario,
      ultimaExecucao: null,
      horarios: [...this.horarios],
      diasSemana: [...this.diasSemana],
    };
  }

  setHorarios(horarios: string[]) {
    const norm = normalizarHorarios(horarios);
    this.horarios = norm.length > 0 ? norm : ['05:00'];
    this.saveToDb();
    this.notifySubscribers();
  }

  setDiasSemana(dias: number[]) {
    const ok = Array.from(new Set(dias.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort();
    this.diasSemana = ok.length > 0 ? ok : [...DEFAULT_DIAS_SEMANA];
    this.saveToDb();
    this.notifySubscribers();
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

function getScheduler(): DjenTermosParalelaScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DjenTermosParalelaScheduler();
  }
  return schedulerInstance;
}

export function useDjenTermosParalelaScheduler() {
  const [status, setStatus] = useState<DjenTermosParalelaSchedulerStatus>(() => {
    return getScheduler().getStatus();
  });

  useEffect(() => {
    const unsub = subscribeDjenTermosParalelaScheduler(setStatus);
    return unsub;
  }, []);

  return {
    ...status,
    start: () => getScheduler().start(),
    stop: () => getScheduler().stop(),
    setHorarios: (h: string[]) => getScheduler().setHorarios(h),
    setDiasSemana: (d: number[]) => getScheduler().setDiasSemana(d),
  };
}

export function startDjenTermosParalelaScheduler() {
  getScheduler().start();
}

export function stopDjenTermosParalelaScheduler() {
  getScheduler().stop();
}

export function getDjenTermosParalelaSchedulerStatus(): DjenTermosParalelaSchedulerStatus {
  return getScheduler().getStatus();
}

export function subscribeDjenTermosParalelaScheduler(
  listener: (status: DjenTermosParalelaSchedulerStatus) => void,
): () => void {
  subscribersSet.add(listener);
  return () => { subscribersSet.delete(listener); };
}