/**
 * Kurier Scheduler — horários fixos (igual ao DJEN Termos Paralela).
 *
 * Persiste `tipo='kurier'` em `configuracoes_monitoramento`:
 *  - `ativo`              → liga/desliga o agendamento automático
 *  - `horarios_execucao`  → até 3 horários BRT (HH:MM)
 *  - `metadata.dias_semana` → dias da semana (0=Dom..6=Sáb)
 *  - `metadata.base_url`  → endpoint do Kurier
 *
 * Dispara o engine no(s) horário(s) marcado(s), uma vez por slot/dia.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { executarDjenTermosKurier, isDjenTermosKurierRunning } from "./useDjenTermosKurierEngine";

export interface KurierSchedulerStatus {
  ativo: boolean;
  proximoHorario: string | null;
  ultimaExecucao: string | null;
  horarios: string[];
  diasSemana: number[];
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://www.kurierservicos.com.br/wsservicos";
const DEFAULT_DIAS_SEMANA = [1, 2, 3, 4, 5];
const MAX_SLOTS = 3;

let schedulerInstance: KurierScheduler | null = null;
const subscribersSet: Set<(status: KurierSchedulerStatus) => void> = new Set();

function normalizarHorarios(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const ok = arr
    .map((v) => String(v ?? "").trim())
    .filter((v) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(v))
    .map((v) => {
      const [h, m] = v.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    });
  return Array.from(new Set(ok)).sort().slice(0, MAX_SLOTS);
}

class KurierScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastCheckTime = 0;
  private lastToastTime = 0;
  private dbConfigId: string | null = null;
  private dbLoadPromise: Promise<void>;

  private readonly INTERVAL_MS = 30_000;
  private readonly TARGET_WINDOW_MINUTES = 30;
  private readonly TOAST_COOLDOWN_MS = 60_000;

  private horarios: string[] = ["05:00"];
  private diasSemana: number[] = [...DEFAULT_DIAS_SEMANA];
  private baseUrl: string = DEFAULT_BASE_URL;
  private ultimaExecucao: string | null = null;

  constructor() {
    this.dbLoadPromise = this.loadFromDb();
  }

  private async loadFromDb() {
    try {
      const { data, error } = await (supabase as any)
        .from("configuracoes_monitoramento")
        .select("id, ativo, horarios_execucao, ultima_execucao, metadata")
        .eq("tipo", "kurier")
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[Kurier Scheduler] Erro ao carregar config:", error);
        return;
      }
      if (data) {
        this.dbConfigId = data.id;
        const horarios = normalizarHorarios(data.horarios_execucao);
        if (horarios.length > 0) this.horarios = horarios;
        const meta = (data.metadata as any) || {};
        if (Array.isArray(meta.dias_semana) && meta.dias_semana.length > 0) {
          const dias = meta.dias_semana
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6);
          if (dias.length > 0) this.diasSemana = dias;
        }
        if (typeof meta.base_url === "string" && meta.base_url) this.baseUrl = meta.base_url;
        this.ultimaExecucao = data.ultima_execucao ?? null;
        if (data.ativo && !this.isRunning) this.startInternal();
      }
      this.notifySubscribers();
    } catch (err) {
      console.error("[Kurier Scheduler] Erro ao carregar config:", err);
    }
  }

  private async saveToDb() {
    await this.dbLoadPromise;
    try {
      if (this.dbConfigId) {
        const { data: existing } = await (supabase as any)
          .from("configuracoes_monitoramento")
          .select("metadata")
          .eq("id", this.dbConfigId)
          .maybeSingle();
        const meta = {
          ...((existing?.metadata as any) || {}),
          dias_semana: this.diasSemana,
          base_url: this.baseUrl,
        };
        await (supabase as any)
          .from("configuracoes_monitoramento")
          .update({
            ativo: this.isRunning,
            horarios_execucao: this.horarios,
            metadata: meta,
            updated_at: new Date().toISOString(),
          })
          .eq("id", this.dbConfigId);
      } else {
        const { data } = await (supabase as any)
          .from("configuracoes_monitoramento")
          .insert({
            tipo: "kurier",
            ativo: this.isRunning,
            horarios_execucao: this.horarios,
            frequencia: "diario",
            metadata: { dias_semana: this.diasSemana, base_url: this.baseUrl },
          })
          .select("id")
          .single();
        if (data) this.dbConfigId = data.id;
      }
    } catch (err) {
      console.error("[Kurier Scheduler] Erro ao salvar config:", err);
    }
  }

  private slotRanKey(ymd: string, slot: string): string {
    return `djen-kurier-scheduler-last-run-${ymd}-${slot}`;
  }
  private slotJaRodou(ymd: string, slot: string): boolean {
    return !!localStorage.getItem(this.slotRanKey(ymd, slot));
  }
  private marcarSlotRodado(ymd: string, slot: string) {
    localStorage.setItem(this.slotRanKey(ymd, slot), String(Date.now()));
  }

  private getDayOfWeekBrt(): number {
    const s = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[s.slice(0, 3)] ?? new Date().getDay();
  }
  private getTodayYmd(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  }
  private getBrtHourMinute(): { hour: number; minute: number } {
    const str = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour12: false });
    const timePart = str.split(", ")[1];
    const [h, m] = timePart.split(":").map(Number);
    return { hour: h === 24 ? 0 : h, minute: m };
  }

  private slotPendente(): string | null {
    if (!this.diasSemana.includes(this.getDayOfWeekBrt())) return null;
    const { hour, minute } = this.getBrtHourMinute();
    const nowMinutes = hour * 60 + minute;
    const ymd = this.getTodayYmd();
    for (const slot of this.horarios) {
      const [h, m] = slot.split(":").map(Number);
      const target = h * 60 + m;
      if (nowMinutes >= target && nowMinutes <= target + this.TARGET_WINDOW_MINUTES) {
        if (!this.slotJaRodou(ymd, slot)) return slot;
      }
    }
    return null;
  }

  private async checkAndRun() {
    const now = Date.now();
    if (now - this.lastCheckTime < 10_000) return;
    this.lastCheckTime = now;

    const slot = this.slotPendente();
    if (!slot) return;
    const todayYmd = this.getTodayYmd();

    if (isDjenTermosKurierRunning()) {
      this.showToast("Kurier já está em execução", "info");
      return;
    }

    this.marcarSlotRodado(todayYmd, slot);
    this.notifySubscribers();

    try {
      this.showToast(`Iniciando Kurier agendado (${slot})...`, "info");
      void executarDjenTermosKurier(false, undefined, undefined, undefined, undefined, false, false);
      if (this.dbConfigId) {
        await (supabase as any)
          .from("configuracoes_monitoramento")
          .update({ ultima_execucao: new Date().toISOString() })
          .eq("id", this.dbConfigId);
        this.ultimaExecucao = new Date().toISOString();
      }
      this.notifySubscribers();
    } catch (err) {
      console.error("[Kurier Scheduler] Erro ao executar:", err);
      this.showToast("Erro ao executar Kurier agendado", "error");
    }
  }

  private showToast(msg: string, type: "info" | "success" | "error") {
    const now = Date.now();
    if (now - this.lastToastTime < this.TOAST_COOLDOWN_MS) return;
    this.lastToastTime = now;
    if (type === "success") toast.success(msg);
    else if (type === "error") toast.error(msg);
    else toast.info(msg);
  }

  private notifySubscribers() {
    const status = this.getStatus();
    subscribersSet.forEach((cb) => { try { cb(status); } catch (e) { console.error(e); } });
  }

  private startInternal() {
    if (this.isRunning) return;
    this.isRunning = true;
    setTimeout(() => this.checkAndRun(), 2000);
    this.intervalId = setInterval(() => this.checkAndRun(), this.INTERVAL_MS);
    this.notifySubscribers();
  }

  start() { this.startInternal(); this.saveToDb(); }
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.saveToDb();
    this.notifySubscribers();
  }

  getStatus(): KurierSchedulerStatus {
    let proximoHorario: string | null = null;
    if (this.isRunning && this.horarios.length > 0) {
      const ymd = this.getTodayYmd();
      const { hour, minute } = this.getBrtHourMinute();
      const nowMinutes = hour * 60 + minute;
      const restantes = this.horarios
        .filter((slot) => {
          if (this.slotJaRodou(ymd, slot)) return false;
          const [h, m] = slot.split(":").map(Number);
          return nowMinutes <= h * 60 + m + this.TARGET_WINDOW_MINUTES;
        })
        .sort();
      const diaOk = this.diasSemana.includes(this.getDayOfWeekBrt());
      if (diaOk && this.slotPendente()) proximoHorario = "Em breve (aguardando)";
      else if (diaOk && restantes.length > 0) proximoHorario = `Hoje às ${restantes[0]}`;
      else proximoHorario = `Próximo dia às ${this.horarios[0]}`;
    }
    return {
      ativo: this.isRunning,
      proximoHorario,
      ultimaExecucao: this.ultimaExecucao,
      horarios: [...this.horarios],
      diasSemana: [...this.diasSemana],
      baseUrl: this.baseUrl,
    };
  }

  setHorarios(horarios: string[]) {
    const norm = normalizarHorarios(horarios);
    this.horarios = norm.length > 0 ? norm : ["05:00"];
    this.saveToDb();
    this.notifySubscribers();
  }
  setDiasSemana(dias: number[]) {
    const ok = Array.from(new Set(dias.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort();
    this.diasSemana = ok.length > 0 ? ok : [...DEFAULT_DIAS_SEMANA];
    this.saveToDb();
    this.notifySubscribers();
  }
  setBaseUrl(url: string) {
    this.baseUrl = url || DEFAULT_BASE_URL;
    this.saveToDb();
    this.notifySubscribers();
  }
}

function getScheduler(): KurierScheduler {
  if (!schedulerInstance) schedulerInstance = new KurierScheduler();
  return schedulerInstance;
}

export function useDjenTermosKurierScheduler() {
  const [status, setStatus] = useState<KurierSchedulerStatus>(() => getScheduler().getStatus());
  useEffect(() => {
    const cb = (s: KurierSchedulerStatus) => setStatus(s);
    subscribersSet.add(cb);
    setStatus(getScheduler().getStatus());
    return () => { subscribersSet.delete(cb); };
  }, []);
  return {
    ...status,
    start: () => getScheduler().start(),
    stop: () => getScheduler().stop(),
    setHorarios: (h: string[]) => getScheduler().setHorarios(h),
    setDiasSemana: (d: number[]) => getScheduler().setDiasSemana(d),
    setBaseUrl: (u: string) => getScheduler().setBaseUrl(u),
    // Backwards-compat: alguns componentes ainda usam `config`/`saveConfig`.
    config: {
      id: null,
      ativo: status.ativo,
      frequenciaMin: 0,
      ultimaExecucao: status.ultimaExecucao,
      baseUrl: status.baseUrl,
    },
    saveConfig: async (patch: Partial<{ ativo: boolean; baseUrl: string }>) => {
      if (patch.baseUrl !== undefined) getScheduler().setBaseUrl(patch.baseUrl);
      if (patch.ativo !== undefined) (patch.ativo ? getScheduler().start() : getScheduler().stop());
    },
  };
}
