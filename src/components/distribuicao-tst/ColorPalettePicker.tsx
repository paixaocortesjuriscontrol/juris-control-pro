import { TAG_COLOR_PALETTE } from "@/hooks/useProcessoTags";
import { Check } from "lucide-react";

interface Props {
  value: string;
  onChange: (color: string) => void;
  size?: "sm" | "md";
}

export function ColorPalettePicker({ value, onChange, size = "sm" }: Props) {
  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className="flex flex-wrap gap-1">
      {TAG_COLOR_PALETTE.map((c) => {
        const active = c.toLowerCase() === (value || "").toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`${dim} rounded-full border flex items-center justify-center transition-transform hover:scale-110 ${
              active ? "ring-2 ring-offset-1 ring-foreground" : "border-border"
            }`}
            style={{ backgroundColor: c }}
            title={c}
          >
            {active && <Check className="w-2.5 h-2.5 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}