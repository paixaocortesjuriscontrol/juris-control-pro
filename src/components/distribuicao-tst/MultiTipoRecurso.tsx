import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}

const OPCOES_RECURSO = [
  "Agravo",
  "Agravo de Instrumento",
  "Agravo de Instrumento em Recurso de Revista",
  "Agravo de Petição",
  "Agravo em Recurso Especial",
  "Agravo em Recurso Extraordinário",
  "Agravo Interno",
  "Agravo Regimental",
  "Embargos",
  "Embargos à SDI",
  "Embargos de Declaração",
  "Embargos em Execução",
  "Embargos em Recurso de Revista",
  "Embargos Infringentes",
  "Habeas Corpus",
  "Mandado de Segurança",
  "Reclamação",
  "Recurso Adesivo",
  "Recurso de Revista",
  "Recurso de Revista com Agravo",
  "Recurso Especial",
  "Recurso Extraordinário",
  "Recurso Ordinário",
  "Recurso Ordinário em Ação Rescisória",
  "Recurso Ordinário em Mandado de Segurança",
  "Recurso Ordinário em Procedimento Sumaríssimo",
  "Recurso Ordinário Trabalhista",
  "Desistir - Falha Processual",
  "Desistir - Fatos e Provas",
  "Desistir - Jurisprudência consolidada",
  "Desistir - Mídia Negativa",
  "Desistir - Súmula 266 C.TST",
  "Prosseguir",
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

  const limparTudo = () => {
    commit([""]);
  };

  const add = () => {
    commit([...tipos, ""]);
  };

  return (
    <div className="space-y-2">
      {tipos.map((t, idx) => {
        const isPredef = OPCOES_RECURSO.includes(t);
        return (
          <div key={idx} className="space-y-2 rounded-md border border-border/60 p-2">
            <div className="flex items-center gap-2">
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
              <SelectTrigger className="flex-1 min-w-0">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_RECURSO.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
                <SelectItem value="__custom__">Outro…</SelectItem>
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
            {!isPredef && (
              <Input
                className="w-full"
                placeholder="Descreva o recurso"
                value={t}
                onChange={(e) => setAt(idx, e.target.value)}
              />
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus className="h-3 w-3" /> Adicionar tipo de recurso
        </Button>
        {tipos.some((t) => t.trim()) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={limparTudo}
            className="gap-1 text-destructive hover:text-destructive"
            title="Remover todos os tipos de recurso"
          >
            <Trash2 className="h-3 w-3" /> Remover todos
          </Button>
        )}
      </div>
    </div>
  );
}
