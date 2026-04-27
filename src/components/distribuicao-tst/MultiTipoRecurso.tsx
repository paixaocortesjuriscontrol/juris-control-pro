import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}

const OPCOES_RECURSO = [
  "AIRR",
  "RR",
  "RO",
  "ED",
  "EE",
  "E",
  "AgR",
  "AgInt",
  "AP",
  "AI",
  "Ag",
  "RE",
  "REsp",
];

const SEPARADOR = " + ";

/**
 * Permite informar múltiplos tipos de recurso para uma mesma parte.
 * Internamente armazena como string única separada por " + " para manter
 * compatibilidade com a coluna existente (tipo_recurso_reclamante /
 * tipo_recurso_banco) e com o backend (que já usa o mesmo separador).
 */
export function MultiTipoRecurso({ value, onChange }: Props) {
  const tipos = useMemo<string[]>(() => {
    const raw = (value || "").toString().trim();
    if (!raw) return [""];
    return raw.split(/\s*\+\s*/).map((s) => s.trim()).filter((s, i, a) => s || a.length === 1);
  }, [value]);

  const commit = (lista: string[]) => {
    const limpo = lista.map((s) => s.trim()).filter(Boolean);
    onChange(limpo.length ? limpo.join(SEPARADOR) : null);
  };

  const setAt = (idx: number, novo: string) => {
    const next = [...tipos];
    next[idx] = novo;
    commit(next);
  };

  const remove = (idx: number) => {
    const next = tipos.filter((_, i) => i !== idx);
    commit(next.length ? next : [""]);
  };

  const add = () => {
    commit([...tipos, ""]);
  };

  return (
    <div className="space-y-2">
      {tipos.map((t, idx) => {
        const isPredef = OPCOES_RECURSO.includes(t);
        return (
          <div key={idx} className="flex items-center gap-2">
            <Select
              value={isPredef ? t : (t ? "__custom__" : "")}
              onValueChange={(v) => {
                if (v === "__custom__") {
                  setAt(idx, t && !isPredef ? t : " ");
                } else {
                  setAt(idx, v);
                }
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_RECURSO.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
                <SelectItem value="__custom__">Outro…</SelectItem>
              </SelectContent>
            </Select>
            {!isPredef && (
              <Input
                className="flex-1"
                placeholder="Descreva o recurso"
                value={t}
                onChange={(e) => setAt(idx, e.target.value)}
              />
            )}
            {tipos.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} title="Remover">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
        <Plus className="h-3 w-3" /> Adicionar tipo de recurso
      </Button>
    </div>
  );
}
