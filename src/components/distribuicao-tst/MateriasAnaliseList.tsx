import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseMateriasString } from "./MateriasMultiSelect";
import { aplicarRegraOutraMateria } from "@/utils/outraMateria";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type MateriaAnaliseItem = {
  materia: string;
  aparelhamento: string | null; // "BEM APARELHADA" | "MAL APARELHADA"
  chance_turma: string | null; // "FAVORÁVEL" | "DESFAVORÁVEL"
  chance_relator: string | null; // "FAVORÁVEL" | "DESFAVORÁVEL"
  chance_exito: string | null; // "SIM" | "NÃO"
};

interface Props {
  materias: string | null;
  value: MateriaAnaliseItem[] | null | undefined;
  onChange: (next: MateriaAnaliseItem[]) => void;
  /** Label opcional do bloco (ex.: "Análise por matéria do Reclamante"). */
  title?: string;
  /**
   * Nome da coluna JSONB (ex.: "materias_analise_reclamante"). Usado para
   * gerar `data-pend-key` em cada célula, permitindo que "Verificar
   * Pendências" destaque as lacunas por matéria.
   */
  fieldKey?: string;
}

const APARELHAMENTO_OPTS = ["BEM APARELHADA", "MAL APARELHADA"];
const CHANCE_OPTS = ["FAVORÁVEL", "DESFAVORÁVEL"];
const SIM_NAO_OPTS = ["SIM", "NÃO"];

function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Reconciles the stored JSONB list with the currently selected matérias:
 *  - keeps existing rows whose `materia` still matches one of the selected items
 *  - creates empty rows for newly added matérias
 *  - drops rows whose matéria was removed
 * Order follows the selection order (the source of truth is `materias`).
 */
export function reconcileMateriasAnalise(
  materias: string | null,
  current: MateriaAnaliseItem[] | null | undefined,
): MateriaAnaliseItem[] {
  // "Outra Matéria" é neutra: sempre gera linha de análise (para preenchimento
  // opcional), sem nunca gerar pendência ou aviso.
  const list = parseMateriasString(materias);
  const byKey = new Map<string, MateriaAnaliseItem>();
  for (const it of current || []) {
    if (!it || typeof it !== "object") continue;
    byKey.set(normalize(it.materia), it);
  }
  return list.map((nome) => {
    const found = byKey.get(normalize(nome));
    return found
      ? { ...found, materia: nome }
      : { materia: nome, aparelhamento: null, chance_turma: null, chance_relator: null, chance_exito: null };
  });
}

