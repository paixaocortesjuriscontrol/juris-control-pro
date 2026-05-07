import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { DistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { cn } from "@/lib/utils";

export type StatsCardKey =
  | "total"
  | "processosValidos"
  | "processosInvalidos"
  | "dossiesValidos"
  | "dossiesInvalidos"
  | "juditPreenchido"
  | "juditNaoPreenchido"
  | "bennerSim"
  | "bennerNao"
  | "processosAtivos"
  | "transitoJulgado"
  | "outrosSituacao"
  | "semTurma"
  | "problemaJudit";

interface Props {
  stats: DistribuicaoTstStats;
  loading: boolean;
  activeKey?: StatsCardKey | null;
  onCardClick?: (key: StatsCardKey) => void;
}

interface CardDef {
  key: StatsCardKey;
  label: string;
  value: number;
  className: string;
  textClass: string;
}

export function DistribuicaoTstStatsCards({ stats, loading, activeKey, onCardClick }: Props) {
  const cards: CardDef[] = [
    { key: "total", label: "Total de Processos", value: stats.total, className: "from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800", textClass: "text-blue-600 dark:text-blue-400" },
    { key: "processosValidos", label: "Processos Válidos", value: stats.processosValidos, className: "from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800", textClass: "text-emerald-600 dark:text-emerald-400" },
    { key: "processosInvalidos", label: "Processos Inválidos", value: stats.processosInvalidos, className: "from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800", textClass: "text-rose-600 dark:text-rose-400" },
    { key: "dossiesValidos", label: "Dossiês Válidos", value: stats.dossiesValidos, className: "from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800", textClass: "text-emerald-600 dark:text-emerald-400" },
    { key: "dossiesInvalidos", label: "Dossiês Inválidos/Não Localizados", value: stats.dossiesInvalidos + stats.dossiesNaoPreenchidos, className: "from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800", textClass: "text-rose-600 dark:text-rose-400" },
    { key: "juditPreenchido", label: "Preenchido Judit", value: stats.juditPreenchido, className: "from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800", textClass: "text-purple-600 dark:text-purple-400" },
    { key: "juditNaoPreenchido", label: "Não Preenchidos Judit", value: stats.juditNaoPreenchido, className: "from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-slate-200 dark:border-slate-800", textClass: "text-slate-600 dark:text-slate-400" },
    { key: "bennerSim", label: "Benner Enviado (Sim)", value: stats.bennerSim, className: "from-cyan-50 to-cyan-100 dark:from-cyan-950/50 dark:to-cyan-900/30 border-cyan-200 dark:border-cyan-800", textClass: "text-cyan-600 dark:text-cyan-400" },
    { key: "bennerNao", label: "Benner Não Enviado", value: stats.bennerNao, className: "from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800", textClass: "text-orange-600 dark:text-orange-400" },
    { key: "processosAtivos", label: "Processos Ativos", value: stats.processosAtivos, className: "from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800", textClass: "text-green-600 dark:text-green-400" },
    { key: "transitoJulgado", label: "Trânsito em Julgado", value: stats.transitoJulgado, className: "from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800", textClass: "text-amber-600 dark:text-amber-400" },
    { key: "outrosSituacao", label: "Outros", value: stats.outrosSituacao, className: "from-zinc-50 to-zinc-100 dark:from-zinc-950/50 dark:to-zinc-900/30 border-zinc-200 dark:border-zinc-800", textClass: "text-zinc-600 dark:text-zinc-400" },
    { key: "semTurma", label: "Sem Turma", value: stats.semTurma, className: "from-pink-50 to-pink-100 dark:from-pink-950/50 dark:to-pink-900/30 border-pink-200 dark:border-pink-800", textClass: "text-pink-600 dark:text-pink-400" },
    { key: "problemaJudit", label: "Problema Judit", value: stats.problemaJudit, className: "from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800", textClass: "text-amber-700 dark:text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 md:gap-2">
      {cards.map((c) => {
        const isActive = activeKey === c.key;
        const clickable = !!onCardClick;
        return (
          <Card
            key={c.key}
            onClick={clickable ? () => onCardClick?.(c.key) : undefined}
            className={cn(
              "bg-gradient-to-br transition-all",
              c.className,
              clickable && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
              isActive && "ring-2 ring-primary ring-offset-1"
            )}
            title={clickable ? "Clique para filtrar" : undefined}
          >
            <CardContent className="p-2">
              <p className={cn("text-[10px] md:text-[11px] font-medium truncate leading-tight", c.textClass)} title={c.label}>{c.label}</p>
              <p className={cn("text-base md:text-lg font-bold mt-0.5 leading-tight", c.textClass)}>
                {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : c.value.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
