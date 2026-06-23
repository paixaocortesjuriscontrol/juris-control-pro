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
  /** Horários do dia atual em BRT (vazio se hoje estiver desativado). */
  horario: string;
  /** Matriz 7 × até 3 horários (0=domingo..6=sábado). Array vazio = dia desativado. */
  horariosPorDia: string[][];
}

let schedulerInstance: DjetPautasScheduler | null = null;
const subs = new Set<(s: DjetPautasSchedulerStatus) => void>();

class DjetPautasScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastRunDate: string | null = null;
  private dbConfigId: string | null = null;
  /** Index 0=domingo .. 6=sábado. Cada dia: até 3 horários "HH:MM". */
  private horariosPorDia: string[][] = [
    [], ["06:00"], ["06:00"], ["06:00"], ["06:00"], ["06:00"], [],
  ];
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
        .select("id, ativo, horarios_execucao, metadata")
        .eq("tipo", "djet_pautas")
        .limit(1)
        .maybeSingle();
      if (data) {
        this.dbConfigId = data.id;
        const meta = (data.metadata as Record<string, unknown> | null) || {};
        const matriz = meta.horarios_por_dia as unknown;
        if (Array.isArray(matriz) && matriz.length === 7) {
          this.horariosPorDia = matriz.map((linha) =>
            Array.isArray(linha)
              ? sanitizarHorarios(linha.map((x) => String(x ?? "")))
              : [],
          );
        } else {
          // Legado: horarios_execucao podia ser array plano de 7 strings (1/dia) ou só um.
          const arr = (data.horarios_execucao as (string | null)[] | null) ?? [];
          if (arr.length === 7) {
            this.horariosPorDia = arr.map((v) => sanitizarHorarios([v || ""]));
          } else if (arr.length >= 1 && arr[0]) {
            const h = String(arr[0]);
            this.horariosPorDia = [[], [h], [h], [h], [h], [h], []];
          }
        }
        if (data.ativo && !this.isRunning) this.startInternal();
      }
    } catch (e) { console.error("[DJET Pautas Scheduler] loadFromDb", e); }
    this.notify();
  }

  private async saveToDb() {
    try {
      const matriz = this.horariosPorDia;
      // Flat: união dos horários ativos para compat com queries que olham só horarios_execucao.
      const flat = Array.from(new Set(matriz.flat().filter(Boolean))).sort();
      if (this.dbConfigId) {
        await supabase
          .from("configuracoes_monitoramento")
          .update({
            ativo: this.isRunning,
            horarios_execucao: flat,
            metadata: { horarios_por_dia: matriz },
            updated_at: new Date().toISOString(),
          })
          .eq("id", this.dbConfigId);
      } else {
        const { data } = await supabase
          .from("configuracoes_monitoramento")
          .insert({
            tipo: "djet_pautas",
            ativo: this.isRunning,
            horarios_execucao: flat,
            metadata: { horarios_por_dia: matriz },
            frequencia: "diario",
          } as any)
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
    // Considera "executado hoje" se já houve disparo para qualquer slot do dia.
    const today = this.getTodayYmd();
    const prefix = `djet-pautas-scheduler-slot-${today}`;
    const tem = Object.keys(localStorage).some((k) => k.startsWith(prefix));
    this.lastRunDate = tem ? today : null;
  }

  private slotKey(ymd: string, horario: string) {
    return `djet-pautas-scheduler-slot-${ymd}-${horario}`;
  }

  private slotJaExecutado(ymd: string, horario: string): boolean {
    return localStorage.getItem(this.slotKey(ymd, horario)) !== null;
  }

  private marcarSlotExecutado(ymd: string, horario: string) {
    localStorage.setItem(this.slotKey(ymd, horario), String(Date.now()));
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

  /** Horários ativos do dia atual (até 3). */
  private getHorariosHoje(): string[] {
    const v = this.horariosPorDia[this.getBrtWeekday()];
    return Array.isArray(v) ? v.filter((x) => x && x.trim() !== "") : [];
  }

  /** Retorna o slot "HH:MM" pendente para disparar agora, ou null. */
  private slotPendente(): string | null {
    const horarios = this.getHorariosHoje();
    if (horarios.length === 0) return null;
    const { hour, minute } = this.getBrtHm();
    const now = hour * 60 + minute;
    const today = this.getTodayYmd();
    for (const h of horarios) {
      const [hh, mm] = h.split(":").map(Number);
      if (isNaN(hh) || isNaN(mm)) continue;
      const tgt = hh * 60 + mm;
      if (now >= tgt && now <= tgt + this.WINDOW_MIN && !this.slotJaExecutado(today, h)) {
        return h;
      }
    }
    return null;
  }

  private async checkAndRun() {
    const slot = this.slotPendente();
    if (!slot) return;
    if (isDjetPautasParalelaRunning()) return;
    const today = this.getTodayYmd();

    this.marcarSlotExecutado(today, slot);
    this.lastRunDate = today;
    this.notify();
    try {
      toast.info(`Iniciando DJET Pautas Paralela agendado (${slot})...`);
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
   * Define os horários (até 3) para um dia da semana (0=dom..6=sáb).
   * Passe array vazio para desativar o dia.
   */
  setHorariosDia(weekday: number, horarios: string[]) {
    if (weekday < 0 || weekday > 6) return;
    const copia = this.horariosPorDia.map((l) => [...l]);
    copia[weekday] = sanitizarHorarios(horarios);
    this.horariosPorDia = copia;
    void this.saveToDb();
    this.notify();
  }

  getStatus(): DjetPautasSchedulerStatus {
    const horariosHoje = this.getHorariosHoje();
    const horarioHoje = horariosHoje.join(", ");
    let proximoHorario: string | null = null;
    if (this.isRunning) {
      proximoHorario = this.slotPendente() ? "Em breve (aguardando)" : this.computeProximaExecucao();
    }
    return {
      ativo: this.isRunning,
      proximoHorario,
      ultimaExecucao: this.lastRunDate,
      horario: horarioHoje,
      horariosPorDia: this.horariosPorDia.map((l) => [...l]),
    };
  }

  /** Calcula a string "Hoje/Amanhã/<dia> às HH:MM" do próximo horário ativo. */
  private computeProximaExecucao(): string | null {
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const wdHoje = this.getBrtWeekday();
    const today = this.getTodayYmd();
    const horariosHoje = this.getHorariosHoje();
    const { hour, minute } = this.getBrtHm();
    const nowMin = hour * 60 + minute;
    // Próximo slot ainda não executado hoje
    for (const h of horariosHoje) {
      if (this.slotJaExecutado(today, h)) continue;
      const [hh, mm] = h.split(":").map(Number);
      if (!isNaN(hh) && !isNaN(mm) && nowMin <= hh * 60 + mm + this.WINDOW_MIN) {
        return `Hoje às ${h}`;
      }
    }
    for (let i = 1; i <= 7; i++) {
      const wd = (wdHoje + i) % 7;
      const v = this.horariosPorDia[wd];
      if (Array.isArray(v) && v.length > 0) {
        const label = i === 1 ? "Amanhã" : dias[wd];
        return `${label} às ${v[0]}`;
      }
    }
    return null;
  }

  private notify() {
    const s = this.getStatus();
    subs.forEach((cb) => { try { cb(s); } catch (e) { console.error(e); } });
  }
}

function sanitizarHorarios(arr: string[]): string[] {
  const valid = arr
    .map((h) => String(h || "").trim())
    .filter((h) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(h))
    .map((h) => {
      const [hh, mm] = h.split(":");
      return `${hh.padStart(2, "0")}:${mm}`;
    });
  return Array.from(new Set(valid)).sort().slice(0, 3);
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
    setHorariosDia: (weekday: number, horarios: string[]) => getScheduler().setHorariosDia(weekday, horarios),
  };
}

export function getDjetPautasParalelaSchedulerStatus(): DjetPautasSchedulerStatus {
  return getScheduler().getStatus();
}