import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { DistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { cn } from "@/lib/utils";

export type StatsCardKey =
  | "total"
  | "aFazer"
  | "naoPrecisaFazer"
  | "processosUnicos"
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
  | "semTurma"
  | "problemaJudit"
  | "ate2025"
  | "de2026"
  | "prontoEnvio"
  | "prontoSemPendencia"
  | "prontoComPendencia"
  | "semResponsavel"
  | "comEquipe"
  | "semEquipe"
  | "multiResp";


interface Props {
  stats: DistribuicaoTstStats;
  loading: boolean;
  activeKey?: StatsCardKey | null;
  onCardClick?: (key: StatsCardKey) => void;
  /** Totais do responsável logado, exibido logo após o card "Total de Processos". */
  responsavelCard?: { atribuidos: number; prontos: number; nome?: string } | null;
  /** Callback ao clicar no card "Total por responsável" — filtra a lista
   *  para mostrar apenas os Prontos do responsável logado. */
  onResponsavelClick?: () => void;
  /** Card "Mais de um responsável" — quantidade de processos com >1 responsável. */
  multiRespCard?: { count: number; active: boolean; onClick: () => void } | null;
  /** Contagem de processos "Pronto para Enviar" sem pendências (computado no
   *  cliente, respeita todos os filtros/cards ativos). */
  prontoSemPendencia?: { count: number; loading: boolean } | null;
  /** Contagem de processos marcados como prontos que AINDA têm pendências. */
  prontoComPendencia?: { count: number; loading: boolean } | null;
}

interface CardDef {
  key: StatsCardKey;
  label: string;
  value: number;
  className: string;
  textClass: string;
  /** Texto opcional exibido no tooltip do card. */
  hint?: string;
}

export function DistribuicaoTstStatsCards({ stats, loading, activeKey, onCardClick, responsavelCard, onResponsavelClick, multiRespCard, prontoSemPendencia, prontoComPendencia }: Props) {

  const cards: CardDef[] = [
    // Azuis / Ciano / Teal / Sky
    { key: "total", label: "Total Geral", value: stats.total, className: "from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800", textClass: "text-blue-600 dark:text-blue-400" },
    { key: "ate2025", label: "Até 2025", value: stats.ate2025, className: "from-sky-50 to-sky-100 dark:from-sky-950/50 dark:to-sky-900/30 border-sky-200 dark:border-sky-800", textClass: "text-sky-600 dark:text-sky-400" },
    { key: "de2026", label: "2026 em diante", value: stats.de2026, className: "from-violet-50 to-violet-100 dark:from-violet-950/50 dark:to-violet-900/30 border-violet-200 dark:border-violet-800", textClass: "text-violet-600 dark:text-violet-400" },
    { key: "aFazer", label: "A fazer", value: stats.aFazer, className: "from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30 border-indigo-300 dark:border-indigo-700", textClass: "text-indigo-700 dark:text-indigo-300" },
    { key: "naoPrecisaFazer", label: "Não precisa fazer", value: stats.naoPrecisaFazer, className: "from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-slate-300 dark:border-slate-700", textClass: "text-slate-700 dark:text-slate-300" },
    { key: "bennerSim", label: "Benner Enviado / Não", value: stats.bennerSim, className: "from-cyan-50 to-cyan-100 dark:from-cyan-950/50 dark:to-cyan-900/30 border-cyan-200 dark:border-cyan-800", textClass: "text-cyan-600 dark:text-cyan-400" },
    { key: "prontoEnvio", label: "Concluídos (prontos/planilhados)", value: stats.prontoEnvio, hint: `${stats.prontoEnvioPuro.toLocaleString("pt-BR")} prontos, ${stats.planilhado.toLocaleString("pt-BR")} planilhados, ${stats.enviado.toLocaleString("pt-BR")} enviados`, className: "from-teal-50 to-teal-100 dark:from-teal-950/50 dark:to-teal-900/30 border-teal-200 dark:border-teal-800", textClass: "text-teal-600 dark:text-teal-400" },
    ...(prontoSemPendencia
      ? [{
          key: "prontoSemPendencia" as StatsCardKey,
          label: "Pronto sem pendência",
          value: prontoSemPendencia.count,
          className: "from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800",
          textClass: "text-emerald-700 dark:text-emerald-400",
        }]
      : []),
    // Roxos / Violeta
    { key: "processosUnicos", label: "Processos Únicos", value: stats.processosUnicos, className: "from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30 border-indigo-200 dark:border-indigo-800", textClass: "text-indigo-600 dark:text-indigo-400" },
    { key: "juditPreenchido", label: "Judit Preenchido / Não", value: stats.juditPreenchido, className: "from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800", textClass: "text-purple-600 dark:text-purple-400" },
    // Verdes
    { key: "processosValidos", label: "Processos nº CNJ válidos", value: stats.processosValidos, className: "from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800", textClass: "text-emerald-600 dark:text-emerald-400" },
    { key: "dossiesValidos", label: "Dossiês Válidos", value: stats.dossiesValidos, className: "from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800", textClass: "text-emerald-600 dark:text-emerald-400" },
    { key: "processosAtivos", label: "Processos Ativos", value: stats.processosAtivos, className: "from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800", textClass: "text-green-600 dark:text-green-400" },
    { key: "comEquipe", label: "Com / Sem Equipe", value: stats.comEquipe, className: "from-lime-50 to-lime-100 dark:from-lime-950/50 dark:to-lime-900/30 border-lime-200 dark:border-lime-800", textClass: "text-lime-700 dark:text-lime-400" },
    ...(prontoComPendencia
      ? [{
          key: "prontoComPendencia" as StatsCardKey,
          label: "Pronto com pendência",
          value: prontoComPendencia.count,
          hint: "Processos marcados como prontos que ainda têm pendências",
          className: "from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800",
          textClass: "text-orange-700 dark:text-orange-400",
        }]
      : []),
    // Amarelos / Laranja
    { key: "transitoJulgado", label: "Trânsito em Julgado", value: stats.transitoJulgado, className: "from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800", textClass: "text-amber-600 dark:text-amber-400" },
    { key: "problemaJudit", label: "Problema Judit", value: stats.problemaJudit, className: "from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800", textClass: "text-amber-700 dark:text-amber-400" },
    // Vermelhos / Rosas (última fileira)
    { key: "processosInvalidos", label: "Processos Inválidos", value: stats.processosInvalidos, className: "from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800", textClass: "text-rose-600 dark:text-rose-400" },
    { key: "semTurma", label: "Sem Turma", value: stats.semTurma, className: "from-pink-50 to-pink-100 dark:from-pink-950/50 dark:to-pink-900/30 border-pink-200 dark:border-pink-800", textClass: "text-pink-600 dark:text-pink-400" },
    { key: "semResponsavel", label: "Sem Responsável", value: stats.semResponsavel, className: "from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800", textClass: "text-red-600 dark:text-red-400" },
    { key: "comEquipe", label: "Com / Sem Equipe", value: stats.comEquipe, className: "from-lime-50 to-lime-100 dark:from-lime-950/50 dark:to-lime-900/30 border-lime-200 dark:border-lime-800", textClass: "text-lime-700 dark:text-lime-400" },
  ];
  if (multiRespCard) {

    cards.push({
      key: "multiResp",
      label: "Mais de um responsável",
      value: multiRespCard.count,
      className: "from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-950/50 dark:to-fuchsia-900/30 border-fuchsia-300 dark:border-fuchsia-700",
      textClass: "text-fuchsia-700 dark:text-fuchsia-400",
    });
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 md:gap-2">
      {cards.map((c) => {
        const isActive = activeKey === c.key;
        const clickable = !!onCardClick;
        // Helper: render a "Sim / Não" combined card with two clickable values
        const renderCombined = (opts: {
          keyId: string;
          title: string;
          containerClass: string;
          leftKey: StatsCardKey;
          leftValue: number;
          leftLabel: string;
          leftColor: string;
          rightKey: StatsCardKey;
          rightValue: number;
          rightLabel: string;
          rightColor: string;
        }) => {
          const lActive = activeKey === opts.leftKey;
          const rActive = activeKey === opts.rightKey;
          return (
            <Card
              key={opts.keyId}
              className={cn(
                "bg-gradient-to-br transition-all",
                opts.containerClass,
                (lActive || rActive) && "ring-2 ring-primary ring-offset-1"
              )}
              title="Clique nos números para filtrar"
            >
              <CardContent className="p-2">
                <p className={cn("text-[8px] md:text-[10px] font-medium truncate leading-tight", opts.leftColor)} title={opts.title}>
                  {opts.title}
                </p>
                <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onCardClick?.(opts.leftKey)}
                    className={cn("flex items-baseline gap-1 cursor-pointer hover:opacity-80 transition-opacity", lActive && "underline")}
                  >
                    <span className={cn("text-sm md:text-base font-bold leading-tight tabular-nums", opts.leftColor)}>
                      {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : opts.leftValue.toLocaleString("pt-BR")}
                    </span>
                    <span className={cn("text-[8px] opacity-70", opts.leftColor)}>{opts.leftLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCardClick?.(opts.rightKey)}
                    className={cn("flex items-baseline gap-1 cursor-pointer hover:opacity-80 transition-opacity", rActive && "underline")}
                  >
                    <span className={cn("text-sm md:text-base font-bold leading-tight tabular-nums", opts.rightColor)}>
                      {loading ? "" : opts.rightValue.toLocaleString("pt-BR")}
                    </span>
                    <span className={cn("text-[8px] opacity-70", opts.rightColor)}>{opts.rightLabel}</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        };
        if (c.key === "juditPreenchido") {
          return renderCombined({
            keyId: "juditCombined",
            title: "Judit Preenchido / Não",
            containerClass: "from-purple-50 to-slate-50 dark:from-purple-950/40 dark:to-slate-950/40 border-purple-200 dark:border-purple-800",
            leftKey: "juditPreenchido", leftValue: stats.juditPreenchido, leftLabel: "sim",
            leftColor: "text-purple-700 dark:text-purple-400",
            rightKey: "juditNaoPreenchido", rightValue: stats.juditNaoPreenchido, rightLabel: "não",
            rightColor: "text-slate-700 dark:text-slate-400",
          });
        }
        if (c.key === "comEquipe") {
          return renderCombined({
            keyId: "equipeCombined",
            title: "Com / Sem Equipe",
            containerClass: "from-lime-50 to-fuchsia-50 dark:from-lime-950/40 dark:to-fuchsia-950/40 border-lime-200 dark:border-lime-800",
            leftKey: "comEquipe", leftValue: stats.comEquipe, leftLabel: "com",
            leftColor: "text-lime-700 dark:text-lime-400",
            rightKey: "semEquipe", rightValue: stats.semEquipe, rightLabel: "sem",
            rightColor: "text-fuchsia-700 dark:text-fuchsia-400",
          });
        }
        if (c.key === "dossiesValidos") {
          return renderCombined({
            keyId: "dossiesCombined",
            title: "Dossiês Válidos / Inválidos",
            containerClass: "from-emerald-50 to-rose-50 dark:from-emerald-950/40 dark:to-rose-950/40 border-emerald-200 dark:border-emerald-800",
            leftKey: "dossiesValidos", leftValue: stats.dossiesValidos, leftLabel: "válidos",
            leftColor: "text-emerald-700 dark:text-emerald-400",
            rightKey: "dossiesInvalidos", rightValue: stats.dossiesInvalidos + stats.dossiesNaoPreenchidos, rightLabel: "inválidos",
            rightColor: "text-rose-700 dark:text-rose-400",
          });
        }
        if (c.key === "bennerSim") {
          const simActive = activeKey === "bennerSim";
          const naoActive = activeKey === "bennerNao";
          return (
            <Card
              key="bennerCombined"
              className={cn(
                "bg-gradient-to-br transition-all",
                "from-cyan-50 to-orange-50 dark:from-cyan-950/40 dark:to-orange-950/40 border-cyan-200 dark:border-cyan-800",
                (simActive || naoActive) && "ring-2 ring-primary ring-offset-1"
              )}
              title="Clique nos números para filtrar"
            >
              <CardContent className="p-2">
                <p className="text-[8px] md:text-[10px] font-medium truncate leading-tight text-cyan-700 dark:text-cyan-400" title="Benner Enviado / Não Enviado">
                  Benner Enviado / Não
                </p>
                <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onCardClick?.("bennerSim")}
                    className={cn(
                      "flex items-baseline gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                      simActive && "underline"
                    )}
                    title="Filtrar Benner Enviado"
                  >
                    <span className="text-sm md:text-base font-bold leading-tight text-cyan-700 dark:text-cyan-400 tabular-nums">
                      {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : stats.bennerSim.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[8px] text-cyan-700/70 dark:text-cyan-400/70">sim</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCardClick?.("bennerNao")}
                    className={cn(
                      "flex items-baseline gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                      naoActive && "underline"
                    )}
                    title="Filtrar Benner Não Enviado"
                  >
                    <span className="text-sm md:text-base font-bold leading-tight text-orange-700 dark:text-orange-400 tabular-nums">
                      {loading ? "" : stats.bennerNao.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[8px] text-orange-700/70 dark:text-orange-400/70">não</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        }
        const cardNode = (
          <Card
            key={c.key}
            onClick={clickable ? () => onCardClick?.(c.key) : undefined}
            className={cn(
              "bg-gradient-to-br transition-all",
              c.className,
              clickable && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
              isActive && "ring-2 ring-primary ring-offset-1"
            )}
            title={c.hint ? (clickable ? `${c.hint} — clique para filtrar` : c.hint) : clickable ? "Clique para filtrar" : undefined}
          >
            <CardContent className="p-2">
              <p className={cn("text-[8px] md:text-[10px] font-medium truncate leading-tight", c.textClass)} title={c.hint || c.label}>{c.label}</p>
              <p className={cn("text-sm md:text-base font-bold mt-0.5 leading-tight", c.textClass)}>
                {(c.key === "prontoSemPendencia" ? (prontoSemPendencia?.loading ?? false) : loading)
                  ? <Loader2 className="w-3 h-3 animate-spin inline" />
                  : c.value.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        );
        if (c.key === "total" && responsavelCard) {
          return (
            <div key="__total_plus_resp__" className="contents">
              {cardNode}
              <Card
                key="__resp_card__"
                onClick={onResponsavelClick}
                className={cn(
                  "bg-gradient-to-br transition-all",
                  "from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800",
                  onResponsavelClick && "cursor-pointer hover:shadow-md hover:scale-[1.02]"
                )}
                title={onResponsavelClick ? "Clique para listar apenas seus Prontos" : "Totais do responsável logado"}
              >
                <CardContent className="p-2">
                  <p className="text-[8px] md:text-[10px] font-medium truncate leading-tight text-amber-700 dark:text-amber-400">
                    {responsavelCard.nome ? `Total · ${responsavelCard.nome}` : "Total por responsável"}
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-baseline gap-1">
                      <span className="text-sm md:text-base font-bold leading-tight text-amber-700 dark:text-amber-400 tabular-nums">
                        {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : responsavelCard.atribuidos.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[8px] text-amber-700/70 dark:text-amber-400/70">atrib.</span>
                    </span>
                    <span className="flex items-baseline gap-1">
                      <span className="text-sm md:text-base font-bold leading-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {loading ? "" : responsavelCard.prontos.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[8px] text-emerald-700/70 dark:text-emerald-400/70">prontos</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        }
        return cardNode;
      })}
    </div>
  );
}
