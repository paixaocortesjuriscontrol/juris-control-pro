import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
  // Comentários vinculados ao item
  comentarios: "todas" | "com" | "sem";
  // Marca "já cobrei" (cobranças do dia)
  cobrancas: "todas" | "hoje" | "nao_hoje";
  // Itens criados a partir de publicações
  origemPublicacao?: "todas" | "com" | "sem";
  // Período filtrado pela data da publicação (em vez de data prevista/fatal)
  periodoPorPublicacao?: boolean;

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
  comentarios: "todas",
  cobrancas: "todas",
  origemPublicacao: "todas",

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

const COMENTARIOS_OPTIONS: { value: PainelFiltrosState["comentarios"]; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "com", label: "Com comentário" },
  { value: "sem", label: "Sem comentário" },
];

const COBRANCAS_OPTIONS: { value: PainelFiltrosState["cobrancas"]; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "hoje", label: "Já cobrados hoje" },
  { value: "nao_hoje", label: "Ainda não cobrados hoje" },
];

const ORIGEM_PUB_OPTIONS: { value: "todas" | "com" | "sem"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "com", label: "De publicações" },
  { value: "sem", label: "Não de publicações" },
];

const STATUS_GROUPS: { value: PainelFiltrosState["statusGroup"]; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "a_concluir", label: "A concluir" },
  { value: "concluidas", label: "Concluídas" },
  { value: "canceladas", label: "Canceladas" },
];

interface PainelFiltrosProps {
  filtros: PainelFiltrosState;
  onChange: (filtros: PainelFiltrosState) => void;
}

/** Botão de opção única estilo pílula (segmented). */
function PillOption<T extends string>({
  value,
  current,
  onSelect,
  children,
}: {
  value: T;
  current: T;
  onSelect: (v: T) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Chip selecionável (múltipla escolha). */
function ChipToggle({
  active,
  onToggle,
  children,
}: {
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
      {children}
    </p>
  );
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
    filtros.comentarios !== "todas",
    filtros.cobrancas !== "todas",
    (filtros.origemPublicacao ?? "todas") !== "todas",

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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-7 px-2 text-xs gap-1",
          activeCount > 0 && "border-primary text-primary",
        )}
        onClick={() => handleOpenChange(true)}
      >
        <Filter className="w-3.5 h-3.5" />
        Filtros
        {activeCount > 0 && (
          <span className="ml-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
            {activeCount}
          </span>
        )}
      </Button>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        {/* Cabeçalho */}
        <SheetHeader className="flex flex-row items-center gap-2 px-5 py-4 border-b border-border flex-shrink-0">
          <Filter className="w-4 h-4 text-primary" />
          <SheetTitle className="text-base">Filtros</SheetTitle>
          <SheetDescription className="sr-only">
            Ajuste os filtros da agenda e clique em Filtrar.
          </SheetDescription>
        </SheetHeader>

        {/* Corpo: seções distribuídas verticalmente */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Período */}
          <div>
            <SectionTitle>Período</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground mb-1 block">Início</Label>
                <Input
                  type="date"
                  value={draft.periodoInicio}
                  onChange={(e) => setDraft({ ...draft, periodoInicio: e.target.value })}
                  className="h-9 w-full text-sm px-2"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground mb-1 block">Fim</Label>
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
            <SectionTitle>Responsáveis</SectionTitle>
            <PeoplePicker
              selectedIds={draft.responsavelIds}
              onChange={(ids) => setDraft({ ...draft, responsavelIds: ids })}
              placeholder="Filtrar por responsável"
              emptyLabel="Todos os responsáveis"
            />
          </div>

          {/* Envolvimento */}
          <div>
            <SectionTitle>Envolvimento</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <ChipToggle
                active={draft.souResponsavel}
                onToggle={() => setDraft({ ...draft, souResponsavel: !draft.souResponsavel })}
              >
                Sou Responsável
              </ChipToggle>
              <ChipToggle
                active={draft.estouEnvolvido}
                onToggle={() => setDraft({ ...draft, estouEnvolvido: !draft.estouEnvolvido })}
              >
                Estou Envolvido
              </ChipToggle>
            </div>
          </div>

          {/* Status */}
          <div>
            <SectionTitle>Status</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {STATUS_GROUPS.map((s) => (
                <PillOption
                  key={s.value}
                  value={s.value}
                  current={draft.statusGroup}
                  onSelect={(v) => setDraft({ ...draft, statusGroup: v })}
                >
                  {s.label}
                </PillOption>
              ))}
            </div>
          </div>

          {/* Classificação */}
          <div>
            <SectionTitle>Classificação</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {CLASSIFICACOES.map((c) => (
                <ChipToggle
                  key={c.value}
                  active={draft.classificacoes.includes(c.value)}
                  onToggle={() => toggleClassificacao(c.value)}
                >
                  {c.label}
                </ChipToggle>
              ))}
            </div>
          </div>

          {/* Prazo */}
          <div>
            <SectionTitle>Prazo</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <ChipToggle
                active={draft.dataPrevista}
                onToggle={() =>
                  setDraft({
                    ...draft,
                    dataPrevista: !draft.dataPrevista,
                    dataFatal: !draft.dataPrevista ? draft.dataFatal : true,
                  })
                }
              >
                Data prevista
              </ChipToggle>
              <ChipToggle
                active={draft.dataFatal}
                onToggle={() =>
                  setDraft({
                    ...draft,
                    dataFatal: !draft.dataFatal,
                    dataPrevista: !draft.dataFatal ? draft.dataPrevista : true,
                  })
                }
              >
                Data fatal
              </ChipToggle>
            </div>
          </div>

          {/* Comentários */}
          <div>
            <SectionTitle>Comentários</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {COMENTARIOS_OPTIONS.map((opcao) => (
                <PillOption
                  key={opcao.value}
                  value={opcao.value}
                  current={draft.comentarios}
                  onSelect={(v) => setDraft({ ...draft, comentarios: v })}
                >
                  {opcao.label}
                </PillOption>
              ))}
            </div>
          </div>

          {/* Cobranças */}
          <div>
            <SectionTitle>Cobranças</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {COBRANCAS_OPTIONS.map((opcao) => (
                <PillOption
                  key={opcao.value}
                  value={opcao.value}
                  current={draft.cobrancas}
                  onSelect={(v) => setDraft({ ...draft, cobrancas: v })}
                >
                  {opcao.label}
                </PillOption>
              ))}
            </div>
          </div>

          {/* Origem */}
          <div>
            <SectionTitle>Origem</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {ORIGEM_PUB_OPTIONS.map((opcao) => (
                <PillOption
                  key={opcao.value}
                  value={opcao.value}
                  current={draft.origemPublicacao ?? "todas"}
                  onSelect={(v) => setDraft({ ...draft, origemPublicacao: v })}
                >
                  {opcao.label}
                </PillOption>
              ))}
            </div>
          </div>

          {/* Situação (avançado) */}
          <div>
            <SectionTitle>Situação (avançado)</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {situacoesOptions.map((s) => (
                <ChipToggle
                  key={s.value}
                  active={draft.situacoes.includes(s.value)}
                  onToggle={() => toggleSituacao(s.value)}
                >
                  {s.label}
                </ChipToggle>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé fixo */}
        <div className="flex items-center justify-between gap-2 border-t border-border p-4 bg-muted/30 flex-shrink-0">
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
      </SheetContent>
    </Sheet>
  );
}
