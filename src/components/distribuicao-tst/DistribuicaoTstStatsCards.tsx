import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { DistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { cn } from "@/lib/utils";

interface Props {
  stats: DistribuicaoTstStats;
  loading: boolean;
}

interface CardDef {
  label: string;
  value: number;
  className: string;
  textClass: string;
}

export function DistribuicaoTstStatsCards({ stats, loading }: Props) {
  const cards: CardDef[] = [
    {
      label: "Total de Processos",
      value: stats.total,
      className: "from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800",
      textClass: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Processos Válidos",
      value: stats.processosValidos,
      className: "from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      textClass: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Processos Inválidos",
      value: stats.processosInvalidos,
      className: "from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800",
      textClass: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Dossiês Válidos",
      value: stats.dossiesValidos,
      className: "from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      textClass: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Dossiês Inválidos",
      value: stats.dossiesInvalidos,
      className: "from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800",
      textClass: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Dossiês Não Preenchidos",
      value: stats.dossiesNaoPreenchidos,
      className: "from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800",
      textClass: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Preenchido Judit",
      value: stats.juditPreenchido,
      className: "from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800",
      textClass: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Não Preenchidos Judit",
      value: stats.juditNaoPreenchido,
      className: "from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-slate-200 dark:border-slate-800",
      textClass: "text-slate-600 dark:text-slate-400",
    },
    {
      label: "Benner Enviado (Sim)",
      value: stats.bennerSim,
      className: "from-cyan-50 to-cyan-100 dark:from-cyan-950/50 dark:to-cyan-900/30 border-cyan-200 dark:border-cyan-800",
      textClass: "text-cyan-600 dark:text-cyan-400",
    },
    {
      label: "Benner Não Enviado",
      value: stats.bennerNao,
      className: "from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800",
      textClass: "text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
      {cards.map((c) => (
        <Card key={c.label} className={cn("bg-gradient-to-br", c.className)}>
          <CardContent className="p-3">
            <p className={cn("text-[11px] md:text-xs font-medium truncate", c.textClass)} title={c.label}>{c.label}</p>
            <p className={cn("text-lg md:text-2xl font-bold mt-1", c.textClass)}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : c.value.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
