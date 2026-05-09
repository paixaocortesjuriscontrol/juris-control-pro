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
  /** Horário do dia atual em BRT (vazio se hoje estiver desativado). */
  horario: string;
  /** Array de 7 horários (0=domingo..6=sábado). String vazia = dia desativado. */
  horariosPorDia: string[];
}

let schedulerInstance: DjetPautasScheduler | null = null;
const subs = new Set<(s: DjetPautasSchedulerStatus) => void>();

class DjetPautasScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastRunDate: string | null = null;
  private dbConfigId: string | null = null;
  /** Index 0=domingo .. 6=sábado. "" = desativado naquele dia. */
  private horariosPorDia: string[] = ["", "06:00", "06:00", "06:00", "06:00", "06:00", ""];
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
        const arr = (data.horarios_execucao as (string | null)[] | null) ?? [];
        if (arr.length === 7) {
          this.horariosPorDia = arr.map((v) => (v ?? "").trim());
        } else if (arr.length >= 1 && arr[0]) {
          // Legado: 1 horário aplicado em seg-sex; sáb/dom desativados.
          const h = String(arr[0]);
          this.horariosPorDia = ["", h, h, h, h, h, ""];
        }
        if (data.ativo && !this.isRunning) this.startInternal();
      }
    } catch (e) { console.error("[DJET Pautas Scheduler] loadFromDb", e); }
    this.notify();
  }

  private async saveToDb() {
    try {
      const arr = this.horariosPorDia;
      if (this.dbConfigId) {
        await supabase
          .from("configuracoes_monitoramento")
          .update({ ativo: this.isRunning, horarios_execucao: arr, updated_at: new Date().toISOString() })
          .eq("id", this.dbConfigId);
      } else {
        const { data } = await supabase
          .from("configuracoes_monitoramento")
          .insert({ tipo: "djet_pautas", ativo: this.isRunning, horarios_execucao: arr, frequencia: "diario" } as any)
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

  private getBrtWeekday(): number {
    const ymd = this.getTodayYmd();
    const [y, mo, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
  }

  /** Retorna "HH:MM" do dia atual ou null se desativado. */
  private getHorarioHoje(): string | null {
    const v = this.horariosPorDia[this.getBrtWeekday()];
    return v && v.trim() !== "" ? v : null;
  }

  private shouldRunToday(): boolean {
    const horarioHoje = this.getHorarioHoje();
    if (!horarioHoje) return false;
    const [hh, mm] = horarioHoje.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return false;
    const { hour, minute } = this.getBrtHm();
    const now = hour * 60 + minute;
    const tgt = hh * 60 + mm;
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

  /**
   * Define o horário "HH:MM" para um dia da semana (0=dom..6=sáb).
   * Passe horario = "" para desativar o dia.
   */
  setHorarioDia(weekday: number, horario: string) {
    if (weekday < 0 || weekday > 6) return;
    const arr = [...this.horariosPorDia];
    arr[weekday] = horario.trim();
    this.horariosPorDia = arr;
    void this.saveToDb();
    this.notify();
  }

  getStatus(): DjetPautasSchedulerStatus {
    const horarioHoje = this.getHorarioHoje() || "";
    let proximoHorario: string | null = null;
    if (this.isRunning) {
      const today = this.getTodayYmd();
      const proximo = this.computeProximaExecucao();
      if (this.lastRunDate === today && horarioHoje) {
        proximoHorario = proximo;
      } else if (this.shouldRunToday()) {
        proximoHorario = "Em breve (aguardando)";
      } else {
        proximoHorario = proximo;
      }
    }
    return {
      ativo: this.isRunning,
      proximoHorario,
      ultimaExecucao: this.lastRunDate,
      horario: horarioHoje,
      horariosPorDia: [...this.horariosPorDia],
    };
  }

  /** Calcula a string "Hoje/Amanhã/<dia> às HH:MM" do próximo horário ativo. */
  private computeProximaExecucao(): string | null {
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const wdHoje = this.getBrtWeekday();
    const today = this.getTodayYmd();
    const horarioHoje = this.getHorarioHoje();
    const { hour, minute } = this.getBrtHm();
    const nowMin = hour * 60 + minute;
    if (horarioHoje && this.lastRunDate !== today) {
      const [hh, mm] = horarioHoje.split(":").map(Number);
      if (!isNaN(hh) && !isNaN(mm) && nowMin <= hh * 60 + mm + this.WINDOW_MIN) {
        return `Hoje às ${horarioHoje}`;
      }
    }
    for (let i = 1; i <= 7; i++) {
      const wd = (wdHoje + i) % 7;
      const v = this.horariosPorDia[wd];
      if (v && v.trim() !== "") {
        const label = i === 1 ? "Amanhã" : dias[wd];
        return `${label} às ${v}`;
      }
    }
    return null;
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
    setHorarioDia: (weekday: number, horario: string) => getScheduler().setHorarioDia(weekday, horario),
  };
}

export function getDjetPautasParalelaSchedulerStatus(): DjetPautasSchedulerStatus {
  return getScheduler().getStatus();
}