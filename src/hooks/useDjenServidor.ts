import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Converte YYYY-MM-DD (dia BRT) para UTC. As telas de Análise DJEN usam
// created_at/captura em BRT quando o usuário filtra "hoje"/período; o
// comparador precisa usar a mesma janela para não comparar com
// data_disponibilizacao e mostrar números menores/diferentes.
const dateLocalToUTCRange = (dateStr: string, isEnd: boolean): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (isEnd) {
    const nextDay = new Date(year, month - 1, day + 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}T02:59:59.999Z`;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T03:00:00Z`;
};

export interface ConfigServidor {
  id: string;
  tipo: string;
  frequencia: string;
  ativo: boolean;
  horarios_execucao: string[] | null;
  ultima_execucao: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ExecucaoServidor {
  id: string;
  tipo: string;
  status: string;
  agendado_para: string;
  iniciado_em: string | null;
  finalizado_em: string | null;
  worker_id: string | null;
  heartbeat_at: string | null;
  resultado: Record<string, unknown> | null;
  erro: string | null;
  tentativas: number;
  created_at: string;
  progresso?: ProgressoExecucao | null;
  progresso_atualizado_em?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ProgressoItem {
  id: string;
  label: string;
  tribunal?: string | null;
  tipo?: string | null;
  mensagem?: string | null;
  erro?: string | null;
  /** Erro registrado, mas o par (termo × dia) foi recoletado com sucesso. */
  erroRecuperado?: boolean;
  /** Houve termo(s)/dia sem coleta neste tribunal. */
  parcial?: boolean;
  paresComFalha?: number;
  paresRecuperados?: number;
  /** Contagem de falhas por código (500, 429, 504, orcamento, vps...). */
  errosPorCodigo?: Record<string, number> | null;
  /** Detalhe das falhas: em qual termo/dia e com qual código. */
  erroDetalhes?: Array<{ termo?: string; dia?: string; codigo?: string; tipo?: string; erro?: string }> | null;
  current?: number;
  total?: number;
  data?: string;
  status: "pendente" | "executando" | "concluido" | "erro" | "cancelado";
  novas?: number;
  descartadas?: number;
  duplicatas?: number;
  diasSemPdf?: number;
  via?: {
    id?: string;
    label?: string;
    multiplas?: boolean;
    labels?: string[];
  } | null;
}

export interface ProgressoExecucao {
  totalItens?: number;
  concluidos?: number;
  falhas?: number;
  novas?: number;
  duplicatas?: number;
  descartadas?: number;
  atual?: { id: string; label: string } | null;
  itens?: ProgressoItem[];
  janela?: { dataInicio: string; dataFim: string };
  vias?: Array<{ id?: string; label?: string; multiplas?: boolean; labels?: string[] }>;
}

export interface WorkerServidor {
  id: string;
  worker_id: string;
  host: string | null;
  status: string;
  current_tipo: string | null;
  current_execucao_id?: string | null;
  heartbeat_at: string;
  started_at: string;
  metadata: Record<string, unknown> | null;
}

export interface PublicacaoServidor {
  id: string;
  monitoramento_id: string;
  coordenacao_id?: string | null;
  processo_numero: string | null;
  tribunal: string | null;
  data_publicacao: string | null;
  data_disponibilizacao: string | null;
  conteudo: string | null;
  origem: string;
  created_at: string;
  hash_conteudo: string;
  id_djen?: string | null;
  dedup_processo_digits: string | null;
  dedup_data_ref: string | null;
  dedup_conteudo_key?: string | null;
}

export function useConfiguracoesServidor() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["djen-servidor", "configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_monitoramento_servidor")
        .select("*")
        .order("tipo");
      if (error) throw error;
      return data as ConfigServidor[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("configuracoes_monitoramento_servidor")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["djen-servidor", "configs"] });
      toast.success("Configuração atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { ativo?: boolean; frequencia?: string; horarios_execucao?: string[]; metadata?: unknown } }) => {
      const { error } = await supabase
        .from("configuracoes_monitoramento_servidor")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["djen-servidor", "configs"] });
      toast.success("Configuração atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, toggle, updateConfig };
}

