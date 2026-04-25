/**
 * DJEN Termos Pro Scheduler
 * 
 * Persiste horário e status ativo na tabela configuracoes_monitoramento (tipo='djen_pro').
 * Dispara automaticamente após o horário alvo (BRT).
 * Se o browser abrir depois, executa assim que possível.
 * Usa data do dia como início e fim.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { executarDjenTermosPro, isDjenTermosProRunning } from './useDjenTermosProEngine';

export interface DjenTermosProSchedulerStatus {
  ativo: boolean;
  proximoHorario: string | null;
  ultimaExecucao: string | null;
  horario: string;
}

let schedulerInstance: DjenTermosProScheduler | null = null;
let subscribersSet: Set<(status: DjenTermosProSchedulerStatus) => void> = new Set();

class DjenTermosProScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunDate: string | null = null;
  private lastCheckTime = 0;
  private lastToastTime = 0;
  private dbConfigId: string | null = null;
  private dbLoaded = false;
  private dbLoadPromise: Promise<void>;

  private readonly INTERVAL_MS = 30000;
  private targetHour = 20;
  private targetMinute = 45;
  private readonly TOAST_COOLDOWN_MS = 60000;

  constructor() {
    this.loadLastRunDate();
    // Load from DB asynchronously, keep promise for awaiting
    this.dbLoadPromise = this.loadFromDb();
  }

  /** Load config from configuracoes_monitoramento */
  private async loadFromDb() {
    try {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, ativo, horarios_execucao, metadata')
        .eq('tipo', 'djen_pro')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Pro Scheduler] Erro ao carregar config do DB:', error);
        return;
      }

      if (data) {
        this.dbConfigId = data.id;
        const horarios = data.horarios_execucao as string[] | null;
        if (horarios && horarios.length > 0) {
          const [h, m] = horarios[0].split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            this.targetHour = h;
            this.targetMinute = m;
          }
        }
        // If DB says ativo=true, auto-start
        if (data.ativo && !this.isRunning) {
          this.startInternal();
        }
      }
      this.dbLoaded = true;
      this.notifySubscribers();
    } catch (err) {
      console.error('[Pro Scheduler] Erro ao carregar config do DB:', err);
    }
  }

  /** Upsert config in DB */
  private async saveToDb() {
    // Ensure DB config is loaded first to avoid inserting duplicates
    await this.dbLoadPromise;

    try {
      const horarioStr = `${String(this.targetHour).padStart(2, '0')}:${String(this.targetMinute).padStart(2, '0')}`;

      if (this.dbConfigId) {
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .update({
            ativo: this.isRunning,
            horarios_execucao: [horarioStr],
            updated_at: new Date().toISOString(),
          })
          .eq('id', this.dbConfigId);

        if (error) {
          console.error('[Pro Scheduler] Erro ao atualizar config no DB:', error);
        } else {
          console.log('[Pro Scheduler] Config salva no DB: ativo=', this.isRunning, 'horario=', horarioStr);
        }
      } else {
        const { data, error } = await supabase
          .from('configuracoes_monitoramento')
          .insert({
            tipo: 'djen_pro',
            ativo: this.isRunning,
            horarios_execucao: [horarioStr],
            frequencia: 'diario',
          })
          .select('id')
          .single();

        if (error) {
          console.error('[Pro Scheduler] Erro ao inserir config no DB:', error);
        } else if (data) {
          this.dbConfigId = data.id;
          console.log('[Pro Scheduler] Config criada no DB: id=', data.id, 'ativo=', this.isRunning);
        }
      }
    } catch (err) {
      console.error('[Pro Scheduler] Erro ao salvar config no DB:', err);
    }
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
    const timePart = str.split(', ')[1];
    const [h, m] = timePart.split(':').map(Number);
    return { hour: h === 24 ? 0 : h, minute: m };
  }

  private shouldRunToday(): boolean {
    const { hour, minute } = this.getBrtHourMinute();
    console.log(`[Pro Scheduler] BRT time check: ${hour}:${String(minute).padStart(2,'0')} | target: ${this.targetHour}:${String(this.targetMinute).padStart(2,'0')}`);
    return hour > this.targetHour ||
      (hour === this.targetHour && minute >= this.targetMinute);
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
      // Check for running OR already-completed execution today
      // Considera apenas execuções iniciadas a partir do horário alvo (BRT)
      // para que execuções manuais feitas antes do horário não bloqueiem o agendamento.
      const targetUtcHour = (this.targetHour + 3) % 24;
      const dayOffset = this.targetHour + 3 >= 24 ? 1 : 0;
      const targetDate = new Date(`${todayYmd}T00:00:00.000Z`);
      targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);
      targetDate.setUTCHours(targetUtcHour, this.targetMinute, 0, 0);
      const targetStartIso = targetDate.toISOString();
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('id, status')
        .eq('tipo', 'djen_pro')
        .gte('created_at', targetStartIso)
        .in('status', ['executando', 'concluido'])
        .limit(1);

      if (error) {
        console.error('[Pro Scheduler] Erro ao verificar execução:', error);
        return;
      }

      if (data && data.length > 0) {
        const exec = data[0];
        if (exec.status === 'executando') {
          this.showToast('DJEN Termos Pro já está em execução no banco', 'info');
        } else {
          // Already completed today — mark locally so we don't check again
          console.log('[Pro Scheduler] Já executou com sucesso hoje, pulando.');
          this.lastRunDate = todayYmd;
          const key = `djen-pro-scheduler-last-run-${todayYmd}`;
          localStorage.setItem(key, String(Date.now()));
          this.notifySubscribers();
        }
        return;
      }
    } catch (err) {
      console.error('[Pro Scheduler] Erro ao verificar execução no banco:', err);
      return;
    }

    // Marcar como executado ANTES de iniciar para evitar re-execuções mesmo se o DB falhar
    this.lastRunDate = todayYmd;
    const key = `djen-pro-scheduler-last-run-${todayYmd}`;
    localStorage.setItem(key, String(Date.now()));
    this.notifySubscribers();

    try {
      this.showToast('Iniciando DJEN Termos Pro agendado...', 'info');
      await executarDjenTermosPro(todayYmd, todayYmd);

      // Update ultima_execucao in DB
      if (this.dbConfigId) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({ ultima_execucao: new Date().toISOString() })
          .eq('id', this.dbConfigId);
      }

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

  private startInternal() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loadLastRunDate();

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

  getStatus(): DjenTermosProSchedulerStatus {
    let proximoHorario: string | null = null;
    const timeStr = `${String(this.targetHour).padStart(2,'0')}:${String(this.targetMinute).padStart(2,'0')}`;

    if (this.isRunning) {
      const todayYmd = this.getTodayYmd();
      if (this.lastRunDate === todayYmd) {
        proximoHorario = `Amanhã às ${timeStr}`;
      } else if (this.shouldRunToday()) {
        proximoHorario = 'Em breve (aguardando)';
      } else {
        proximoHorario = `Hoje às ${timeStr}`;
      }
    }

    return {
      ativo: this.isRunning,
      proximoHorario,
      ultimaExecucao: this.lastRunDate,
      horario: timeStr,
    };
  }

  setTime(hour: number, minute: number) {
    this.targetHour = hour;
    this.targetMinute = minute;
    this.saveToDb();
    this.notifySubscribers();
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
    setTime: (h: number, m: number) => getScheduler().setTime(h, m),
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
