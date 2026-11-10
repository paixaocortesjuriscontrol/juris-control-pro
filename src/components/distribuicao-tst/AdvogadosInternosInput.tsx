import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

/** Lista de um ou mais advogados internos (nomes livres). Enter ou vírgula adiciona. */
export function AdvogadosInternosInput({ value, onChange }: Props) {
  const [texto, setTexto] = useState("");
  const adicionar = () => {
    const novos = texto.split(/[,;]/).map(t => t.trim()).filter(Boolean)
      .filter(n => !value.some(v => v.toLowerCase() === n.toLowerCase()));
    if (novos.length) onChange([...value, ...novos]);
    setTexto("");
  };
  return (
    <div className="space-y-2">
      <Input
        value={texto}
        placeholder="Digite o nome e tecle Enter"
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); adicionar(); }
        }}
        onBlur={adicionar}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(n => (
            <Badge key={n} variant="secondary" className="gap-1">
              {n}
              <button type="button" aria-label={`Remover ${n}`} onClick={() => onChange(value.filter(v => v !== n))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
