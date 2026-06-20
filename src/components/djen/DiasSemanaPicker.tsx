import { cn } from "@/lib/utils";

const DIAS = [
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
  { v: 0, label: "Dom" },
];

export const DIAS_SEMANA_DEFAULT = [1, 2, 3, 4, 5];

type Props = {
  value: number[] | null | undefined;
  onChange: (next: number[]) => void;
  disabled?: boolean;
};

export function DiasSemanaPicker({ value, onChange, disabled }: Props) {
  const ativos = new Set<number>(
    Array.isArray(value) && value.length ? value : DIAS_SEMANA_DEFAULT,
  );
  const toggle = (v: number) => {
    const next = new Set(ativos);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next).sort((a, b) => a - b));
  };
  return (
    <div className="flex flex-wrap gap-1">
      {DIAS.map((d) => {
        const on = ativos.has(d.v);
        return (
          <button
            key={d.v}
            type="button"
            disabled={disabled}
            onClick={() => toggle(d.v)}
            className={cn(
              "h-8 min-w-[40px] px-2 rounded-md text-xs font-medium border transition-colors",
              on
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted",
              disabled && "opacity-60 cursor-not-allowed",
            )}
            aria-pressed={on}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}