/**
 * DJEN Termos Scheduler
 * 
 * Agendador que:
 * - Dispara DJEN Termos automaticamente todos os dias
 * - Se o browser abrir após o horário alvo (05:30 BRT), executa assim que possível
 * - Usa data do dia como início e fim da busca
 * - Salva estado no localStorage para persistência
 * - Usa singleton para garantir apenas uma instância
 */

import { useEffect, useState } from 'react';
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
    const parts = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-');
    return parts.join('-');
  }

  private getBrtHourMinute(): { hour: number; minute: number } {
    const str = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour12: false });
    const timePart = str.split(', ')[1];
    const [h, m] = timePart.split(':').map(Number);
    return { hour: h === 24 ? 0 : h, minute: m };
  }

  /**
   * Verifica se deve executar:
   * - Já passou das 05:30 BRT hoje E ainda não executou hoje
   * - Isso permite que se o browser abrir às 08:00, execute imediatamente
   */
  private shouldRunToday(): boolean {
    const { hour, minute } = this.getBrtHourMinute();
    console.log(`[Termos Scheduler] BRT time check: ${hour}:${String(minute).padStart(2,'0')} | target: ${this.TARGET_HOUR}:${String(this.TARGET_MINUTE).padStart(2,'0')}`);
    return hour > this.TARGET_HOUR ||
      (hour === this.TARGET_HOUR && minute >= this.TARGET_MINUTE);
  }

  private async checkAndRun() {
    // Evita múltiplos checks dentro do mesmo período
    const now = Date.now();
    if (now - this.lastCheckTime < 10000) return;
    this.lastCheckTime = now;

    // Se não passou do horário alvo, skip
    if (!this.shouldRunToday()) return;

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

    // Tudo ok, dispara execução com data de HOJE como início e fim
    try {
      this.showToast('Iniciando DJEN Termos agendado...', 'info');
      
      // Usa a data de hoje como início e fim
      await executarDjenTermos(todayYmd, todayYmd);
      
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

    // Faz check imediato (caso já tenha passado do horário)
    setTimeout(() => this.checkAndRun(), 2000);

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
      const todayYmd = this.getTodayYmd();
      
      if (this.lastRunDate === todayYmd) {
        // Já executou hoje, próximo é amanhã às 05:30
        proximoHorario = 'Amanhã às 05:30';
      } else if (this.shouldRunToday()) {
        // Passou do horário e não executou - vai executar em breve
        proximoHorario = 'Em breve (aguardando)';
      } else {
        proximoHorario = 'Hoje às 05:30';
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
