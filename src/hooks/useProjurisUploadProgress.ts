import { useEffect, useRef, useState } from "react";
import { percentualAnexos } from "@/lib/projurisImportQueue";

export type ProjurisUploadState = {
  phase: string; completed: number; total: number; percent: number;
  uploaded: number; linked: number; skipped: number; errors: number;
  bytes: number; startedAt: number; active: { name: string; stage: string; percent: number }[];
};
const initial = (): ProjurisUploadState => ({ phase: "Preparando anexos", completed: 0, total: 0, percent: 0, uploaded: 0, linked: 0, skipped: 0, errors: 0, bytes: 0, startedAt: Date.now(), active: [] });

export function useProjurisUploadProgress() {
  const model = useRef(initial());
  const files = useRef(new Map<string, { name: string; stage: string; progress: number; bytes: number }>());
  const [state, setState] = useState(initial);
  const [running, setRunning] = useState(false);
  const publish = () => {
    const active = Array.from(files.current.values());
    setState({ ...model.current,
      percent: percentualAnexos(model.current.completed, model.current.total, active.map(f => f.progress)),
      bytes: model.current.bytes + active.reduce((sum, f) => sum + f.bytes, 0),
      active: active.map(f => ({ name: f.name, stage: f.stage, percent: Math.round(f.progress * 100) })),
    });
  };
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(publish, 200);
    return () => clearInterval(timer);
  }, [running]);
  return { state,
    start(total: number) { model.current = { ...initial(), total }; files.current.clear(); setRunning(true); publish(); },
    phase(phase: string) { model.current.phase = phase; publish(); },
    file(key: string, name: string, stage: string, progress = 0, bytes = 0) { files.current.set(key, { name, stage, progress, bytes }); },
    complete(key: string, result: "uploaded" | "linked" | "skipped" | "errors") {
      model.current.bytes += files.current.get(key)?.bytes || 0;
      files.current.delete(key); model.current.completed++; model.current[result]++; publish();
    },
    finish(phase: string) { model.current.phase = phase; setRunning(false); publish(); },
  };
}