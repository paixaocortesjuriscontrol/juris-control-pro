/**
 * DJEN Termos Scheduler
 * 
 * Agendador simples que:
 * - Dispara DJEN Termos automaticamente às 05:30 BRT todos os dias
 * - Verifica se há execução em andamento antes de disparar
 * - Salva estado no localStorage para persistência
 * - Usa singleton para garantir apenas uma instância
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { executarDjenTermos, isDjenTermosRunning } from './useDjenTermosEngine';

export interface DjenTermosSchedulerStatus {
  ativo: boolean;
  proximoHorario: string | null;
  ultimaExecucao: string | null;
}

// Singleton state
let schedulerInstance: DjenTermosScheduler | null = null;
let subscribersSet: Set<(status: DjenTermosSchedulerStatus) => void> = new Set();

class DjenTermosScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunDate: string | null = null; // YYYY-MM-DD
  private lastCheckTime = 0;
  private lastToastTime = 0;

  private readonly INTERVAL_MS = 30000; // 30 segundos
  private readonly TARGET_HOUR = 5; // 05:00 (BRT)
  private readonly TARGET_MINUTE = 30; // 30 minutos
  private readonly TIME_MARGIN = 2; // ±2 minutos de margem
  private readonly TOAST_COOLDOWN_MS = 60000; // 1 minuto entre toasts

  constructor() {
    this.loadLastRunDate();
  }

  private loadLastRunDate() {
    const key = `djen-scheduler-last-run-${this.getTodayYmd()}`;
    const stored = localStorage.getItem(key);
    this.lastRunDate = stored ? this.getTodayYmd() : null;
  }

  private getTodayYmd(): string {
    const now = this.getBrtNow();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getBrtNow(): Date {
    // Converte UTC para BRT (UTC-3)
    const utcNow = new Date();
    const brtNow = new Date(utcNow.getTime() - 3 * 60 * 60 * 1000);
    return brtNow;
  }

  private isTimeToRun(): boolean {
    const now = this.getBrtNow();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // 05:30 ±2 minutos = 05:28 a 05:32
    const isInWindow = hour === this.TARGET_HOUR && 
      minute >= (this.TARGET_MINUTE - this.TIME_MARGIN) &&
      minute <= (this.TARGET_MINUTE + this.TIME_MARGIN);

    return isInWindow;
  }

  private async checkAndRun() {
    // Evita múltiplos checks dentro do mesmo minuto
    const now = Date.now();
    if (now - this.lastCheckTime < 10000) return;
    this.lastCheckTime = now;

    // Se não é a hora, skip
    if (!this.isTimeToRun()) return;

    // Se já executou hoje, skip
    const todayYmd = this.getTodayYmd();
    if (this.lastRunDate === todayYmd) return;

    // Verifica se há execução em andamento (local)
    if (isDjenTermosRunning()) {
      this.showToast('DJEN Termos já está em execução', 'info');
      return;
    }

    // Verifica se há execução em andamento no banco
    try {
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('id')
        .eq('tipo', 'djen')
        .eq('status', 'executando')
        .is('finalizado_em', null)
        .limit(1);

      if (error) {
        console.error('Erro ao verificar execução:', error);
        return;
      }

      if (data && data.length > 0) {
        this.showToast('DJEN Termos já está em execução no banco', 'info');
        return;
      }
    } catch (err) {
      console.error('Erro ao verificar execução no banco:', err);
      return;
    }

    // Tudo ok, dispara execução
    try {
      this.showToast('Iniciando DJEN Termos agendado...', 'info');
      await executarDjenTermos();
      
      // Marca como executado hoje
      this.lastRunDate = todayYmd;
      const key = `djen-scheduler-last-run-${todayYmd}`;
      localStorage.setItem(key, String(Date.now()));

      this.showToast('DJEN Termos iniciado com sucesso', 'success');
      this.notifySubscribers();
    } catch (err) {
      console.error('Erro ao executar DJEN Termos:', err);
      this.showToast('Erro ao executar DJEN Termos', 'error');
    }
  }

  private showToast(msg: string, type: 'info' | 'success' | 'error') {
    const now = Date.now();
    if (now - this.lastToastTime < this.TOAST_COOLDOWN_MS) return;
    this.lastToastTime = now;

    if (type === 'success') {
      toast.success(msg);
    } else if (type === 'error') {
      toast.error(msg);
    } else {
      toast.info(msg);
    }
  }

  private notifySubscribers() {
    const status = this.getStatus();
    subscribersSet.forEach(cb => {
      try {
        cb(status);
      } catch (err) {
        console.error('Erro ao notificar subscriber:', err);
      }
    });
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.loadLastRunDate();

    // Salva que está ativo
    localStorage.setItem('djen-termos-scheduler-enabled', 'true');

    // Inicia intervalo
    this.intervalId = setInterval(() => {
      this.checkAndRun();
    }, this.INTERVAL_MS);

    this.notifySubscribers();
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Salva que está inativo
    localStorage.setItem('djen-termos-scheduler-enabled', 'false');

    // Para intervalo
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.notifySubscribers();
  }

  getStatus(): DjenTermosSchedulerStatus {
    let proximoHorario: string | null = null;

    if (this.isRunning) {
      const now = this.getBrtNow();
      let proxima = new Date(now);

      // Se já passou o horário de hoje, próximo é amanhã
      if (now.getHours() > this.TARGET_HOUR ||
          (now.getHours() === this.TARGET_HOUR && now.getMinutes() > this.TARGET_MINUTE)) {
        proxima.setDate(proxima.getDate() + 1);
      }

      proxima.setHours(this.TARGET_HOUR, this.TARGET_MINUTE, 0, 0);
      proximoHorario = proxima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

/**
 * Inicializa ou retorna o scheduler singleton
 */
function getScheduler(): DjenTermosScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DjenTermosScheduler();
  }
  return schedulerInstance;
}

/**
 * Hook React para usar o scheduler
 */
export function useDjenTermosScheduler() {
  const [status, setStatus] = useState<DjenTermosSchedulerStatus>(() => {
    return getScheduler().getStatus();
  });

  useEffect(() => {
    const scheduler = getScheduler();
    const unsub = subscribeDjenTermosScheduler(setStatus);
    return unsub;
  }, []);

  return {
    ...status,
    start: () => {
      getScheduler().start();
    },
    stop: () => {
      getScheduler().stop();
    },
  };
}

/**
 * Inicia o scheduler
 */
export function startDjenTermosScheduler() {
  getScheduler().start();
}

/**
 * Para o scheduler
 */
export function stopDjenTermosScheduler() {
  getScheduler().stop();
}

/**
 * Retorna status atual
 */
export function getDjenTermosSchedulerStatus(): DjenTermosSchedulerStatus {
  return getScheduler().getStatus();
}

/**
 * Se inscreve para atualizações do scheduler
 */
export function subscribeDjenTermosScheduler(
  listener: (status: DjenTermosSchedulerStatus) => void
): () => void {
  subscribersSet.add(listener);
  return () => {
    subscribersSet.delete(listener);
  };
}
