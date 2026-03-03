import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PainelFiltrosState {
  // Prazo
  dataPrevista: boolean;
  dataFatal: boolean;
  // Situação
  situacoes: string[];
  // Classificação
  classificacoes: string[];
  // Envolvimento
  souResponsavel: boolean;
  estouEnvolvido: boolean;
}

export const PAINEL_FILTROS_DEFAULT: PainelFiltrosState = {
  dataPrevista: true,
  dataFatal: false,
  situacoes: [],
  classificacoes: [],
  souResponsavel: false,
  estouEnvolvido: false,
};

const SITUACOES = [
  { value: "a_confirmar", label: "A confirmar" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
  { value: "em_execucao", label: "Em execução" },
  { value: "cumprido", label: "Concluído com sucesso" },
  { value: "concluido_sem_sucesso", label: "Concluído sem sucesso" },
  { value: "revisao", label: "Revisão" },
];

const CLASSIFICACOES = [
  { value: "tarefa", label: "Tarefas" },
  { value: "audiencia", label: "Audiências" },
  { value: "evento", label: "Compromissos" },
];

interface PainelFiltrosProps {
  filtros: PainelFiltrosState;
  onChange: (filtros: PainelFiltrosState) => void;
}

export function PainelFiltros({ filtros, onChange }: PainelFiltrosProps) {
  const [open, setOpen] = useState(false);

  const activeCount = [
    filtros.souResponsavel || filtros.estouEnvolvido,
    filtros.dataFatal,
    filtros.situacoes.length > 0,
    filtros.classificacoes.length > 0,
  ].filter(Boolean).length;

  const toggleSituacao = (val: string) => {
    const next = filtros.situacoes.includes(val)
      ? filtros.situacoes.filter((s) => s !== val)
      : [...filtros.situacoes, val];
    onChange({ ...filtros, situacoes: next });
  };

  const toggleClassificacao = (val: string) => {
    const next = filtros.classificacoes.includes(val)
      ? filtros.classificacoes.filter((c) => c !== val)
      : [...filtros.classificacoes, val];
    onChange({ ...filtros, classificacoes: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs gap-1",
            activeCount > 0 && "border-primary text-primary"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {activeCount > 0 && (
            <span className="ml-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Envolvimento */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Envolvimento
            </p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filtros.souResponsavel}
                  onCheckedChange={(v) =>
                    onChange({ ...filtros, souResponsavel: !!v })
                  }
                />
                Sou Responsável
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filtros.estouEnvolvido}
                  onCheckedChange={(v) =>
                    onChange({ ...filtros, estouEnvolvido: !!v })
                  }
                />
                Estou Envolvido
              </label>
            </div>
          </div>

          {/* Prazo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Prazo
            </p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filtros.dataPrevista}
                  onCheckedChange={(v) =>
                    onChange({ ...filtros, dataPrevista: !!v, dataFatal: !v ? true : filtros.dataFatal })
                  }
                />
                Data prevista
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filtros.dataFatal}
                  onCheckedChange={(v) =>
                    onChange({ ...filtros, dataFatal: !!v, dataPrevista: !v ? true : filtros.dataPrevista })
                  }
                />
                Data fatal
              </label>
            </div>
          </div>

          {/* Situação */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Situação
            </p>
            <div className="space-y-1.5">
              {SITUACOES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filtros.situacoes.includes(s.value)}
                    onCheckedChange={() => toggleSituacao(s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* Classificação */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Classificação
            </p>
            <div className="space-y-1.5">
              {CLASSIFICACOES.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filtros.classificacoes.includes(c.value)}
                    onCheckedChange={() => toggleClassificacao(c.value)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Limpar filtros */}
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange(PAINEL_FILTROS_DEFAULT)}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