export function MateriasAnaliseList({ materias, value, onChange, title, fieldKey }: Props) {
  const rows = useMemo(() => reconcileMateriasAnalise(materias, value), [materias, value]);
  const pendKey = (col: string, materia: string) =>
    fieldKey ? `${fieldKey}.${col}.${String(materia).trim()}` : undefined;

  if (rows.length === 0) return null;

  const update = (idx: number, patch: Partial<MateriaAnaliseItem>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const replicarLinha = (idx: number) => {
    const src = rows[idx];
    if (!src) return;
    const next = rows.map((r, i) =>
      i === idx
        ? r
        : {
            ...r,
            aparelhamento: src.aparelhamento,
            chance_turma: src.chance_turma,
            chance_relator: src.chance_relator,
            chance_exito: src.chance_exito,
          },
    );
    onChange(next);
  };

  const missingCls = "ring-1 ring-red-400 focus:ring-red-500";

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      {title && (
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title} <span className="text-red-600 normal-case">— preencha todas as colunas para cada matéria</span>
        </div>
      )}
      <div className="grid grid-cols-12 gap-2 text-[11px] font-medium text-muted-foreground px-1">
        <div className="col-span-12 md:col-span-4">Matéria</div>
        <div className="col-span-4 md:col-span-3">Aparelhamento <span className="text-red-600">*</span></div>
        <div className="col-span-4 md:col-span-2">Chance Turma <span className="text-red-600">*</span></div>
        <div className="col-span-4 md:col-span-2">Chance Relator <span className="text-red-600">*</span></div>
        <div className="col-span-4 md:col-span-1">Êxito <span className="text-red-600">*</span></div>
      </div>
      {rows.map((row, idx) => (
        <div
          key={`${row.materia}-${idx}`}
          className="grid grid-cols-12 gap-2 items-center bg-background rounded-md p-2 border border-border/60"
        >
          <div className="col-span-12 md:col-span-4 text-sm break-words pr-2">
            {row.materia}
          </div>
          <div className="col-span-4 md:col-span-3" data-pend-key={pendKey("aparelhamento", row.materia)}>
            <Select
              value={row.aparelhamento || "__none__"}
              onValueChange={(v) => update(idx, { aparelhamento: v === "__none__" ? null : v })}
            >
              <SelectTrigger className={`h-8 text-xs ${!row.aparelhamento ? missingCls : ""}`}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                {APARELHAMENTO_OPTS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4 md:col-span-2" data-pend-key={pendKey("chance_turma", row.materia)}>
            <Select
              value={row.chance_turma || "__none__"}
              onValueChange={(v) => update(idx, { chance_turma: v === "__none__" ? null : v })}
            >
              <SelectTrigger className={`h-8 text-xs ${!row.chance_turma ? missingCls : ""}`}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                {CHANCE_OPTS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4 md:col-span-2" data-pend-key={pendKey("chance_relator", row.materia)}>
            <Select
              value={row.chance_relator || "__none__"}
              onValueChange={(v) => update(idx, { chance_relator: v === "__none__" ? null : v })}
            >
              <SelectTrigger className={`h-8 text-xs ${!row.chance_relator ? missingCls : ""}`}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione</SelectItem>
                {CHANCE_OPTS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4 md:col-span-1" data-pend-key={pendKey("chance_exito", row.materia)}>
            <div className="flex items-center gap-1">
              <Select
                value={row.chance_exito || "__none__"}
                onValueChange={(v) => update(idx, { chance_exito: v === "__none__" ? null : v })}
              >
                <SelectTrigger className={`h-8 text-xs ${!row.chance_exito ? missingCls : ""}`}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  {SIM_NAO_OPTS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rows.length > 1 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => replicarLinha(idx)}
                        aria-label="Replicar valores desta linha para todas as matérias"
                        className="h-6 w-6 shrink-0 rounded-full bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold p-0 leading-none"
                      >
                        R
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      Replicar Aparelhamento, Chance Turma, Chance Relator e Êxito desta linha para todas as outras matérias
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Deriva valores agregados (campos legados em dados_benner) a partir da lista
 * por matéria. Retorna apenas as chaves cujo valor é determinístico.
 */
export function derivarAgregadosDeMaterias(list: MateriaAnaliseItem[] | null | undefined) {
  const items = (list || []).filter((i) => i && i.materia);
  if (items.length === 0) {
    return {
      aparelhamento: null as string | null,
      bem: false,
      mal: false,
      turma_favoravel: false,
      turma_desfavoravel: false,
      relator_favoravel: false,
      relator_desfavoravel: false,
    };
  }
  const isBem = (s: string | null) => /^BEM/i.test(String(s || ""));
  const isMal = (s: string | null) => /^MAL/i.test(String(s || ""));
  const isFav = (s: string | null) => /FAVOR/i.test(String(s || "")) && !/DESF/i.test(String(s || ""));
  const isDesf = (s: string | null) => /DESF/i.test(String(s || ""));
  const bem = items.some((i) => isBem(i.aparelhamento));
  const mal = items.some((i) => isMal(i.aparelhamento));
  let aparelhamento: string | null = null;
  if (bem && !mal) aparelhamento = "BEM APARELHADO";
  else if (mal && !bem) aparelhamento = "MAL APARELHADO";
  else if (bem && mal) aparelhamento = "PARCIAL";
  return {
    aparelhamento,
    bem,
    mal,
    turma_favoravel: items.some((i) => isFav(i.chance_turma)),
    turma_desfavoravel: items.some((i) => isDesf(i.chance_turma)),
    relator_favoravel: items.some((i) => isFav(i.chance_relator)),
    relator_desfavoravel: items.some((i) => isDesf(i.chance_relator)),
  };
}