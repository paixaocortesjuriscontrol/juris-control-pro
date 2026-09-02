import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}

const OPCOES_RECURSO = [
  "Ação Rescisória",
  "Agravo de Instrumento",
  "Agravo em Recurso Extraordinário",
  "Agravo Interno",
  "Embargos de Declaração",
  "Embargos de Divergência",
  "Embargos SDI",
  "Incidente de arguição de inconstitucionalidade",
  "Incidente de assunção de competência",
  "Incidente de recurso repetitivo",
  "Incidente de resolução de demanda repetitiva",
  "Incidente de superação e revisão dos precedentes",
  "Mandado de Segurança",
  "Medida Cautelar",
  "Reclamação",
  "Recurso de Revista",
  "Recurso de Revista com Agravo (ARR)",
  "Recurso Especial",
  "Recurso Extraordinário",
  "Recurso Ordinário",
].sort((a, b) => a.localeCompare(b, "pt-BR"));

const SEPARADOR = " + ";

/**
 * Permite informar múltiplos tipos de recurso para uma mesma parte.
 * Internamente armazena como string única separada por " + " para manter
 * compatibilidade com a coluna existente (tipo_recurso_reclamante /
 * tipo_recurso_banco) e com o backend (que já usa o mesmo separador).
 */
export function MultiTipoRecurso({ value, onChange }: Props) {
  const parse = (v: string | null | undefined): string[] => {
    const raw = (v || "").toString().trim();
    if (!raw) return [""];
    const arr = raw.split(/\s*\+\s*/).map((s) => s.trim());
    return arr.length ? arr : [""];
  };

  const [tipos, setTipos] = useState<string[]>(() => parse(value));

  // Sincroniza quando o valor externo muda (ex.: preenchimento via Judit)
  useEffect(() => {
    const externo = parse(value);
    const atualSemVazios = tipos.map((s) => s.trim()).filter(Boolean).join(SEPARADOR);
    const externoStr = externo.filter(Boolean).join(SEPARADOR);
    if (atualSemVazios !== externoStr) {
      setTipos(externo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (lista: string[]) => {
    setTipos(lista);
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

  return (
    <div className="space-y-2">
      {tipos.map((t, idx) => {
        const isPredef = OPCOES_RECURSO.includes(t);
        return (
          <div key={idx} className="space-y-2 rounded-md border border-border/60 p-2">
            <div className="flex items-center gap-2">
              <Select
              value={isPredef ? t : (t.trim() ? t : "")}
              onValueChange={(v) => {
                setAt(idx, v === "__none__" ? "" : v);
              }}
            >
              <SelectTrigger className="flex-1 min-w-0">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                {OPCOES_RECURSO.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
                {!isPredef && t.trim() && (
                  <SelectItem value={t} className="text-destructive">
                    {t} (NÃO PODE ENVIAR BENNER)
                  </SelectItem>
                )}
              </SelectContent>

              </Select>
              {tipos.length > 1 ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} title="Remover">
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                t.trim() && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} title="Limpar">
                    <X className="h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
