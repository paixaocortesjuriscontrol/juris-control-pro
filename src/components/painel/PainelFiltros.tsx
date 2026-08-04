import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PainelFiltrosState {
  // Prazo
  dataPrevista: boolean;
  dataFatal: boolean;
  // Situação detalhada (avançado)
  situacoes: string[];
  // Exibir (classificação)
  classificacoes: string[];
  // Envolvimento
  souResponsavel: boolean;
  estouEnvolvido: boolean;
  // Status simplificado (radio do anexo)
  statusGroup: "todas" | "a_concluir" | "concluidas" | "canceladas";
  // Período (data prevista / fatal conforme escolha em "Prazo")
  periodoInicio: string; // yyyy-MM-dd
  periodoFim: string;    // yyyy-MM-dd
  // Responsáveis selecionados
  responsavelIds: string[];
}

export const PAINEL_FILTROS_DEFAULT: PainelFiltrosState = {
  dataPrevista: true,
  dataFatal: false,
  situacoes: [],
  classificacoes: [],
  souResponsavel: false,
  estouEnvolvido: false,
  statusGroup: "todas",
  periodoInicio: "",
  periodoFim: "",
  responsavelIds: [],
};

const SITUACOES = [
  { value: "a_confirmar", label: "A confirmar" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
  { value: "em_execucao", label: "Em execução" },
  { value: "cumprido", label: "Concluído com sucesso" },
  { value: "concluido_sem_sucesso", label: "Concluído sem sucesso" },
  { value: "revisao", label: "Revisão" },
  { value: "verificado", label: "Verificado" },
];

const CLASSIFICACOES = [
  { value: "tarefa", label: "Tarefas" },
  { value: "evento", label: "Eventos" },
  { value: "prazo", label: "Prazos" },
  { value: "audiencia", label: "Audiências" },
  { value: "parcelamento", label: "Parcelamento recorrente" },
];

const STATUS_GROUPS: { value: PainelFiltrosState["statusGroup"]; label: string }[] = [
  { value: "a_concluir", label: "A concluir" },
  { value: "concluidas", label: "Concluídas" },
  { value: "canceladas", label: "Canceladas" },
  { value: "todas", label: "Todas" },
];

interface PainelFiltrosProps {
  filtros: PainelFiltrosState;
  onChange: (filtros: PainelFiltrosState) => void;
}

export function PainelFiltros({ filtros, onChange }: PainelFiltrosProps) {
  const [open, setOpen] = useState(false);
  // Rascunho local: só aplica ao clicar em "Filtrar"
  const [draft, setDraft] = useState<PainelFiltrosState>(filtros);

  const handleOpenChange = (v: boolean) => {
    if (v) setDraft(filtros);
    setOpen(v);
  };

  const activeCount = [
    filtros.souResponsavel || filtros.estouEnvolvido,
    filtros.dataFatal,
    filtros.situacoes.length > 0,
    filtros.classificacoes.length > 0,
    filtros.statusGroup !== "todas",
    !!filtros.periodoInicio || !!filtros.periodoFim,
    filtros.responsavelIds.length > 0,
  ].filter(Boolean).length;

  const toggleSituacao = (val: string) => {
    const next = draft.situacoes.includes(val)
      ? draft.situacoes.filter((s) => s !== val)
      : [...draft.situacoes, val];
    setDraft({ ...draft, situacoes: next });
  };

  const toggleClassificacao = (val: string) => {
    const next = draft.classificacoes.includes(val)
      ? draft.classificacoes.filter((c) => c !== val)
      : [...draft.classificacoes, val];
    setDraft({ ...draft, classificacoes: next });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-3 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Período (data prevista/fatal conforme selecionado) */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Período
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Início</Label>
                <Input
                  type="date"
                  value={filtros.periodoInicio}
                  onChange={(e) => onChange({ ...filtros, periodoInicio: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Fim</Label>
                <Input
                  type="date"
                  value={filtros.periodoFim}
                  onChange={(e) => onChange({ ...filtros, periodoFim: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Responsáveis */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Responsáveis
            </p>
            <PeoplePicker
              selectedIds={filtros.responsavelIds}
              onChange={(ids) => onChange({ ...filtros, responsavelIds: ids })}
              placeholder="Filtrar por responsável"
              emptyLabel="Todos os responsáveis"
            />
          </div>

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

          {/* Status (grupo simplificado) */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Status
            </p>
            <div className="space-y-1.5">
              {STATUS_GROUPS.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="painel-status-group"
                    checked={filtros.statusGroup === s.value}
                    onChange={() => onChange({ ...filtros, statusGroup: s.value })}
                    className="accent-primary"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* Situação detalhada (avançado) */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Situação (avançado)
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
