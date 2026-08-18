import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoEngineLocal =
  | "paralela"
  | "kurier"
  | "processos"
  | "servidor-termos"
  | "servidor-pautas"
  | "stf";

export interface ExecucaoResumo {
  id: string;
  iniciado_em: string;
  tipo: string;
  tipoEngine: TipoEngineLocal;
  /** Rodada servidor encerrada com unidades sem coleta */
  parcial?: boolean;
  unidadesNaoColetadas?: number;
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

const TIPOS_LOCAIS = ["djen_paralela", "djen_processos"] as const;

function mapEngine(tipo: string): TipoEngineLocal {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("kurier")) return "kurier";
  if (t.includes("processo")) return "processos";
  return "paralela";
}

function mapEngineServidor(tipo: string): TipoEngineLocal {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("stf")) return "stf";
  return t.includes("pauta") ? "servidor-pautas" : "servidor-termos";
}

// Ordem visual desejada: Termos (paralela local + servidor-termos), depois Pautas, depois STF.
// Kurier/Processos ficam ao final se aparecerem (não devem, pois Kurier é filtrado e processos
// é raro nesse dashboard, mas mantemos por segurança).
function grupoOrdem(t: TipoEngineLocal): number {
  switch (t) {
    case "paralela":
    case "servidor-termos":
      return 0; // Termos
    case "servidor-pautas":
      return 1; // Pautas
    case "stf":
      return 2; // STF
    case "processos":
      return 3;
    case "kurier":
    default:
      return 4;
  }
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
      // Janela BRT (UTC-3) do dia — usada para execuções locais (agendadas)
      const startUtc = `${ymd}T03:00:00`;
      const endDate = new Date(`${ymd}T00:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const nextYmd = endDate.toISOString().slice(0, 10);
      const endUtc = `${nextYmd}T03:00:00`;

      // 1a) Execuções LOCAIS do dia
      const [{ data: execsLocal, error: execErrLocal }, { data: execsServ, error: execErrServ }] =
        await Promise.all([
          (supabase.from("execucoes_agendadas") as any)
            .select("id, tipo, iniciado_em")
            .in("tipo", TIPOS_LOCAIS as unknown as string[])
            .gte("iniciado_em", startUtc)
            .lt("iniciado_em", endUtc)
            .order("iniciado_em", { ascending: true }),
          // 1b) Execuções SERVIDOR do dia (mesma janela BRT)
          (supabase.from("execucoes_servidor") as any)
            .select("id, tipo, iniciado_em, resultado, status")
            .gte("iniciado_em", startUtc)
            .lt("iniciado_em", endUtc)
            .in("status", ["concluido", "concluido_parcial"])
            .order("iniciado_em", { ascending: true }),
        ]);

      if (execErrLocal) {
        console.error("[execucoes-do-dia-por-coordenacao] execs locais", execErrLocal);
      }
      if (execErrServ) {
        console.error("[execucoes-do-dia-por-coordenacao] execs servidor", execErrServ);
      }

      type ExecInterna = {
        id: string;
        iniciado_em: string;
        tipo: string;
        tipoEngine: TipoEngineLocal;
        fonte: "local" | "servidor";
        parcial?: boolean;
        unidadesNaoColetadas?: number;
      };

      const locais: ExecInterna[] = (execsLocal || []).map((e: any) => ({
        id: e.id as string,
        iniciado_em: e.iniciado_em as string,
        tipo: e.tipo as string,
        tipoEngine: mapEngine(e.tipo),
        fonte: "local",
      })).filter((e) => e.tipoEngine !== "kurier");

      // Filtra servidor cujo resultado.dataInicio bate com o ymd (quando disponível)
      const servidor: ExecInterna[] = (execsServ || [])
        .filter((e: any) => {
          const di = e?.resultado?.dataInicio as string | undefined;
          return !di || di === ymd;
        })
        .map((e: any) => ({
          id: e.id as string,
          iniciado_em: e.iniciado_em as string,
          tipo: e.tipo as string,
          tipoEngine: mapEngineServidor(e.tipo),
          fonte: "servidor",
          unidadesNaoColetadas: Number(
            e?.resultado?.unidades_nao_coletadas ??
              e?.resultado?.diagnostico?.unidades_nao_coletadas ??
              0,
          ),
          parcial:
            e.status === "concluido_parcial" ||
            Number(
              e?.resultado?.unidades_nao_coletadas ??
                e?.resultado?.diagnostico?.unidades_nao_coletadas ??
                0,
            ) > 0,
        }));

      // Ordenação: grupo (Termos → Pautas → STF) e, dentro do grupo, cronológica.
      const todas: ExecInterna[] = [...locais, ...servidor].sort((a, b) => {
        const ga = grupoOrdem(a.tipoEngine);
        const gb = grupoOrdem(b.tipoEngine);
        if (ga !== gb) return ga - gb;
        return a.iniciado_em < b.iniciado_em ? -1 : a.iniciado_em > b.iniciado_em ? 1 : 0;
      });

      if (todas.length === 0) return { execucoes: [], linhas: [] };

      const execOrdemById = new Map<string, number>();
      todas.forEach((e, idx) => execOrdemById.set(e.id, idx));

      // 2) Junções (paralelas) — pubId prefixado por fonte para evitar colisão
      const localExecIds = locais.map((e) => e.id);
      const servExecIds = servidor.map((e) => e.id);

      const [junLocal, junServ] = await Promise.all([
        localExecIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : (supabase.from("publicacoes_djen_execucoes") as any)
              .select(
                "publicacao_id, execucao_id, publicacao:publicacoes_djen!inner(id, monitoramento:monitoramentos_djen!inner(coordenacao_id))",
              )
              .in("execucao_id", localExecIds),
        servExecIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : (supabase.from("publicacoes_djen_servidor_execucoes") as any)
              .select(
                "publicacao_id, execucao_id, publicacao:publicacoes_djen_servidor!inner(id, coordenacao_id)",
              )
              .in("execucao_id", servExecIds),
      ]);

      if ((junLocal as any).error) {
        console.error("[execucoes-do-dia-por-coordenacao] junção local", (junLocal as any).error);
      }
      if ((junServ as any).error) {
        console.error("[execucoes-do-dia-por-coordenacao] junção servidor", (junServ as any).error);
      }

      // Map: coordId -> pubKey (prefix:fonte:pubId) -> Set<execId>
      const porCoordPub = new Map<string, Map<string, Set<string>>>();
      const coordIds = new Set<string>();

      const consumirLinhas = (
        rows: any[],
        extractCoord: (r: any) => string | null | undefined,
        prefix: "L" | "S",
      ) => {
        for (const r of rows || []) {
          const execId = r.execucao_id as string;
          const pubId = r.publicacao_id as string;
          const coordId = extractCoord(r);
          if (!coordId) continue;
          coordIds.add(coordId);
          if (!porCoordPub.has(coordId)) porCoordPub.set(coordId, new Map());
          const byPub = porCoordPub.get(coordId)!;
          const key = `${prefix}:${pubId}`;
          if (!byPub.has(key)) byPub.set(key, new Set());
          byPub.get(key)!.add(execId);
        }
      };

      consumirLinhas(
        (junLocal as any).data || [],
        (r: any) => r.publicacao?.monitoramento?.coordenacao_id,
        "L",
      );
      consumirLinhas(
        (junServ as any).data || [],
        (r: any) => r.publicacao?.coordenacao_id,
        "S",
      );

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

        const celulas: Celula[] = todas.map((e, idx) => ({
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
        execucoes: todas.map((e) => ({
          id: e.id,
          iniciado_em: e.iniciado_em,
          tipo: e.tipo,
          tipoEngine: e.tipoEngine,
          parcial: e.parcial,
          unidadesNaoColetadas: e.unidadesNaoColetadas,
        })),
        linhas,
      };
    },
  });
}