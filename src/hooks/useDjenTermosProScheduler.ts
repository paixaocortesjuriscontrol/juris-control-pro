/**
 * DJEN Termos Pro Scheduler
 * 
 * Mesmo padrão do scheduler de Termos:
 * - Dispara automaticamente após o horário alvo (20:35 BRT)
 * - Se o browser abrir depois, executa assim que possível
 * - Usa data do dia como início e fim
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { executarDjenTermosPro, isDjenTermosProRunning } from './useDjenTermosProEngine';

export interface DjenTermosProSchedulerStatus {
  ativo: boolean;
  proximoHorario: string | null;
  ultimaExecucao: string | null;
}

let schedulerInstance: DjenTermosProScheduler | null = null;
let subscribersSet: Set<(status: DjenTermosProSchedulerStatus) => void> = new Set();

class DjenTermosProScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunDate: string | null = null;
  private lastCheckTime = 0;
  private lastToastTime = 0;

  private readonly INTERVAL_MS = 30000;
  private readonly TARGET_HOUR = 20;
  private readonly TARGET_MINUTE = 35;
  private readonly TOAST_COOLDOWN_MS = 60000;
  private readonly STORAGE_KEY = 'djen-termos-pro-scheduler-enabled';

  constructor() {
    this.loadLastRunDate();
  }

  private loadLastRunDate() {
    const key = `djen-pro-scheduler-last-run-${this.getTodayYmd()}`;
    const stored = localStorage.getItem(key);
    this.lastRunDate = stored ? this.getTodayYmd() : null;
  }

  private getTodayYmd(): string {
    const parts = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-');
    return parts.join('-');
  }

  private getBrtHourMinute(): { hour: number; minute: number } {
    const str = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour12: false });
    // str format: "MM/DD/YYYY, HH:MM:SS"
    const timePart = str.split(', ')[1];
    const [h, m] = timePart.split(':').map(Number);
    return { hour: h === 24 ? 0 : h, minute: m };
  }

  private shouldRunToday(): boolean {
    const { hour, minute } = this.getBrtHourMinute();
    console.log(`[Pro Scheduler] BRT time check: ${hour}:${String(minute).padStart(2,'0')} | target: ${this.TARGET_HOUR}:${String(this.TARGET_MINUTE).padStart(2,'0')}`);
    return hour > this.TARGET_HOUR ||
      (hour === this.TARGET_HOUR && minute >= this.TARGET_MINUTE);
  }

  private async checkAndRun() {
    const now = Date.now();
    if (now - this.lastCheckTime < 10000) return;
    this.lastCheckTime = now;

    if (!this.shouldRunToday()) return;

    const todayYmd = this.getTodayYmd();
    if (this.lastRunDate === todayYmd) return;

    if (isDjenTermosProRunning()) {
      this.showToast('DJEN Termos Pro já está em execução', 'info');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('id')
        .eq('tipo', 'djen_pro')
        .eq('status', 'executando')
        .is('finalizado_em', null)
        .limit(1);

      if (error) {
        console.error('[Pro Scheduler] Erro ao verificar execução:', error);
        return;
      }

      if (data && data.length > 0) {
        this.showToast('DJEN Termos Pro já está em execução no banco', 'info');
        return;
      }
    } catch (err) {
      console.error('[Pro Scheduler] Erro ao verificar execução no banco:', err);
      return;
    }

    try {
      this.showToast('Iniciando DJEN Termos Pro agendado...', 'info');
      await executarDjenTermosPro(todayYmd, todayYmd);

      this.lastRunDate = todayYmd;
      const key = `djen-pro-scheduler-last-run-${todayYmd}`;
      localStorage.setItem(key, String(Date.now()));

      this.showToast('DJEN Termos Pro iniciado com sucesso', 'success');
      this.notifySubscribers();
    } catch (err) {
      console.error('[Pro Scheduler] Erro ao executar:', err);
      this.showToast('Erro ao executar DJEN Termos Pro', 'error');
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
    subscribersSet.forEach(cb => {
      try { cb(status); } catch (err) { console.error(err); }
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loadLastRunDate();
    localStorage.setItem(this.STORAGE_KEY, 'true');

    setTimeout(() => this.checkAndRun(), 2000);

    this.intervalId = setInterval(() => {
      this.checkAndRun();
    }, this.INTERVAL_MS);

    this.notifySubscribers();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    localStorage.setItem(this.STORAGE_KEY, 'false');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.notifySubscribers();
  }

  getStatus(): DjenTermosProSchedulerStatus {
    let proximoHorario: string | null = null;

    if (this.isRunning) {
      const todayYmd = this.getTodayYmd();
      if (this.lastRunDate === todayYmd) {
        proximoHorario = 'Amanhã às 20:35';
      } else if (this.shouldRunToday()) {
        proximoHorario = 'Em breve (aguardando)';
      } else {
        proximoHorario = 'Hoje às 20:35';
      }
    }

    return {
      ativo: this.isRunning,
      proximoHorario,
      ultimaExecucao: this.lastRunDate,
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

function getScheduler(): DjenTermosProScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DjenTermosProScheduler();
  }
  return schedulerInstance;
}

export function useDjenTermosProScheduler() {
  const [status, setStatus] = useState<DjenTermosProSchedulerStatus>(() => {
    return getScheduler().getStatus();
  });

  useEffect(() => {
    const unsub = subscribeDjenTermosProScheduler(setStatus);
    return unsub;
  }, []);

  return {
    ...status,
    start: () => getScheduler().start(),
    stop: () => getScheduler().stop(),
  };
}

export function startDjenTermosProScheduler() {
  getScheduler().start();
}

export function stopDjenTermosProScheduler() {
  getScheduler().stop();
}

export function getDjenTermosProSchedulerStatus(): DjenTermosProSchedulerStatus {
  return getScheduler().getStatus();
}

export function subscribeDjenTermosProScheduler(
  listener: (status: DjenTermosProSchedulerStatus) => void
): () => void {
  subscribersSet.add(listener);
  return () => { subscribersSet.delete(listener); };
}
