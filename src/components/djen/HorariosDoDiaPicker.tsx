import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_SLOTS = 3;

function normalizar(horarios: string[]): string[] {
  const limpos = horarios
    .map((h) => String(h || "").trim())
    .filter((h) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(h));
  const unicos = Array.from(new Set(limpos));
  unicos.sort((a, b) => a.localeCompare(b));
  return unicos.slice(0, MAX_SLOTS);
}

function arraysIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  conflitos?: string[];        // horários que conflitam (ex.: DJEN browser)
  conflitoLabel?: string;      // descrição do conjunto conflitante p/ aviso
  placeholder?: string;
};

export function HorariosDoDiaPicker({ value, onChange, disabled, conflitos = [], conflitoLabel, placeholder }: Props) {
  // Estado local com 3 slots — vazios viram desabilitados ao salvar
  const [slots, setSlots] = useState<string[]>(() => {
    const base = normalizar(value || []);
    while (base.length < MAX_SLOTS) base.push("");
    return base;
  });

  useEffect(() => {
    const base = normalizar(value || []);
    while (base.length < MAX_SLOTS) base.push("");
    setSlots(base);
  }, [JSON.stringify(value)]);

  const persistir = (proximos: string[]) => {
    const norm = normalizar(proximos);
    if (!arraysIguais(norm, normalizar(value || []))) onChange(norm);
  };

  const setSlot = (i: number, v: string) => {
    const copy = slots.slice();
    copy[i] = v;
    setSlots(copy);
  };

  const limparSlot = (i: number) => {
    const copy = slots.slice();
    copy[i] = "";
    setSlots(copy);
    persistir(copy);
  };

  const algumPreenchido = slots.some((s) => s.trim().length > 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s, i) => {
          const conflita = !!s && conflitos.includes(s);
          return (
            <div key={i} className="flex items-center gap-1">
              <Input
                type="time"
                value={s}
                disabled={disabled}
                placeholder={placeholder || "--:--"}
                onChange={(e) => setSlot(i, e.target.value)}
                onBlur={() => persistir(slots)}
                className={cn("h-9", conflita && "border-destructive focus-visible:ring-destructive")}
                aria-label={`Slot ${i + 1}`}
              />
              {s && !disabled && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => limparSlot(i)}
                  title={`Remover slot ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {!algumPreenchido && (
        <p className="text-xs text-amber-600">Defina pelo menos 1 horário para o servidor disparar.</p>
      )}
      {conflitos.length > 0 && conflitoLabel && (
        <p className={cn(
          "text-xs",
          slots.some((s) => conflitos.includes(s)) ? "text-destructive" : "text-muted-foreground",
        )}>
          {conflitoLabel}: {conflitos.join(", ")}
        </p>
      )}
    </div>
  );
}