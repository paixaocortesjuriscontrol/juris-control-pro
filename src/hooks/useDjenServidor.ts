import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  current?: number;
  total?: number;
  data?: string;
  status: "pendente" | "executando" | "concluido" | "erro" | "cancelado";
  novas?: number;
  descartadas?: number;
  duplicatas?: number;
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
        .limit(1);
      if (error) throw error;
      return (data?.[0] as ExecucaoServidor | undefined) || null;
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
      let servQ = supabase
        .from("publicacoes_djen_servidor")
        .select("processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, dedup_conteudo_key, id_djen, coordenacao_id, tribunal")
        .gte("dedup_data_ref", opts.dataInicio)
        .lte("dedup_data_ref", opts.dataFim)
        .not("id_djen", "is", null)
        .limit(5000);
      let browQ = supabase
        .from("publicacoes_djen")
        .select("processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, dedup_conteudo_key, id_djen, coordenacao_id, tribunal")
        .gte("dedup_data_ref", opts.dataInicio)
        .lte("dedup_data_ref", opts.dataFim)
        .not("id_djen", "is", null)
        .limit(5000);
      if (opts.coordenacaoId) {
        servQ = servQ.eq("coordenacao_id", opts.coordenacaoId);
        browQ = browQ.eq("coordenacao_id", opts.coordenacaoId);
      }
      const [serv, brow] = await Promise.all([servQ, browQ]);
      if (serv.error) throw serv.error;
      if (brow.error) throw brow.error;

      const key = (r: {
        coordenacao_id?: string | null;
        id_djen?: string | null;
        dedup_conteudo_key?: string | null;
        dedup_processo_digits?: string | null;
        dedup_data_ref?: string | null;
        hash_conteudo: string;
      }) => r.id_djen
        ? `${r.coordenacao_id || "sem_coord"}|id_djen|${r.id_djen}`
        : (r.dedup_conteudo_key || `${r.coordenacao_id || "sem_coord"}|legacy|${r.dedup_processo_digits || ""}|${r.dedup_data_ref || ""}|${r.hash_conteudo}`);

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
    emAmbos: number;
    soServidor: number;
    soBrowser: number;
    djenUnico: number;
  }>;
  linhas: ComparadorAnaliseLinha[];
  totais: {
    servidor: number;
    browser: number;
    emAmbos: number;
    soServidor: number;
    soBrowser: number;
  };
  porFonte: {
    totais: {
      djenServidor: number;
      djenBrowser: number;
      djenUnico: number; // união de servidor+browser
      kurier: number;
      pautas: number;
    };
    linhas: Array<{
      coordenacaoId: string;
      coordenacaoNome: string;
      djenServidor: number;
      djenBrowser: number;
      djenUnico: number;
      kurier: number;
      pautas: number | null; // null = não atribuível por coord
    }>;
  };
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
    provavel_causa: string | null;
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
        "processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, dedup_conteudo_key, id_djen, coordenacao_id, monitoramento_id, tribunal, data_disponibilizacao, data_publicacao, tipo_publicacao, created_at";
      const inicioDispoTs = `${opts.dataInicio}T00:00:00Z`;
      const fimDispoTs = `${opts.dataFim}T23:59:59Z`;
      const origem = opts.origem || "todos";
      let servQ = supabase
        .from("publicacoes_djen_servidor")
        .select(baseCols)
        .gte("data_disponibilizacao", inicioDispoTs)
        .lte("data_disponibilizacao", fimDispoTs)
        .not("id_djen", "is", null)
        .limit(20000);
      let browQ = supabase
        .from("publicacoes_djen")
        .select(baseCols)
        .gte("data_disponibilizacao", inicioDispoTs)
        .lte("data_disponibilizacao", fimDispoTs)
        .not("id_djen", "is", null)
        .limit(20000);
      if (opts.coordenacaoId) {
        servQ = servQ.eq("coordenacao_id", opts.coordenacaoId);
        browQ = browQ.eq("coordenacao_id", opts.coordenacaoId);
      }

      // Filtro por origem aplicado nas duas tabelas DJEN.
      // - termos: tudo que NÃO é pauta (intimacao + parte + nulos legados)
      // - pautas: somente tipo_publicacao='pauta'
      // - kurier: zera as linhas DJEN (kurier vem só do bloco kurier_publicacoes_raw)
      if (origem === "termos") {
        servQ = servQ.or("tipo_publicacao.is.null,tipo_publicacao.neq.pauta");
        browQ = browQ.or("tipo_publicacao.is.null,tipo_publicacao.neq.pauta");
      } else if (origem === "pautas") {
        servQ = servQ.eq("tipo_publicacao", "pauta");
        browQ = browQ.eq("tipo_publicacao", "pauta");
      } else if (origem === "kurier") {
        // Não busca DJEN — força resultado vazio mantendo a query válida.
        servQ = servQ.eq("id_djen", "__NONE__");
        browQ = browQ.eq("id_djen", "__NONE__");
      }

      // Filtros adicionais (kurier / pautas)
      const inicioTs = `${opts.dataInicio}T00:00:00Z`;
      const fimTs = `${opts.dataFim}T23:59:59Z`;

      let kurierQ = supabase
        .from("kurier_publicacoes_raw")
        .select("id_kurier, credencial_id, recebida_em")
        .gte("recebida_em", inicioTs)
        .lte("recebida_em", fimTs)
        .limit(50000);
      let pautasQ = supabase
        .from("pautas_tst")
        .select("id, processo_numero, data_julgamento")
        .gte("data_julgamento", opts.dataInicio)
        .lte("data_julgamento", opts.dataFim)
        .limit(50000);

      // Quando o usuário escolhe uma origem específica, zeramos os blocos
      // das outras fontes para evitar números confusos no resumo.
      if (origem === "termos" || origem === "pautas") {
        kurierQ = kurierQ.eq("id_kurier", "__NONE__");
      }
      if (origem === "termos" || origem === "kurier") {
        pautasQ = pautasQ.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      const [serv, brow, coords, monits, kurierRes, pautasRes, vincKurier] = await Promise.all([
        servQ,
        browQ,
        supabase.from("coordenacoes").select("id, nome"),
        supabase.from("monitoramentos_djen").select("id, tipo, coordenacao_id, termo_busca, tribunais"),
        kurierQ,
        pautasQ,
        supabase.from("kurier_credencial_coordenacoes").select("credencial_id, coordenacao_id"),
      ]);
      if (serv.error) throw serv.error;
      if (brow.error) throw brow.error;
      if (coords.error) throw coords.error;
      if (monits.error) throw monits.error;
      if (kurierRes.error) console.warn("[comparador] kurier:", kurierRes.error.message);
      if (pautasRes.error) console.warn("[comparador] pautas:", pautasRes.error.message);
      if (vincKurier.error) console.warn("[comparador] kurier_credencial_coordenacoes:", vincKurier.error.message);

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

      // Execuções servidor da janela (para causa "sem_execucao" / "antes_da_execucao")
      let execQ = supabase
        .from("execucoes_servidor")
        .select("id, payload, finalizado_em, status, agendado_para")
        .eq("tipo", "djen_paralela_servidor")
        .gte("agendado_para", `${opts.dataInicio}T00:00:00Z`)
        .lte("agendado_para", `${opts.dataFim}T23:59:59Z`)
        .in("status", ["concluido", "executando"])
        .limit(2000);
      const execRes = await execQ;
      const ultimaExecPorCoordDia = new Map<string, string>(); // key coord|diaYmd -> finalizado_em ISO
      for (const e of (execRes.data || []) as Array<{ payload: any; finalizado_em: string | null }>) {
        const p = e.payload || {};
        const cid = p.coordenacaoId || null;
        const di = String(p.dataInicio || p.diarioYmd || "").slice(0, 10);
        const df = String(p.dataFim || p.diarioYmd || di).slice(0, 10);
        if (!cid || !di) continue;
        const dias: string[] = [];
        const start = new Date(`${di}T12:00:00Z`);
        const end = new Date(`${df || di}T12:00:00Z`);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          for (const cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
            dias.push(cur.toISOString().slice(0, 10));
          }
        }
        for (const dia of dias) {
          const key = `${cid}|${dia}`;
          const prev = ultimaExecPorCoordDia.get(key);
          const fim = e.finalizado_em || "";
          if (!prev || (fim && fim > prev)) ultimaExecPorCoordDia.set(key, fim);
        }
      }

      // Servidor + Browser já capturaram este id_djen em alguma coordenação? Se sim,
      // e a coord atual não tem, é falha de resgate cross-coord (o dado existe no
      // banco mas o motor não copiou para a coord). Isso é mais útil que o rótulo
      // genérico "proxy vazio".
      const idDjenServidorPorAlgumaCoord = new Set<string>();
      const idDjenBrowserPorAlgumaCoord = new Set<string>();

      type Row = {
        coordenacao_id?: string | null;
        monitoramento_id?: string | null;
        id_djen?: string | null;
        dedup_conteudo_key?: string | null;
        dedup_processo_digits?: string | null;
        dedup_data_ref?: string | null;
        hash_conteudo: string;
        processo_numero?: string | null;
        tribunal?: string | null;
        data_publicacao?: string | null;
        data_disponibilizacao?: string | null;
        created_at?: string | null;
      };

      // Dedup SEMPRE isolada por coordenação. A mesma publicação pode aparecer
      // em coordenações diferentes (contagem legítima), mas dentro da mesma
      // coord só conta 1x mesmo quando vários monitoramentos a encontraram.
      const key = (r: Row) => {
        const coord = r.coordenacao_id || "sem_coord";
        if (r.id_djen) return `${coord}|id_djen|${r.id_djen}`;
        if (r.dedup_conteudo_key) return `${coord}|ck|${r.dedup_conteudo_key}`;
        return `${coord}|legacy|${r.dedup_processo_digits || ""}|${r.dedup_data_ref || ""}|${r.hash_conteudo}`;
      };

      const groupKey = (r: Row) => {
        const coordId = r.coordenacao_id || "sem_coord";
        const tipo = (r.monitoramento_id && monitTipo.get(r.monitoramento_id)) || "sem_monitoramento";
        return `${coordId}::${tipo}`;
      };

      const sRows = (serv.data || []) as Row[];
      const bRows = (brow.data || []) as Row[];
      for (const r of sRows) if (r.id_djen) idDjenServidorPorAlgumaCoord.add(String(r.id_djen));
      for (const r of bRows) if (r.id_djen) idDjenBrowserPorAlgumaCoord.add(String(r.id_djen));

      const provavelCausa = (origem: "so_servidor" | "so_browser", r: Row): string => {
        const cid = r.coordenacao_id || "sem_coord";
        if (origem === "so_servidor") return "faltou_no_browser";
        // so_browser:
        const dia = String(r.data_disponibilizacao || "").slice(0, 10);
        const tribunaisCoord = tribunaisPorCoord.get(cid);
        const trib = (r.tribunal || "").toUpperCase();
        if (tribunaisCoord && tribunaisCoord.size > 0 && trib && !tribunaisCoord.has(trib)) {
          return "tribunal_fora_do_monitoramento_servidor";
        }
        const ultima = ultimaExecPorCoordDia.get(`${cid}|${dia}`);
        if (!ultima) return "sem_execucao_servidor_para_esta_data";
        const cap = r.created_at || "";
        if (cap && cap > ultima) return "browser_capturou_depois_da_ultima_execucao_servidor";
        if (r.id_djen && idDjenServidorPorAlgumaCoord.has(String(r.id_djen))) {
          return "falha_resgate_cross_coordenacao_servidor_ja_tem_id_em_outra_coord";
        }
        if (r.id_djen && idDjenBrowserPorAlgumaCoord.has(String(r.id_djen))) {
          return "falha_resgate_cross_coordenacao_browser_tem_id_em_outra_coord";
        }
        return "possivel_proxy_vazio_ou_api_instavel";
      };

      const sByKey = new Map(sRows.map((r) => [key(r), r] as const));
      const bByKey = new Map(bRows.map((r) => [key(r), r] as const));

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
      const rowTipo = (r: Row) =>
        (r.monitoramento_id && monitTipo.get(r.monitoramento_id)) || "sem_monitoramento";
      const rowCoord = (r: Row) => r.coordenacao_id || "sem_coord";
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
      const credToCoords = new Map<string, string[]>();
      for (const v of (vincKurier.data || []) as Array<{ credencial_id: string; coordenacao_id: string }>) {
        const arr = credToCoords.get(v.credencial_id) || [];
        arr.push(v.coordenacao_id);
        credToCoords.set(v.credencial_id, arr);
      }

      // Kurier por coord — atribui cada publicação a todas as coords vinculadas
      // à credencial; dedupe id_kurier por coord. Respeita filtro de coord se houver.
      const kurierPorCoord = new Map<string, Set<string>>();
      for (const k of (kurierRes.data || []) as Array<{ id_kurier: string; credencial_id: string }>) {
        const coordsArr = credToCoords.get(k.credencial_id) || ["sem_coord"];
        for (const cid of coordsArr) {
          if (opts.coordenacaoId && cid !== opts.coordenacaoId) continue;
          let s = kurierPorCoord.get(cid);
          if (!s) { s = new Set(); kurierPorCoord.set(cid, s); }
          s.add(k.id_kurier);
        }
      }
      const kurierTotal = new Set<string>(
        ((kurierRes.data || []) as Array<{ id_kurier: string; credencial_id: string }>)
          .filter((k) => {
            if (!opts.coordenacaoId) return true;
            const arr = credToCoords.get(k.credencial_id) || [];
            return arr.includes(opts.coordenacaoId);
          })
          .map((k) => k.id_kurier),
      ).size;

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
          kurier: (kurierPorCoord.get(cid) || new Set<string>()).size,
          pautas: null as number | null,
        };
      }).sort((a, b) => a.coordenacaoNome.localeCompare(b.coordenacaoNome, "pt-BR"));

      const globalLinhas = Array.from(new Set<string>([
        ...djenServPorCoord.keys(),
        ...djenBrowPorCoord.keys(),
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
          emAmbos,
          soServidor,
          soBrowser,
          djenUnico: emAmbos + soServidor + soBrowser,
        };
      }).sort((a, b) => a.coordenacaoNome.localeCompare(b.coordenacaoNome, "pt-BR"));

      const djenUnicoTotal = new Set<string>([...sByKey.keys(), ...bByKey.keys()]).size;

      // Detalhamento: publicações exclusivas por origem (para CSV)
      const detalhes: ComparadorAnaliseRelatorio["detalhes"] = [];
      const pickDataPub = (r: Row) => r.data_publicacao || r.data_disponibilizacao || null;
      for (const [k, r] of sByKey) {
        if (bByKey.has(k)) continue;
        const meta = keyToBucket.get(k);
        const cid = meta?.coordenacaoId || (r.coordenacao_id || "sem_coord");
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
          execucao_id_servidor: null,
          provavel_causa: provavelCausa("so_servidor", r),
        });
      }
      for (const [k, r] of bByKey) {
        if (sByKey.has(k)) continue;
        const meta = keyToBucket.get(k);
        const cid = meta?.coordenacaoId || (r.coordenacao_id || "sem_coord");
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
          execucao_id_servidor: null,
          provavel_causa: provavelCausa("so_browser", r),
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
        },
        porFonte: {
          totais: {
            djenServidor: totServ,
            djenBrowser: totBrow,
            djenUnico: djenUnicoTotal,
            kurier: kurierTotal,
            pautas: pautasTotal,
          },
          linhas: fonteLinhas,
        },
        detalhes,
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