import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSituacoesPainel } from "@/hooks/useSituacoesPainel";

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
  const { options: situacoesOptions } = useSituacoesPainel();
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
      <PopoverContent
        className="w-[min(92vw,26rem)] p-0"
        align="end"
        collisionPadding={12}
      >
        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Período (data prevista/fatal conforme selecionado) */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Período
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground">Início</Label>
                <Input
                  type="date"
                  value={draft.periodoInicio}
                  onChange={(e) => setDraft({ ...draft, periodoInicio: e.target.value })}
                  className="h-9 w-full text-sm px-2"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground">Fim</Label>
                <Input
                  type="date"
                  value={draft.periodoFim}
                  onChange={(e) => setDraft({ ...draft, periodoFim: e.target.value })}
                  className="h-9 w-full text-sm px-2"
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
              selectedIds={draft.responsavelIds}
              onChange={(ids) => setDraft({ ...draft, responsavelIds: ids })}
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
                  checked={draft.souResponsavel}
                  onCheckedChange={(v) => setDraft({ ...draft, souResponsavel: !!v })}
                />
                Sou Responsável
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={draft.estouEnvolvido}
                  onCheckedChange={(v) => setDraft({ ...draft, estouEnvolvido: !!v })}
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
                  checked={draft.dataPrevista}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, dataPrevista: !!v, dataFatal: !v ? true : draft.dataFatal })
                  }
                />
                Data prevista
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={draft.dataFatal}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, dataFatal: !!v, dataPrevista: !v ? true : draft.dataPrevista })
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
                    checked={draft.statusGroup === s.value}
                    onChange={() => setDraft({ ...draft, statusGroup: s.value })}
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
              {situacoesOptions.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={draft.situacoes.includes(s.value)}
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
                    checked={draft.classificacoes.includes(c.value)}
                    onCheckedChange={() => toggleClassificacao(c.value)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Ações */}
        <div className="flex items-center justify-between gap-2 border-t border-border p-3 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              setDraft(PAINEL_FILTROS_DEFAULT);
              onChange(PAINEL_FILTROS_DEFAULT);
            }}
          >
            Limpar filtros
          </Button>
          <Button
            size="sm"
            className="text-xs px-4"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Filtrar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
