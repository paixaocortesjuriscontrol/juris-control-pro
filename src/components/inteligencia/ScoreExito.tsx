import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

interface Score { score: number | null; amostra: number | null; nivel: string | null; confianca: "alta" | "media" | "baixa" | null; niveis: { nivel: string; n: number; taxa: number }[] | null }

const confLabel = { alta: "Confiança alta", media: "Confiança média", baixa: "Confiança baixa" } as const;

export function ScoreExito({ turma, relator, tipoRecurso }: { turma?: string | null; relator?: string | null; tipoRecurso?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["score-exito", turma || "", relator || "", tipoRecurso || ""],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_inteligencia_score_exito", {
        p_turma: turma || null, p_relator: relator || null, p_tipo_recurso: tipoRecurso || null,
      });
      if (error) throw error;
      return data as Score;
    },
    staleTime: 300000,
  });

  if (isLoading) return <span className="text-xs text-muted-foreground">Calculando…</span>;
  if (!data || data.score == null) return <span className="text-xs text-muted-foreground">Sem histórico suficiente</span>;

  const cor = data.score >= 60 ? "text-emerald-500" : data.score >= 40 ? "text-amber-500" : "text-red-500";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-2 cursor-help">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className={`text-sm font-semibold ${cor}`}>{data.score}%</span>
            <Badge variant="outline" className="text-[10px] font-normal">{data.confianca ? confLabel[data.confianca] : ""}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <div className="font-medium mb-1">Sugestão calculada pelo histórico (o valor manual tem prioridade)</div>
          <div>Base usada: {data.nivel} — {data.amostra} decisões</div>
          {(data.niveis || []).map((n) => <div key={n.nivel} className="text-muted-foreground">{n.nivel}: {n.taxa}% ({n.n})</div>)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
