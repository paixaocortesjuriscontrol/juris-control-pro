/**
 * DJET Pautas Paralela Scheduler
 * Cópia simétrica do useDjenTermosParalelaScheduler, com tipo='djet_pautas'.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  executarDjetPautasParalela,
  isDjetPautasParalelaRunning,
} from "./useDjetPautasParalelaEngine";

export interface DjetPautasSchedulerStatus {
  ativo: boolean;
  proximoHorario: string | null;
  ultimaExecucao: string | null;
  horario: string;
}

let schedulerInstance: DjetPautasScheduler | null = null;
const subs = new Set<(s: DjetPautasSchedulerStatus) => void>();

class DjetPautasScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastRunDate: string | null = null;
  private dbConfigId: string | null = null;
  private targetHour = 6;
  private targetMinute = 0;
  private readonly INTERVAL_MS = 30000;
  private readonly WINDOW_MIN = 30;

  constructor() {
    this.loadLastRunDate();
    void this.loadFromDb();
  }

  private async loadFromDb() {
    try {
      const { data } = await supabase
        .from("configuracoes_monitoramento")
        .select("id, ativo, horarios_execucao")
        .eq("tipo", "djet_pautas")
        .limit(1)
        .maybeSingle();
      if (data) {
        this.dbConfigId = data.id;
        const h = (data.horarios_execucao as string[] | null)?.[0];
        if (h) {
          const [hh, mm] = h.split(":").map(Number);
          if (!isNaN(hh) && !isNaN(mm)) { this.targetHour = hh; this.targetMinute = mm; }
        }
        if (data.ativo && !this.isRunning) this.startInternal();
      }
    } catch (e) { console.error("[DJET Pautas Scheduler] loadFromDb", e); }
    this.notify();
  }

  private async saveToDb() {
    try {
      const horarioStr = `${String(this.targetHour).padStart(2, "0")}:${String(this.targetMinute).padStart(2, "0")}`;
      if (this.dbConfigId) {
        await supabase
          .from("configuracoes_monitoramento")
          .update({ ativo: this.isRunning, horarios_execucao: [horarioStr], updated_at: new Date().toISOString() })
          .eq("id", this.dbConfigId);
      } else {
        const { data } = await supabase
          .from("configuracoes_monitoramento")
          .insert({ tipo: "djet_pautas", ativo: this.isRunning, horarios_execucao: [horarioStr], frequencia: "diario" } as any)
          .select("id")
          .single();
        if (data) this.dbConfigId = (data as any).id;
      }
    } catch (e) { console.error("[DJET Pautas Scheduler] saveToDb", e); }
  }

  private getTodayYmd(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  }

  private loadLastRunDate() {
    const key = `djet-pautas-scheduler-last-run-${this.getTodayYmd()}`;
    this.lastRunDate = localStorage.getItem(key) ? this.getTodayYmd() : null;
  }

  private getBrtHm() {
    const t = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour12: false }).split(", ")[1];
    const [h, m] = t.split(":").map(Number);
    return { hour: h === 24 ? 0 : h, minute: m };
  }

  private shouldRunToday(): boolean {
    const { hour, minute } = this.getBrtHm();
    const now = hour * 60 + minute;
    const tgt = this.targetHour * 60 + this.targetMinute;
    return now >= tgt && now <= tgt + this.WINDOW_MIN;
  }

  private async checkAndRun() {
    if (!this.shouldRunToday()) return;
    const today = this.getTodayYmd();
    if (this.lastRunDate === today) return;
    if (isDjetPautasParalelaRunning()) return;

    this.lastRunDate = today;
    localStorage.setItem(`djet-pautas-scheduler-last-run-${today}`, String(Date.now()));
    this.notify();
    try {
      toast.info("Iniciando DJET Pautas Paralela agendado...");
      executarDjetPautasParalela(today, today, false);
      if (this.dbConfigId) {
        await supabase.from("configuracoes_monitoramento")
          .update({ ultima_execucao: new Date().toISOString() })
          .eq("id", this.dbConfigId);
      }
    } catch (e) {
      console.error("[DJET Pautas Scheduler] checkAndRun", e);
    }
  }

  private startInternal() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loadLastRunDate();
    setTimeout(() => this.checkAndRun(), 2000);
    this.intervalId = setInterval(() => this.checkAndRun(), this.INTERVAL_MS);
    this.notify();
  }

  start() { this.startInternal(); void this.saveToDb(); }
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    void this.saveToDb();
    this.notify();
  }

  setTime(h: number, m: number) {
    this.targetHour = h; this.targetMinute = m;
    void this.saveToDb();
    this.notify();
  }

  getStatus(): DjetPautasSchedulerStatus {
    const timeStr = `${String(this.targetHour).padStart(2, "0")}:${String(this.targetMinute).padStart(2, "0")}`;
    let proximoHorario: string | null = null;
    if (this.isRunning) {
      const today = this.getTodayYmd();
      if (this.lastRunDate === today) proximoHorario = `Amanhã às ${timeStr}`;
      else if (this.shouldRunToday()) proximoHorario = "Em breve (aguardando)";
      else proximoHorario = `Hoje às ${timeStr}`;
    }
    return { ativo: this.isRunning, proximoHorario, ultimaExecucao: this.lastRunDate, horario: timeStr };
  }

  private notify() {
    const s = this.getStatus();
    subs.forEach((cb) => { try { cb(s); } catch (e) { console.error(e); } });
  }
}

function getScheduler(): DjetPautasScheduler {
  if (!schedulerInstance) schedulerInstance = new DjetPautasScheduler();
  return schedulerInstance;
}

export function useDjetPautasParalelaScheduler() {
  const [status, setStatus] = useState<DjetPautasSchedulerStatus>(() => getScheduler().getStatus());
  useEffect(() => {
    subs.add(setStatus);
    return () => { subs.delete(setStatus); };
  }, []);
  return {
    ...status,
    start: () => getScheduler().start(),
    stop: () => getScheduler().stop(),
    setTime: (h: number, m: number) => getScheduler().setTime(h, m),
  };
}