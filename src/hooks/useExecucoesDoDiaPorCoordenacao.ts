import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoEngineLocal = "paralela" | "kurier" | "processos";

export interface ExecucaoResumo {
  id: string;
  iniciado_em: string;
  tipo: string;
  tipoEngine: TipoEngineLocal;
}

export interface Celula {
  execId: string;
  total: number;
  novas: number;
  primeiraNaCoord: boolean;
}

export interface LinhaCoordenacao {
  coordenacaoId: string;
  nome: string;
  celulas: Celula[];
  totalGeral: number;
  novasGeral: number;
}

export interface ExecucoesDoDiaPorCoordenacao {
  execucoes: ExecucaoResumo[];
  linhas: LinhaCoordenacao[];
}

const TIPOS_LOCAIS = ["djen_paralela", "djen_kurier", "djen_processos"] as const;

function mapEngine(tipo: string): TipoEngineLocal {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("kurier")) return "kurier";
  if (t.includes("processo")) return "processos";
  return "paralela";
}

/**
 * Retorna a comparação das execuções DJEN locais do dia por coordenação.
 * Para cada (coordenação, execução): total de publicações vistas e quantas
 * dessas publicações apareceram pela 1ª vez naquela execução (dentro daquela
 * coordenação, considerando a ordem cronológica das execuções do dia).
 */
export function useExecucoesDoDiaPorCoordenacao(
  dataYmd: string | null | undefined,
) {
  const ymd = (dataYmd || "").slice(0, 10);
  const enabled = !!ymd;

  return useQuery({
    queryKey: ["execucoes-do-dia-por-coordenacao", ymd],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ExecucoesDoDiaPorCoordenacao> => {
      // Janela BRT (UTC-3) do dia
      const startUtc = `${ymd}T03:00:00`;
      const endDate = new Date(`${ymd}T00:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const nextYmd = endDate.toISOString().slice(0, 10);
      const endUtc = `${nextYmd}T03:00:00`;

      const { data: execs, error: execErr } = await (supabase
        .from("execucoes_agendadas") as any)
        .select("id, tipo, iniciado_em")
        .in("tipo", TIPOS_LOCAIS as unknown as string[])
        .gte("iniciado_em", startUtc)
        .lt("iniciado_em", endUtc)
        .order("iniciado_em", { ascending: true });

      if (execErr) {
        console.error("[execucoes-do-dia-por-coordenacao] execs", execErr);
        return { execucoes: [], linhas: [] };
      }
      if (!execs || execs.length === 0) return { execucoes: [], linhas: [] };

      const execIds = execs.map((e: any) => e.id as string);
      const execOrdemById = new Map<string, number>();
      execs.forEach((e: any, idx: number) => execOrdemById.set(e.id, idx));

      // Junção publicação × execução com coordenação (sem filtrar por coord).
      const { data: rows, error: junErr } = await (supabase
        .from("publicacoes_djen_execucoes") as any)
        .select(
          "publicacao_id, execucao_id, publicacao:publicacoes_djen!inner(id, monitoramento:monitoramentos_djen!inner(coordenacao_id))",
        )
        .in("execucao_id", execIds);

      if (junErr) {
        console.error("[execucoes-do-dia-por-coordenacao] junção", junErr);
        return {
          execucoes: execs.map((e: any) => ({
            id: e.id,
            iniciado_em: e.iniciado_em,
            tipo: e.tipo,
            tipoEngine: mapEngine(e.tipo),
          })),
          linhas: [],
        };
      }

      // Map: coordId -> pubId -> Set<execId>
      const porCoordPub = new Map<string, Map<string, Set<string>>>();
      const coordIds = new Set<string>();

      for (const r of rows || []) {
        const execId = r.execucao_id as string;
        const pubId = r.publicacao_id as string;
        const coordId = r.publicacao?.monitoramento?.coordenacao_id as
          | string
          | null
          | undefined;
        if (!coordId) continue;
        coordIds.add(coordId);
        if (!porCoordPub.has(coordId)) porCoordPub.set(coordId, new Map());
        const byPub = porCoordPub.get(coordId)!;
        if (!byPub.has(pubId)) byPub.set(pubId, new Set());
        byPub.get(pubId)!.add(execId);
      }

      // Nomes de coordenações
      const coordIdArr = Array.from(coordIds);
      let coordNomes = new Map<string, string>();
      if (coordIdArr.length > 0) {
        const { data: coords } = await (supabase
          .from("coordenacoes") as any)
          .select("id, nome")
          .in("id", coordIdArr);
        for (const c of coords || []) {
          coordNomes.set(c.id as string, (c.nome as string) || "-");
        }
      }

      // Agrega células por (coord, exec)
      const linhas: LinhaCoordenacao[] = coordIdArr.map((coordId) => {
        const byPub = porCoordPub.get(coordId)!;
        const totalPorExec = new Map<string, number>();
        const novasPorExec = new Map<string, number>();

        for (const [, execSet] of byPub) {
          // 1ª execução do dia (nessa coord) que viu essa publicação
          let firstExec: string | null = null;
          let firstIdx = Number.POSITIVE_INFINITY;
          for (const eid of execSet) {
            const idx = execOrdemById.get(eid);
            if (idx == null) continue;
            if (idx < firstIdx) {
              firstIdx = idx;
              firstExec = eid;
            }
            totalPorExec.set(eid, (totalPorExec.get(eid) || 0) + 1);
          }
          if (firstExec) {
            novasPorExec.set(firstExec, (novasPorExec.get(firstExec) || 0) + 1);
          }
        }

        const celulas: Celula[] = execs.map((e: any, idx: number) => ({
          execId: e.id,
          total: totalPorExec.get(e.id) || 0,
          novas: novasPorExec.get(e.id) || 0,
          primeiraNaCoord: idx === 0,
        }));

        const totalGeral = celulas.reduce((a, c) => a + c.total, 0);
        const novasGeral = celulas.reduce((a, c) => a + c.novas, 0);

        return {
          coordenacaoId: coordId,
          nome: coordNomes.get(coordId) || "(sem nome)",
          celulas,
          totalGeral,
          novasGeral,
        };
      });

      linhas.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
      );

      return {
        execucoes: execs.map((e: any) => ({
          id: e.id,
          iniciado_em: e.iniciado_em,
          tipo: e.tipo,
          tipoEngine: mapEngine(e.tipo),
        })),
        linhas,
      };
    },
  });
}