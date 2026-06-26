import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoEngineLocal = "paralela" | "kurier" | "processos";

export interface ExecucaoLocalDoDia {
  id: string;
  started_at: string;
  tipo: string;
  tipoEngine: TipoEngineLocal;
  totalVistas: number;
  novasIds: string[];
  novasCount: number;
  primeiraDoDia: boolean;
}

const TIPOS_LOCAIS = ["djen_paralela", "djen_kurier", "djen_processos"] as const;

function mapEngine(tipo: string): TipoEngineLocal {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("kurier")) return "kurier";
  if (t.includes("processo")) return "processos";
  return "paralela";
}

/**
 * Espelha `useExecucoesDoDiaServidor` mas para o DJEN Local.
 * Lê `execucoes_agendadas` (tipo ∈ paralela/kurier/processos) e a tabela
 * de junção `publicacoes_djen_execucoes` para calcular, por execução do
 * dia, total de publicações vistas e quantas são novas (primeira vez
 * vistas nessa execução vs. execuções anteriores do mesmo dia).
 */
export function useExecucoesDoDiaLocal(
  coordenacaoId: string | null | undefined,
  dataDisponibilizacao: string | null | undefined,
) {
  const ymd = (dataDisponibilizacao || "").slice(0, 10);
  const enabled = !!ymd;

  return useQuery({
    queryKey: ["execucoes-do-dia-local", ymd, coordenacaoId || "__all__"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ExecucaoLocalDoDia[]> => {
      // 1) Execuções locais concluídas (ou executando) do dia
      const { data: execs, error: execErr } = await (supabase
        .from("execucoes_agendadas") as any)
        .select("id, tipo, iniciado_em, status")
        .in("tipo", TIPOS_LOCAIS as unknown as string[])
        .gte("iniciado_em", `${ymd}T00:00:00`)
        .lte("iniciado_em", `${ymd}T23:59:59`)
        .order("iniciado_em", { ascending: true });

      if (execErr) {
        console.error("[execucoes-do-dia-local] erro execucoes_agendadas", execErr);
        return [];
      }
      if (!execs || execs.length === 0) return [];

      const execIds = execs.map((e: any) => e.id);

      // 2) Junção publicação×execução restrita às execuções do dia, com join
      //    na publicação para aplicar coordenação e descobrir a 1ª execução
      //    que viu cada publicação (execucao_id na própria publicacoes_djen).
      let q: any = (supabase
        .from("publicacoes_djen_execucoes") as any)
        .select(
          "publicacao_id, execucao_id, publicacao:publicacoes_djen!inner(id, execucao_id, monitoramento:monitoramentos_djen!inner(coordenacao_id))",
        )
        .in("execucao_id", execIds);

      if (coordenacaoId) {
        q = q.eq("publicacao.monitoramento.coordenacao_id", coordenacaoId);
      }

      const { data: rows, error: junErr } = await q;
      if (junErr) {
        console.error("[execucoes-do-dia-local] erro junção", junErr);
        return [];
      }

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

      return execs.map((e: any, idx: number): ExecucaoLocalDoDia => {
        const novasIds = novasByExec.get(e.id) || [];
        return {
          id: e.id,
          started_at: e.iniciado_em,
          tipo: e.tipo,
          tipoEngine: mapEngine(e.tipo),
          totalVistas: totalsByExec.get(e.id) || 0,
          novasIds,
          novasCount: novasIds.length,
          primeiraDoDia: idx === 0,
        };
      });
    },
  });
}