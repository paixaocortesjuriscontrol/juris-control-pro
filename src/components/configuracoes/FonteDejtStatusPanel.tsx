/**
 * Painel "Situação da fonte DEJT" — mostra, por tribunal, a edição do caderno
 * Judiciário que o repositório oficial está servindo e o estado dela.
 * Os dados vêm da rotina técnica `alertar-dejt-fonte-atrasada`.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EstadoFonte {
  tribunal: string;
  estado: "em_dia" | "defasada" | "indisponivel" | string;
  edicao: string | null;
  atraso_dias_uteis: number | null;
  updated_at: string;
}

const ROTULOS: Record<string, { label: string; className: string }> = {
  em_dia: { label: "Em dia", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  defasada: { label: "Fonte defasada", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  indisponivel: { label: "Caderno indisponível", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

function ordem(sigla: string): number {
  if (sigla === "TST") return 0;
  const n = Number(sigla.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 99;
}

function dataBr(iso: string | null): string {
  if (!iso) return "não identificada";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function FonteDejtStatusPanel() {
  const { data } = useQuery({
    queryKey: ["fonte-dejt-estado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_dejt_fonte_estado")
        .select("tribunal,estado,edicao,atraso_dias_uteis,updated_at");
      if (error) return [] as EstadoFonte[];
      return ((data || []) as EstadoFonte[]).sort((a, b) => ordem(a.tribunal) - ordem(b.tribunal));
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.length === 0) return null;

  const atualizadoEm = data
    .map((r) => r.updated_at)
    .sort()
    .slice(-1)[0];

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Situação da fonte DEJT (edição servida por tribunal)</span>
        {atualizadoEm && (
          <span className="text-[10px] text-muted-foreground">
            verificado em {new Date(atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {data.map((r) => {
          const rot = ROTULOS[r.estado] ?? { label: r.estado, className: "bg-muted text-muted-foreground" };
          return (
            <div key={r.tribunal} className={cn("rounded border px-2 py-1.5 text-[11px]", rot.className)}>
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold">{r.tribunal}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background/60">{rot.label}</Badge>
              </div>
              <div className="opacity-80">
                {r.estado === "indisponivel" ? "sem caderno Judiciário" : `edição ${dataBr(r.edicao)}`}
                {r.estado === "defasada" && r.atraso_dias_uteis != null && ` • ${r.atraso_dias_uteis} dias úteis`}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        "Fonte defasada" e "caderno indisponível" são limitações do repositório público do DEJT — não são falhas da rotina.
      </p>
    </div>
  );
}
