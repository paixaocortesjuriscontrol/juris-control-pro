import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExecucaoDoDia {
  id: string;
  started_at: string;
  tipo: string;
  tipoEngine: "paralela" | "pautas";
  /** Total de publicações vistas por esta execução (inclui duplicatas) */
  totalVistas: number;
  /** Publicações que apareceram pela 1ª vez nesta execução (vs. execuções anteriores do mesmo dia) */
  novasIds: string[];
  /** Total de novas — atalho */
  novasCount: number;
  /** Indica se é a primeira execução do dia (não há comparação) */
  primeiraDoDia: boolean;
  /** Rodada encerrada com unidades (tribunal × monitoramento) sem coleta */
  parcial: boolean;
  /** Quantas unidades ficaram sem coleta nessa rodada */
  unidadesNaoColetadas: number;
}

/**
 * Lista execuções servidor (Termos/Pautas) de uma data_disponibilizacao
 * e calcula, para cada execução, quantas publicações são "novas" em
 * relação às execuções cronologicamente anteriores do mesmo dia.
 *
 * Respeita o filtro de coordenação (quando informado).
 */
export function useExecucoesDoDiaServidor(
  coordenacaoId: string | null | undefined,
  dataDisponibilizacao: string | null | undefined,
) {
  const ymd = (dataDisponibilizacao || "").slice(0, 10);
  const enabled = !!ymd;

  return useQuery({
    queryKey: ["execucoes-do-dia-servidor", ymd, coordenacaoId || "__all__"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ExecucaoDoDia[]> => {
      // 1) Execuções servidor do dia (Termos = paralela, Pautas = pautas)
      const { data: execs, error: execErr } = await (supabase
        .from("execucoes_servidor") as any)
        .select("id, tipo, iniciado_em, resultado, status")
        .gte("iniciado_em", `${ymd}T00:00:00`)
        .lte("iniciado_em", `${ymd}T23:59:59`)
        .in("status", ["concluido", "concluido_parcial"])
        .order("iniciado_em", { ascending: true });

      if (execErr) {
        console.error("[execucoes-do-dia] erro execucoes_servidor", execErr);
        return [];
      }
      if (!execs || execs.length === 0) return [];
      // Filtra execuções cuja dataInicio do resultado bate com ymd (quando disponível).
      const execsDoDia = execs.filter((e: any) => {
        const di = e?.resultado?.dataInicio as string | undefined;
        return !di || di === ymd;
      });
      if (execsDoDia.length === 0) return [];

      const execIds = execsDoDia.map((e: any) => e.id);

      // 2) Junção publicação×execução (limitada às execuções do dia),
      //    com join na publicação para aplicar coordenação e obter
      //    o execucao_id "de primeira vista" (gravado na linha).
      let q: any = (supabase
        .from("publicacoes_djen_servidor_execucoes") as any)
        .select(
          "publicacao_id, execucao_id, publicacao:publicacoes_djen_servidor!inner(id, coordenacao_id, execucao_id)",
        )
        .in("execucao_id", execIds);

      if (coordenacaoId) {
        q = q.eq("publicacao.coordenacao_id", coordenacaoId);
      }

      const { data: rows, error: junErr } = await q;
      if (junErr) {
        console.error("[execucoes-do-dia] erro junção", junErr);
        return [];
      }

      // 3) Agrega por execução
      const totalsByExec = new Map<string, number>();
      const novasByExec = new Map<string, string[]>();

      for (const r of rows || []) {
        const execId = r.execucao_id as string;
        const pubId = r.publicacao_id as string;
        const pubFirstExec = r.publicacao?.execucao_id as string | null;

        totalsByExec.set(execId, (totalsByExec.get(execId) || 0) + 1);
        if (pubFirstExec && pubFirstExec === execId) {
          if (!novasByExec.has(execId)) novasByExec.set(execId, []);
          novasByExec.get(execId)!.push(pubId);
        }
      }

      // 4) Monta resultado em ordem cronológica
      return execsDoDia.map((e: any, idx: number): ExecucaoDoDia => {
        const tipoRaw = String(e.tipo || "").toLowerCase();
        const tipoEngine: "paralela" | "pautas" = tipoRaw.includes("pauta") ? "pautas" : "paralela";
        const novasIds = novasByExec.get(e.id) || [];
        const naoColetadas = Number(
          e?.resultado?.unidades_nao_coletadas ??
            e?.resultado?.diagnostico?.unidades_nao_coletadas ??
            0,
        );
        return {
          id: e.id,
          started_at: e.iniciado_em,
          tipo: e.tipo,
          tipoEngine,
          totalVistas: totalsByExec.get(e.id) || 0,
          novasIds,
          novasCount: novasIds.length,
          primeiraDoDia: idx === 0,
          parcial: e.status === "concluido_parcial" || naoColetadas > 0,
          unidadesNaoColetadas: naoColetadas,
        };
      });
    },
  });
}