export function useExecucoesServidor(limit = 50) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["djen-servidor", "execucoes", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execucoes_servidor")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as ExecucaoServidor[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("execucoes-servidor-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "execucoes_servidor" },
        () => qc.invalidateQueries({ queryKey: ["djen-servidor", "execucoes"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export function useWorkersServidor() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["djen-servidor", "workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers_servidor")
        .select("*")
        .order("worker_id");
      if (error) throw error;
      return data as WorkerServidor[];
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("workers-servidor-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workers_servidor" },
        () => qc.invalidateQueries({ queryKey: ["djen-servidor", "workers"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export function usePublicacoesServidor(opts: { dataInicio?: string; dataFim?: string; limit?: number } = {}) {
  const { dataInicio, dataFim, limit = 200 } = opts;
  return useQuery({
    queryKey: ["djen-servidor", "publicacoes", dataInicio, dataFim, limit],
    queryFn: async () => {
      let q = supabase
        .from("publicacoes_djen_servidor")
        .select("*")
        .order("data_publicacao", { ascending: false })
        .limit(limit);
      if (dataInicio) q = q.gte("dedup_data_ref", dataInicio);
      if (dataFim) q = q.lte("dedup_data_ref", dataFim);
      const { data, error } = await q;
      if (error) throw error;
      return data as PublicacaoServidor[];
    },
  });
}

export function useEnfileirarManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      args:
        | string
        | {
            tipo: string;
            payload?: Record<string, unknown>;
          }
    ) => {
      const tipo = typeof args === "string" ? args : args.tipo;
      const extraPayload = typeof args === "string" ? {} : (args.payload || {});
      const { data, error } = await supabase.rpc("enfileirar_execucao_servidor", {
        p_tipo: tipo,
        p_agendado_para: new Date().toISOString(),
        p_payload: { manual: true, ...extraPayload },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["djen-servidor"] });
      if (id) toast.success("Execução enfileirada");
      else toast.info("Já existe execução enfileirada nesta janela");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelarExecucaoServidor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancelar_execucao_servidor" as never, { p_id: id } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["djen-servidor"] });
      toast.success("Cancelamento solicitado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Última execução ativa (ou mais recente) de um tipo, com Realtime.
 * Usado para mostrar a barra de progresso ao vivo nos cards do DJEN Servidor.
 */
export function useExecucaoServidorAoVivo(tipo: string) {
  const qc = useQueryClient();
  const key = ["djen-servidor", "execucao-ao-vivo", tipo];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execucoes_servidor")
        .select("*")
        .eq("tipo", tipo)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      const execucoes = (data || []) as ExecucaoServidor[];
      return execucoes.find((e) => e.status === "executando")
        || execucoes.find((e) => e.status === "pendente" && e.progresso)
        || execucoes.find((e) => e.status === "pendente")
        || execucoes[0]
        || null;
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`execucao-ao-vivo-${tipo}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "execucoes_servidor", filter: `tipo=eq.${tipo}` },
        () => qc.invalidateQueries({ queryKey: key })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, qc]);

  return query;
}

export function useComparadorPublicacoes(opts: { dataInicio: string; dataFim: string; coordenacaoId?: string }) {
  return useQuery({
    queryKey: ["djen-servidor", "comparador", opts.dataInicio, opts.dataFim, opts.coordenacaoId || "todas"],
    queryFn: async () => {
      // Supabase aplica um teto de 1000 linhas por request; para períodos com
      // muitas publicações precisamos paginar via .range() até esgotar.
      const cols =
        "processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, dedup_conteudo_key, id_djen, coordenacao_id, tribunal";
      const fetchAll = async (table: "publicacoes_djen_servidor" | "publicacoes_djen") => {
        const out: any[] = [];
        const pageSize = 1000;
        for (let offset = 0; offset < 100000; offset += pageSize) {
          let q = (supabase as any)
            .from(table)
            .select(cols)
            .gte("dedup_data_ref", opts.dataInicio)
            .lte("dedup_data_ref", opts.dataFim)
            .not("id_djen", "is", null)
            .range(offset, offset + pageSize - 1);
          if (opts.coordenacaoId) q = q.eq("coordenacao_id", opts.coordenacaoId);
          const { data, error } = await q;
          if (error) throw error;
          const rows = (data || []) as any[];
          out.push(...rows);
          if (rows.length < pageSize) break;
        }
        return out;
      };
      const [servRows, browRows] = await Promise.all([
        fetchAll("publicacoes_djen_servidor"),
        fetchAll("publicacoes_djen"),
      ]);
      const serv = { data: servRows } as { data: any[] };
      const brow = { data: browRows } as { data: any[] };

      const key = (r: {
        coordenacao_id?: string | null;
        id_djen?: string | null;
        hash_conteudo: string;
      }) => {
        const coord = r.coordenacao_id || "sem_coord";
        return r.id_djen ? `${coord}|id_djen|${r.id_djen}` : `${coord}|sem-id|${r.hash_conteudo}`;
      };

      const sSet = new Map(serv.data!.map((r) => [key(r), r]));
      const bSet = new Map(brow.data!.map((r) => [key(r), r]));

      const soServidor = [...sSet.entries()].filter(([k]) => !bSet.has(k)).map(([, v]) => v);
      const soBrowser = [...bSet.entries()].filter(([k]) => !sSet.has(k)).map(([, v]) => v);
      const ambos = [...sSet.entries()].filter(([k]) => bSet.has(k)).map(([, v]) => v);

      return {
        totalServidor: serv.data!.length,
        totalBrowser: brow.data!.length,
        soServidor,
        soBrowser,
        ambos,
      };
    },
    enabled: !!opts.dataInicio && !!opts.dataFim,
  });
}

export interface ComparadorAnaliseLinha {
  coordenacaoId: string;
  coordenacaoNome: string;
  tipo: string; // tipo do monitoramento (advogado/processo/palavra-chave/parte) ou "sem_monitoramento"
  totalServidor: number;
  totalBrowser: number;
  emAmbos: number;
  soServidor: number;
  soBrowser: number;
}

export interface ComparadorAnaliseRelatorio {
  dataInicio: string;
  dataFim: string;
  geradoEm: string;
  globalLinhas: Array<{
    coordenacaoId: string;
    coordenacaoNome: string;
    totalServidor: number;
    totalBrowser: number;
    totalBrowserOficial: number;
    emAmbos: number;
    soServidor: number;
    soBrowser: number;
    duplicadasServidor: number;
    duplicadasBrowser: number;
    djenUnico: number;
  }>;
  linhas: ComparadorAnaliseLinha[];
  totais: {
    servidor: number;
    browser: number;
    emAmbos: number;
    soServidor: number;
    soBrowser: number;
    duplicadasServidor: number;
    duplicadasBrowser: number;
    browserOficial: number;
  };
  porFonte: {
    totais: {
      djenServidor: number;
      djenBrowser: number;
      djenUnico: number; // união de servidor+browser
      kurier: number;
      pautas: number;
      browserOficial: number;
    };
    linhas: Array<{
      coordenacaoId: string;
      coordenacaoNome: string;
      djenServidor: number;
      djenBrowser: number;
      djenUnico: number;
      kurier: number;
      pautas: number | null; // null = não atribuível por coord
      browserOficial: number;
    }>;
  };
  diagnostico: {
    janelaCapturaInicioUtc: string;
    janelaCapturaFimUtc: string;
    servidorDjenTermos: number;
    browserDjenTermos: number;
    browserOficial: number;
    browserKurier: number;
    browserPautas: number;
    execucoesDjenServidor: number;
    execucoesKurierServidor: number;
    execucoesPautasServidor: number;
    motivoDiferencaPrincipal: string;
  };
  execucoesServidor: Array<{
    id: string;
    tipo: string;
    status: string | null;
    agendado_para: string | null;
    iniciado_em: string | null;
    finalizado_em: string | null;
    novas: number | null;
    descartadas: number | null;
    duplicatas: number | null;
    monitoramentos: number | null;
    vps: number | null;
  }>;
  detalhes: Array<{
    coordenacaoId: string;
    coordenacaoNome: string;
    tipo: string;
    origem: "so_servidor" | "so_browser";
    processo_numero: string | null;
    tribunal: string | null;
    data_publicacao: string | null;
    data_disponibilizacao: string | null;
    id_djen: string | null;
    monitoramento_id: string | null;
    termo_busca: string | null;
    capturado_em: string | null;
    execucao_id_servidor: string | null;
    execucao_servidor_status: string | null;
    execucao_servidor_agendada_para: string | null;
    execucao_servidor_finalizada_em: string | null;
    provavel_causa: string | null;
    motivo_exato: string | null;
    existe_na_mesma_origem_outra_coord: boolean;
    coords_mesma_origem_outra_coord: string | null;
    capturado_na_mesma_origem_em: string | null;
    existe_na_outra_origem_outra_coord: boolean;
    coords_outra_origem_outra_coord: string | null;
    capturado_na_outra_origem_em: string | null;
  }>;
  detalhesDuplicadas: Array<{
    coordenacaoId: string;
    coordenacaoNome: string;
    origem: "servidor" | "browser";
    tipo: string;
    key: string;
    id_djen: string | null;
    ids_djen: string[];
    total_registros: number;
    duplicadas: number;
    processo_numero: string | null;
    tribunal: string | null;
    data_publicacao: string | null;
    data_disponibilizacao: string | null;
    monitoramento_ids: string[];
    termos_busca: string[];
  }>;
}

/**
 * Versão manual (disparada via botão "Analisar") do comparador.
 * Agrupa por coordenação x tipo de monitoramento, mostrando quantas publicações
 * foram encontradas pelo servidor (VPS) vs. pelo navegador, em comum e exclusivas.
 */
export function useComparadorAnalise() {
  return useMutation({
    mutationFn: async (opts: {
      dataInicio: string;
      dataFim: string;
      coordenacaoId?: string;
      origem?: "todos" | "termos" | "pautas" | "kurier";
    }): Promise<ComparadorAnaliseRelatorio> => {
      const baseCols =
        "processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, dedup_conteudo_key, id_djen, coordenacao_id, monitoramento_id, tribunal, data_disponibilizacao, data_publicacao, tipo_publicacao, fonte, created_at, execucao_id";
      const inicioCapturaTs = dateLocalToUTCRange(opts.dataInicio, false);
      const fimCapturaTs = dateLocalToUTCRange(opts.dataFim, true);
      const origem = opts.origem || "todos";
      let servQ = supabase
        .from("publicacoes_djen_servidor")
        .select(baseCols)
        .gte("created_at", inicioCapturaTs)
        .lte("created_at", fimCapturaTs)
        .not("id_djen", "is", null)
        .limit(20000);
      let browQ = supabase
        .from("publicacoes_djen")
        .select(baseCols)
        .gte("created_at", inicioCapturaTs)
        .lte("created_at", fimCapturaTs)
        .in("status", ["encontrada", "duplicada"])
        .not("id_djen", "is", null)
        .limit(20000);
      // Total oficial da tela Análise DJEN: conta tudo que está em
      // publicacoes_djen no período de captura BRT, incluindo Kurier/Pautas.
      // Este número é separado da comparação DJEN Servidor × Browser, que deve
      // continuar comparando DJEN com DJEN e não misturar fontes migradas.
      let browserOfficialQ = supabase
        .from("publicacoes_djen")
        .select(baseCols)
        .gte("created_at", inicioCapturaTs)
        .lte("created_at", fimCapturaTs)
        .in("status", ["encontrada", "duplicada"])
        .limit(20000);
      if (opts.coordenacaoId) {
        servQ = servQ.eq("coordenacao_id", opts.coordenacaoId);
        browQ = browQ.eq("coordenacao_id", opts.coordenacaoId);
        browserOfficialQ = browserOfficialQ.eq("coordenacao_id", opts.coordenacaoId);
      }

      // Filtro por origem aplicado nas duas tabelas DJEN.
      // - termos: tudo que NÃO é pauta (intimacao + parte + nulos legados)
      // - pautas: somente tipo_publicacao='pauta'
      // - kurier: zera as linhas DJEN (kurier vem só do bloco kurier_publicacoes_raw)
      if (origem === "todos") {
        // Kurier fica no bloco próprio/total oficial; não pode inflar o
        // comparativo DJEN Browser contra DJEN Servidor.
        browQ = browQ.or("fonte.is.null,fonte.neq.kurier");
      } else if (origem === "termos") {
        servQ = servQ.or("tipo_publicacao.is.null,tipo_publicacao.neq.pauta");
        browQ = browQ
          .or("tipo_publicacao.is.null,tipo_publicacao.neq.pauta")
          .or("fonte.is.null,fonte.neq.kurier");
        browserOfficialQ = browserOfficialQ
          .or("tipo_publicacao.is.null,tipo_publicacao.neq.pauta")
          .or("fonte.is.null,fonte.neq.kurier");
      } else if (origem === "pautas") {
        servQ = servQ.eq("tipo_publicacao", "pauta");
        browQ = browQ
          .eq("tipo_publicacao", "pauta")
          .or("fonte.is.null,fonte.neq.kurier");
        browserOfficialQ = browserOfficialQ
          .eq("tipo_publicacao", "pauta")
          .or("fonte.is.null,fonte.neq.kurier");
      } else if (origem === "kurier") {
        // Não busca DJEN — força resultado vazio mantendo a query válida.
        servQ = servQ.eq("id_djen", "__NONE__");
        browQ = browQ.eq("id_djen", "__NONE__");
        browserOfficialQ = browserOfficialQ.eq("fonte", "kurier");
      }

      // Filtros adicionais (kurier / pautas)
      const inicioTs = `${opts.dataInicio}T00:00:00Z`;
      const fimTs = `${opts.dataFim}T23:59:59Z`;

      let pautasQ = supabase
        .from("pautas_tst")
        .select("id, processo_numero, data_julgamento")
        .gte("data_julgamento", opts.dataInicio)
        .lte("data_julgamento", opts.dataFim)
        .limit(50000);

      // Quando o usuário escolhe uma origem específica, zeramos os blocos
      // das outras fontes para evitar números confusos no resumo.
      if (origem === "termos" || origem === "kurier") {
        pautasQ = pautasQ.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      // Paginação em blocos de 1000 para contornar o teto padrão do PostgREST.
      // Sem isso, o comparador ficava travado nos primeiros 1000 registros de
      // cada tabela e apresentava sempre os mesmos números.
      const paginate = async (baseQuery: any) => {
        const out: any[] = [];
        const pageSize = 1000;
        for (let offset = 0; offset < 200000; offset += pageSize) {
          const { data, error } = await baseQuery.range(offset, offset + pageSize - 1);
          if (error) throw error;
          const rows = (data || []) as any[];
          out.push(...rows);
          if (rows.length < pageSize) break;
        }
        return out;
      };
      const [servRows, browRows, browserOfficialRows, pautasRows, coords, monits] = await Promise.all([
        paginate(servQ),
        paginate(browQ),
        paginate(browserOfficialQ),
        paginate(pautasQ).catch((e) => { console.warn("[comparador] pautas:", e?.message); return []; }),
        supabase.from("coordenacoes").select("id, nome"),
        supabase.from("monitoramentos_djen").select("id, tipo, coordenacao_id, termo_busca, tribunais"),
      ]);
      const serv = { data: servRows, error: null as any };
      const brow = { data: browRows, error: null as any };
      const browserOfficialRes = { data: browserOfficialRows, error: null as any };
      const pautasRes = { data: pautasRows, error: null as any };
      if (coords.error) throw coords.error;
      if (monits.error) throw monits.error;

      const coordNome = new Map<string, string>(
        (coords.data || []).map((c: any) => [c.id, c.nome]),
      );
      const monitTipo = new Map<string, string>(
        (monits.data || []).map((m: any) => [m.id, m.tipo]),
      );
      const monitTermo = new Map<string, string>(
        (monits.data || []).map((m: any) => [m.id, m.termo_busca || ""]),
      );
      // Tribunais por coordenação: união dos tribunais configurados nos
      // monitoramentos ativos dessa coordenação. Usado para detectar quando
      // uma publicação do Browser vem de tribunal que o Servidor não cobriria.
      const tribunaisPorCoord = new Map<string, Set<string>>();
      const TODOS_CIVEIS = ["TJAC","TJAL","TJAM","TJAP","TJBA","TJCE","TJDFT","TJES","TJGO","TJMA","TJMG","TJMS","TJMT","TJPA","TJPB","TJPE","TJPI","TJPR","TJRJ","TJRN","TJRO","TJRR","TJRS","TJSC","TJSE","TJSP","TJTO"];
      const TODOS_TRT = ["TST","TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8","TRT9","TRT10","TRT11","TRT12","TRT13","TRT14","TRT15","TRT16","TRT17","TRT18","TRT19","TRT20","TRT21","TRT22","TRT23","TRT24"];
      const expandirTribs = (arr: unknown): string[] => {
        if (!Array.isArray(arr)) return [];
        const out: string[] = [];
        for (const t of arr as string[]) {
          if (t === "TODOS_CIVEIS") out.push(...TODOS_CIVEIS);
          else if (t === "TODOS_TRT") out.push(...TODOS_TRT);
          else if (typeof t === "string" && t.trim()) out.push(t.trim().toUpperCase());
        }
        return out;
      };
      for (const m of (monits.data || []) as Array<{ coordenacao_id?: string; tribunais?: string[] }>) {
        const cid = m.coordenacao_id || "sem_coord";
        let set = tribunaisPorCoord.get(cid);
        if (!set) { set = new Set(); tribunaisPorCoord.set(cid, set); }
        for (const t of expandirTribs(m.tribunais)) set.add(t);
      }

      const addDaysYmd = (ymd: string, days: number) => {
        const d = new Date(`${ymd}T12:00:00Z`);
        if (Number.isNaN(d.getTime())) return ymd;
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      const ymdBrt = (iso?: string | null) => {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(d);
      };
      const expandDiasYmd = (di: string, df?: string) => {
        const dias: string[] = [];
        const start = new Date(`${di}T12:00:00Z`);
        const end = new Date(`${df || di}T12:00:00Z`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return di ? [di] : [];
        for (const cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
          dias.push(cur.toISOString().slice(0, 10));
        }
        return dias;
      };

      // Execuções servidor da janela em BRT. Importante: execuções agendadas
      // saem com payload vazio; nesses casos a data pesquisada é o dia BRT do
      // agendamento, não dataInicio/dataFim dentro do payload.
      let execQ = supabase
        .from("execucoes_servidor")
        .select("id, payload, finalizado_em, status, agendado_para")
        .eq("tipo", "djen_paralela_servidor")
        .gte("agendado_para", `${addDaysYmd(opts.dataInicio, -1)}T00:00:00Z`)
        .lte("agendado_para", `${addDaysYmd(opts.dataFim, 2)}T23:59:59Z`)
        .in("status", ["concluido", "concluido_parcial", "executando", "erro", "cancelado"])
        .limit(2000);
      const execRes = await execQ;
      const execucoesPeriodoRes = await supabase
        .from("execucoes_servidor")
        .select("id, tipo, status, agendado_para, iniciado_em, finalizado_em, resultado")
        .in("tipo", ["djen_paralela_servidor", "kurier_servidor", "djet_pautas_servidor"])
        .gte("agendado_para", inicioCapturaTs)
        .lte("agendado_para", fimCapturaTs)
        .order("agendado_para", { ascending: true })
        .limit(2000);
      if (execucoesPeriodoRes.error) throw execucoesPeriodoRes.error;
      type ExecInfo = {
        id: string | null;
        status: string | null;
        agendado_para: string | null;
        finalizado_em: string | null;
        concluida: boolean;
        executando: boolean;
        statuses: Set<string>;
      };
      const execPorCoordDia = new Map<string, ExecInfo>(); // key coord|diaYmd; coord="*" = execução para todas
      const registrarExec = (cid: string | null, dia: string, e: { id: string; status: string | null; agendado_para: string | null; finalizado_em: string | null }) => {
        const keyExec = `${cid || "*"}|${dia}`;
        const prev = execPorCoordDia.get(keyExec);
        const status = e.status || null;
        const concluida = status === "concluido" || status === "concluido_parcial";
        const executando = status === "executando";
        const shouldReplace = !prev
          || (concluida && !prev.concluida)
          || (concluida === prev.concluida && String(e.finalizado_em || e.agendado_para || "") > String(prev.finalizado_em || prev.agendado_para || ""));
        const next: ExecInfo = shouldReplace
          ? {
              id: e.id || null,
              status,
              agendado_para: e.agendado_para || null,
              finalizado_em: e.finalizado_em || null,
              concluida,
              executando,
              statuses: new Set(prev?.statuses || []),
            }
          : { ...prev!, statuses: new Set(prev?.statuses || []) };
        if (status) next.statuses.add(status);
        next.executando = next.executando || executando;
        next.concluida = next.concluida || concluida;
        execPorCoordDia.set(keyExec, next);
      };
      for (const e of (execRes.data || []) as Array<{ id: string; payload: any; finalizado_em: string | null; status: string | null; agendado_para: string | null }>) {
        const p = e.payload || {};
        const cid = p.coordenacaoId || null;
        const fallbackDia = ymdBrt(e.agendado_para || e.finalizado_em);
        const di = String(p.dataInicio || p.diarioYmd || fallbackDia || "").slice(0, 10);
        const df = String(p.dataFim || p.diarioYmd || di).slice(0, 10);
        if (!di) continue;
        for (const dia of expandDiasYmd(di, df)) registrarExec(cid, dia, e);
      }
      const getExecInfo = (cid: string, dia: string): ExecInfo | null =>
        execPorCoordDia.get(`${cid}|${dia}`) || execPorCoordDia.get(`*|${dia}`) || null;

      // Regra obrigatória: coordenações são independentes. A mesma publicação
      // pode (e deve) existir em mais de uma coordenação. Portanto o comparador
      // NUNCA considera id_djen existente em outra coordenação como match,
      // duplicata válida ou justificativa de diferença.

      type Row = {
        coordenacao_id?: string | null;
        monitoramento_id?: string | null;
        id_djen?: string | null;
        dedup_conteudo_key?: string | null;
        dedup_processo_digits?: string | null;
        dedup_data_ref?: string | null;
        hash_conteudo: string;
        execucao_id?: string | null;
        processo_numero?: string | null;
        tribunal?: string | null;
        data_publicacao?: string | null;
        data_disponibilizacao?: string | null;
        fonte?: string | null;
        created_at?: string | null;
      };

      // CHAVE PRINCIPAL DO COMPARADOR: somente coordenação + id_djen.
      // Processo/data/conteúdo/hash não são critério de igualdade DJEN.
      const key = (r: Row) => {
        const coord = r.coordenacao_id || "sem_coord";
        if (r.id_djen) return `${coord}|id_djen|${r.id_djen}`;
        return `${coord}|sem-id|${r.hash_conteudo}|${r.created_at || ""}`;
      };

      const groupKey = (r: Row) => {
        const coordId = r.coordenacao_id || "sem_coord";
        const tipo = (r.monitoramento_id && monitTipo.get(r.monitoramento_id)) || "sem_monitoramento";
        return `${coordId}::${tipo}`;
      };

      const sRows = (serv.data || []) as Row[];
      const bRows = (brow.data || []) as Row[];

      type AuditRow = { id_djen?: string | null; coordenacao_id?: string | null; created_at?: string | null };
      const auditIds = Array.from(new Set([...sRows, ...bRows].map((r) => r.id_djen).filter(Boolean) as string[]));
      const auditServRows: AuditRow[] = [];
      const auditBrowRows: AuditRow[] = [];
      const chunkAudit = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      for (const ids of chunkAudit(auditIds, 500)) {
        const [as, ab] = await Promise.all([
          supabase
            .from("publicacoes_djen_servidor")
            .select("id_djen, coordenacao_id, created_at")
            .gte("created_at", inicioCapturaTs)
            .lte("created_at", fimCapturaTs)
            .in("id_djen", ids)
            .limit(50000),
          supabase
            .from("publicacoes_djen")
            .select("id_djen, coordenacao_id, created_at")
            .gte("created_at", inicioCapturaTs)
            .lte("created_at", fimCapturaTs)
            .in("id_djen", ids)
            .limit(50000),
        ]);
        if (!as.error) auditServRows.push(...((as.data || []) as AuditRow[]));
        else console.warn("[comparador] audit servidor:", as.error.message);
        if (!ab.error) auditBrowRows.push(...((ab.data || []) as AuditRow[]));
        else console.warn("[comparador] audit browser:", ab.error.message);
      }
      const groupAudit = (rows: AuditRow[]) => {
        const map = new Map<string, AuditRow[]>();
        for (const r of rows) {
          if (!r.id_djen) continue;
          const arr = map.get(r.id_djen) || [];
          arr.push(r);
          map.set(r.id_djen, arr);
        }
        return map;
      };
      const auditServById = groupAudit(auditServRows);
      const auditBrowById = groupAudit(auditBrowRows);

      const provavelCausa = (origem: "so_servidor" | "so_browser", r: Row): string => {
        const cid = r.coordenacao_id || "sem_coord";
        if (origem === "so_servidor") {
          return "faltou_no_browser";
        }
        // so_browser:
        const dia = String(r.dedup_data_ref || ymdBrt(r.data_disponibilizacao) || r.data_disponibilizacao || "").slice(0, 10);
        const tribunaisCoord = tribunaisPorCoord.get(cid);
        const trib = (r.tribunal || "").toUpperCase();
        if (tribunaisCoord && tribunaisCoord.size > 0 && trib && !tribunaisCoord.has(trib)) {
          return "tribunal_fora_do_monitoramento_servidor";
        }
        const execInfo = getExecInfo(cid, dia);
        if (!execInfo) return "sem_execucao_servidor_para_esta_data";
        if (!execInfo.concluida && execInfo.executando) return "execucao_servidor_ainda_em_andamento";
        if (!execInfo.concluida) return `execucao_servidor_sem_conclusao:${Array.from(execInfo.statuses).join("|") || "desconhecido"}`;
        const ultima = execInfo.finalizado_em || "";
        const cap = r.created_at || "";
        if (cap && cap > ultima) return "browser_capturou_depois_da_ultima_execucao_servidor";
        return "possivel_proxy_vazio_ou_api_instavel";
      };

      const auditExclusiva = (origem: "so_servidor" | "so_browser", r: Row) => {
        const id = r.id_djen || "";
        const cid = r.coordenacao_id || "sem_coord";
        const sameMap = origem === "so_servidor" ? auditServById : auditBrowById;
        const otherMap = origem === "so_servidor" ? auditBrowById : auditServById;
        const sameRows = id ? (sameMap.get(id) || []).filter((x) => (x.coordenacao_id || "sem_coord") !== cid) : [];
        const otherRows = id ? (otherMap.get(id) || []).filter((x) => (x.coordenacao_id || "sem_coord") !== cid) : [];
        const coords = (rows: AuditRow[]) => Array.from(new Set(rows.map((x) => coordNome.get(x.coordenacao_id || "") || "Sem coordenação"))).join(" | ") || null;
        const caps = (rows: AuditRow[]) => Array.from(new Set(rows.map((x) => x.created_at || "").filter(Boolean))).sort().join(" | ") || null;
        const provavel = provavelCausa(origem, r);
        const motivo = otherRows.length > 0
          ? origem === "so_servidor"
            ? "browser_tem_em_outra_coord_mas_nao_resgatou_para_coord_alvo"
            : "servidor_tem_em_outra_coord_mas_nao_resgatou_para_coord_alvo"
          : sameRows.length > 0
            ? origem === "so_servidor"
              ? "servidor_tem_em_outra_coord_e_coord_alvo_sem_equivalente_browser"
              : "browser_tem_em_outra_coord_e_coord_alvo_sem_equivalente_servidor"
            : provavel;
        return {
          provavel_causa: provavel,
          motivo_exato: motivo,
          existe_na_mesma_origem_outra_coord: sameRows.length > 0,
          coords_mesma_origem_outra_coord: coords(sameRows),
          capturado_na_mesma_origem_em: caps(sameRows),
          existe_na_outra_origem_outra_coord: otherRows.length > 0,
          coords_outra_origem_outra_coord: coords(otherRows),
          capturado_na_outra_origem_em: caps(otherRows),
        };
      };

      const execInfoForRow = (r: Row) => {
        const cid = r.coordenacao_id || "sem_coord";
        const dia = String(r.dedup_data_ref || ymdBrt(r.data_disponibilizacao) || r.data_disponibilizacao || "").slice(0, 10);
        return getExecInfo(cid, dia);
      };

      const groupRowsByKey = (rows: Row[]) => {
        const map = new Map<string, Row[]>();
        for (const r of rows) {
          const k = key(r);
          const arr = map.get(k) || [];
          arr.push(r);
          map.set(k, arr);
        }
        return map;
      };
      const sRowsByKey = groupRowsByKey(sRows);
      const bRowsByKey = groupRowsByKey(bRows);
      const sByKey = new Map(Array.from(sRowsByKey.entries()).map(([k, rows]) => [k, rows[0]] as const));
      const bByKey = new Map(Array.from(bRowsByKey.entries()).map(([k, rows]) => [k, rows[0]] as const));

      const rowTipo = (r: Row) =>
        (r.monitoramento_id && monitTipo.get(r.monitoramento_id)) || "sem_monitoramento";
      const rowCoord = (r: Row) => r.coordenacao_id || "sem_coord";

      const duplicadasPorCoordServidor = new Map<string, number>();
      const duplicadasPorCoordBrowser = new Map<string, number>();
      const detalhesDuplicadas: ComparadorAnaliseRelatorio["detalhesDuplicadas"] = [];
      const pickDataPub = (r: Row) => r.data_publicacao || r.data_disponibilizacao || null;
      const registrarDuplicadas = (origemDup: "servidor" | "browser", groupedRows: Map<string, Row[]>) => {
        for (const [k, rows] of groupedRows) {
          if (rows.length <= 1) continue;
          const first = rows[0];
          const cid = rowCoord(first);
          const dupCount = rows.length - 1;
          const targetMap = origemDup === "servidor" ? duplicadasPorCoordServidor : duplicadasPorCoordBrowser;
          targetMap.set(cid, (targetMap.get(cid) || 0) + dupCount);
          const monitoramentoIds = Array.from(new Set(rows.map((r) => r.monitoramento_id || "").filter(Boolean)));
          const termosBusca = Array.from(new Set(monitoramentoIds.map((id) => monitTermo.get(id) || "").filter(Boolean)));
          const idsDjen = Array.from(new Set(rows.map((r) => r.id_djen || "").filter(Boolean)));
          detalhesDuplicadas.push({
            coordenacaoId: cid,
            coordenacaoNome: coordNome.get(cid) || "Sem coordenação",
            origem: origemDup,
            tipo: rowTipo(first),
            key: k,
            id_djen: first.id_djen || null,
            ids_djen: idsDjen,
            total_registros: rows.length,
            duplicadas: dupCount,
            processo_numero: first.processo_numero || null,
            tribunal: first.tribunal || null,
            data_publicacao: pickDataPub(first),
            data_disponibilizacao: first.data_disponibilizacao || null,
            monitoramento_ids: monitoramentoIds,
            termos_busca: termosBusca,
          });
        }
      };
      registrarDuplicadas("servidor", sRowsByKey);
      registrarDuplicadas("browser", bRowsByKey);

      type Bucket = {
        coordenacaoId: string;
        tipo: string;
        servidor: Set<string>;
        browser: Set<string>;
      };
      const buckets = new Map<string, Bucket>();
      // Resolve um único (coord, tipo) por chave de publicação, priorizando o
      // tipo escolhido pelo servidor; se o servidor não a encontrou, usa o do
      // browser. Isso evita que a mesma publicação (mesmo id_djen) seja
      // contada em buckets diferentes (advogado x parte) em cada lado.
      const keyToBucket = new Map<string, { coordenacaoId: string; tipo: string }>();
      for (const r of sRows) {
        const k = key(r);
        if (!keyToBucket.has(k)) keyToBucket.set(k, { coordenacaoId: rowCoord(r), tipo: rowTipo(r) });
      }
      for (const r of bRows) {
        const k = key(r);
        if (!keyToBucket.has(k)) keyToBucket.set(k, { coordenacaoId: rowCoord(r), tipo: rowTipo(r) });
      }
      const ensureByKey = (k: string): Bucket => {
        const meta = keyToBucket.get(k)!;
        const gk = `${meta.coordenacaoId}::${meta.tipo}`;
        let b = buckets.get(gk);
        if (!b) {
          b = { coordenacaoId: meta.coordenacaoId, tipo: meta.tipo, servidor: new Set(), browser: new Set() };
          buckets.set(gk, b);
        }
        return b;
      };
      for (const r of sRows) ensureByKey(key(r)).servidor.add(key(r));
      for (const r of bRows) ensureByKey(key(r)).browser.add(key(r));

      const linhas: ComparadorAnaliseLinha[] = [];
      let totServ = 0,
        totBrow = 0,
        totAmbos = 0,
        totSoServ = 0,
        totSoBrow = 0;
      for (const b of buckets.values()) {
        let emAmbos = 0;
        for (const k of b.servidor) if (b.browser.has(k)) emAmbos++;
        const soServidor = b.servidor.size - emAmbos;
        const soBrowser = b.browser.size - emAmbos;
        totServ += b.servidor.size;
        totBrow += b.browser.size;
        totAmbos += emAmbos;
        totSoServ += soServidor;
        totSoBrow += soBrowser;
        linhas.push({
          coordenacaoId: b.coordenacaoId,
          coordenacaoNome: coordNome.get(b.coordenacaoId) || "Sem coordenação",
          tipo: b.tipo,
          totalServidor: b.servidor.size,
          totalBrowser: b.browser.size,
          emAmbos,
          soServidor,
          soBrowser,
        });
      }

      linhas.sort((a, b) => {
        const c = a.coordenacaoNome.localeCompare(b.coordenacaoNome, "pt-BR");
        if (c !== 0) return c;
        return a.tipo.localeCompare(b.tipo, "pt-BR");
      });

      // Sanity: alinhar com chaves cross-coord (dedup interno já usa coord no key)
      const allKeys = new Set<string>([...sByKey.keys(), ...bByKey.keys()]);
      void allKeys;

      // ============ Por fonte de busca (Kurier / Pautas / DJEN) ============
      // A Análise DJEN oficial lê publicacoes_djen. Como Kurier servidor grava
      // nessa tabela oficial, o comparador precisa exibir esse total oficial
      // separado do comparativo DJEN Termos Servidor × Browser.
      const browserOfficialRowsAll = (browserOfficialRes.data || []) as Row[];
      const browserOficialPorCoord = new Map<string, number>();
      const kurierPorCoord = new Map<string, number>();
      for (const r of browserOfficialRowsAll) {
        const cid = r.coordenacao_id || "sem_coord";
        browserOficialPorCoord.set(cid, (browserOficialPorCoord.get(cid) || 0) + 1);
        if ((r.fonte || "").toLowerCase() === "kurier") {
          kurierPorCoord.set(cid, (kurierPorCoord.get(cid) || 0) + 1);
        }
      }
      const browserOficialTotal = browserOfficialRowsAll.length;
      const kurierTotal = Array.from(kurierPorCoord.values()).reduce((sum, n) => sum + n, 0);

      // Pautas: global (sem coord). Quando há filtro de coord, omitimos pautas.
      const pautasTotal = opts.coordenacaoId ? 0 : ((pautasRes.data || []) as unknown[]).length;

      // DJEN por coord (união servidor + browser)
      const djenServPorCoord = new Map<string, Set<string>>();
      const djenBrowPorCoord = new Map<string, Set<string>>();
      for (const r of sRows) {
        const cid = r.coordenacao_id || "sem_coord";
        let s = djenServPorCoord.get(cid); if (!s) { s = new Set(); djenServPorCoord.set(cid, s); }
        s.add(key(r));
      }
      for (const r of bRows) {
        const cid = r.coordenacao_id || "sem_coord";
        let s = djenBrowPorCoord.get(cid); if (!s) { s = new Set(); djenBrowPorCoord.set(cid, s); }
        s.add(key(r));
      }
      const coordIdsFonte = new Set<string>([
        ...djenServPorCoord.keys(),
        ...djenBrowPorCoord.keys(),
        ...kurierPorCoord.keys(),
        ...browserOficialPorCoord.keys(),
      ]);
      const fonteLinhas = Array.from(coordIdsFonte).map((cid) => {
        const sSet = djenServPorCoord.get(cid) || new Set<string>();
        const bSet = djenBrowPorCoord.get(cid) || new Set<string>();
        const uni = new Set<string>([...sSet, ...bSet]);
        return {
          coordenacaoId: cid,
          coordenacaoNome: coordNome.get(cid) || "Sem coordenação",
          djenServidor: sSet.size,
          djenBrowser: bSet.size,
          djenUnico: uni.size,
          kurier: kurierPorCoord.get(cid) || 0,
          pautas: null as number | null,
          browserOficial: browserOficialPorCoord.get(cid) || 0,
        };
      }).sort((a, b) => a.coordenacaoNome.localeCompare(b.coordenacaoNome, "pt-BR"));

      const globalLinhas = Array.from(new Set<string>([
        ...djenServPorCoord.keys(),
        ...djenBrowPorCoord.keys(),
        ...browserOficialPorCoord.keys(),
        ...duplicadasPorCoordServidor.keys(),
        ...duplicadasPorCoordBrowser.keys(),
      ])).map((cid) => {
        const sSet = djenServPorCoord.get(cid) || new Set<string>();
        const bSet = djenBrowPorCoord.get(cid) || new Set<string>();
        let emAmbos = 0;
        for (const k of sSet) if (bSet.has(k)) emAmbos++;
        const soServidor = sSet.size - emAmbos;
        const soBrowser = bSet.size - emAmbos;
        return {
          coordenacaoId: cid,
          coordenacaoNome: coordNome.get(cid) || "Sem coordenação",
          totalServidor: sSet.size,
          totalBrowser: bSet.size,
          totalBrowserOficial: browserOficialPorCoord.get(cid) || 0,
          emAmbos,
          soServidor,
          soBrowser,
          duplicadasServidor: duplicadasPorCoordServidor.get(cid) || 0,
          duplicadasBrowser: duplicadasPorCoordBrowser.get(cid) || 0,
          djenUnico: emAmbos + soServidor + soBrowser,
        };
      }).sort((a, b) => a.coordenacaoNome.localeCompare(b.coordenacaoNome, "pt-BR"));

      const djenUnicoTotal = new Set<string>([...sByKey.keys(), ...bByKey.keys()]).size;
      const sumMap = (m: Map<string, number>) => Array.from(m.values()).reduce((sum, n) => sum + n, 0);

      // Detalhamento: publicações exclusivas por origem (para CSV)
      const detalhes: ComparadorAnaliseRelatorio["detalhes"] = [];
      for (const [k, r] of sByKey) {
        if (bByKey.has(k)) continue;
        const meta = keyToBucket.get(k);
        const cid = meta?.coordenacaoId || (r.coordenacao_id || "sem_coord");
        const audit = auditExclusiva("so_servidor", r);
        detalhes.push({
          coordenacaoId: cid,
          coordenacaoNome: coordNome.get(cid) || "Sem coordenação",
          tipo: meta?.tipo || "sem_monitoramento",
          origem: "so_servidor",
          processo_numero: r.processo_numero || null,
          tribunal: r.tribunal || null,
          data_publicacao: pickDataPub(r),
          data_disponibilizacao: r.data_disponibilizacao || null,
          id_djen: r.id_djen || null,
          monitoramento_id: r.monitoramento_id || null,
          termo_busca: (r.monitoramento_id && monitTermo.get(r.monitoramento_id)) || null,
          capturado_em: r.created_at || null,
          execucao_id_servidor: r.execucao_id || null,
          execucao_servidor_status: null,
          execucao_servidor_agendada_para: null,
          execucao_servidor_finalizada_em: null,
          ...audit,
        });
      }
      for (const [k, r] of bByKey) {
        if (sByKey.has(k)) continue;
        const meta = keyToBucket.get(k);
        const cid = meta?.coordenacaoId || (r.coordenacao_id || "sem_coord");
        const execInfo = execInfoForRow(r);
        const audit = auditExclusiva("so_browser", r);
        detalhes.push({
          coordenacaoId: cid,
          coordenacaoNome: coordNome.get(cid) || "Sem coordenação",
          tipo: meta?.tipo || "sem_monitoramento",
          origem: "so_browser",
          processo_numero: r.processo_numero || null,
          tribunal: r.tribunal || null,
          data_publicacao: pickDataPub(r),
          data_disponibilizacao: r.data_disponibilizacao || null,
          id_djen: r.id_djen || null,
          monitoramento_id: r.monitoramento_id || null,
          termo_busca: (r.monitoramento_id && monitTermo.get(r.monitoramento_id)) || null,
          capturado_em: r.created_at || null,
          execucao_id_servidor: execInfo?.id || null,
          execucao_servidor_status: execInfo?.status || null,
          execucao_servidor_agendada_para: execInfo?.agendado_para || null,
          execucao_servidor_finalizada_em: execInfo?.finalizado_em || null,
          ...audit,
        });
      }
      detalhes.sort((a, b) => {
        const c = a.coordenacaoNome.localeCompare(b.coordenacaoNome, "pt-BR");
        if (c !== 0) return c;
        if (a.origem !== b.origem) return a.origem.localeCompare(b.origem);
        const t = (a.tribunal || "").localeCompare(b.tribunal || "", "pt-BR");
        if (t !== 0) return t;
        return (a.processo_numero || "").localeCompare(b.processo_numero || "");
      });
      detalhesDuplicadas.sort((a, b) => {
        const c = a.coordenacaoNome.localeCompare(b.coordenacaoNome, "pt-BR");
        if (c !== 0) return c;
        if (a.origem !== b.origem) return a.origem.localeCompare(b.origem);
        return (a.id_djen || a.key).localeCompare(b.id_djen || b.key, "pt-BR");
      });

      const execucoesServidor = ((execucoesPeriodoRes.data || []) as Array<{
        id: string;
        tipo: string;
        status: string | null;
        agendado_para: string | null;
        iniciado_em: string | null;
        finalizado_em: string | null;
        resultado?: Record<string, unknown> | null;
      }>).map((e) => {
        const r = e.resultado || {};
        const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
        return {
          id: e.id,
          tipo: e.tipo,
          status: e.status,
          agendado_para: e.agendado_para,
          iniciado_em: e.iniciado_em,
          finalizado_em: e.finalizado_em,
          novas: num(r.novas),
          descartadas: num(r.descartadas),
          duplicatas: num(r.duplicatas),
          monitoramentos: num(r.monitoramentos),
          vps: num(r.vps),
        };
      });
      const countExec = (tipo: string) => execucoesServidor.filter((e) => e.tipo === tipo).length;
      const browserKurier = browserOfficialRowsAll.filter((r) => (r.fonte || "").toLowerCase() === "kurier").length;
      const browserPautas = browserOfficialRowsAll.filter((r: any) => {
        const fonte = String(r.fonte || "").toLowerCase();
        const tipo = String(r.tipo_publicacao || "").toLowerCase();
        return fonte.includes("pauta") || tipo === "pauta";
      }).length;
      const motivoDiferencaPrincipal = browserOficialTotal > totServ
        ? `A diferença principal é de fonte, não de DJEN Termos: o Browser oficial tem ${browserKurier} Kurier e ${browserPautas} Pautas no período. O comparativo DJEN Termos ficou Servidor ${totServ} × Browser ${totBrow}.`
        : `No período, o total oficial do Browser não ficou acima do Servidor. O comparativo DJEN Termos ficou Servidor ${totServ} × Browser ${totBrow}.`;

      return {
        dataInicio: opts.dataInicio,
        dataFim: opts.dataFim,
        geradoEm: new Date().toISOString(),
        globalLinhas,
        linhas,
        totais: {
          servidor: totServ,
          browser: totBrow,
          emAmbos: totAmbos,
          soServidor: totSoServ,
          soBrowser: totSoBrow,
          duplicadasServidor: sumMap(duplicadasPorCoordServidor),
          duplicadasBrowser: sumMap(duplicadasPorCoordBrowser),
          browserOficial: browserOficialTotal,
        },
        porFonte: {
          totais: {
            djenServidor: totServ,
            djenBrowser: totBrow,
            djenUnico: djenUnicoTotal,
            kurier: kurierTotal,
            pautas: pautasTotal,
            browserOficial: browserOficialTotal,
          },
          linhas: fonteLinhas,
        },
        diagnostico: {
          janelaCapturaInicioUtc: inicioCapturaTs,
          janelaCapturaFimUtc: fimCapturaTs,
          servidorDjenTermos: totServ,
          browserDjenTermos: totBrow,
          browserOficial: browserOficialTotal,
          browserKurier,
          browserPautas,
          execucoesDjenServidor: countExec("djen_paralela_servidor"),
          execucoesKurierServidor: countExec("kurier_servidor"),
          execucoesPautasServidor: countExec("djet_pautas_servidor"),
          motivoDiferencaPrincipal,
        },
        execucoesServidor,
        detalhes,
        detalhesDuplicadas,
      };
    },
  });
}

export function useTickAge() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}