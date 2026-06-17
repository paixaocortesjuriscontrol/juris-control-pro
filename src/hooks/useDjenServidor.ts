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
        .limit(5000);
      let browQ = supabase
        .from("publicacoes_djen")
        .select("processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, dedup_conteudo_key, id_djen, coordenacao_id, tribunal")
        .gte("dedup_data_ref", opts.dataInicio)
        .lte("dedup_data_ref", opts.dataFim)
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
    }): Promise<ComparadorAnaliseRelatorio> => {
      const baseCols =
        "processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, dedup_conteudo_key, id_djen, coordenacao_id, monitoramento_id, tribunal";
      let servQ = supabase
        .from("publicacoes_djen_servidor")
        .select(baseCols)
        .gte("dedup_data_ref", opts.dataInicio)
        .lte("dedup_data_ref", opts.dataFim)
        .limit(20000);
      let browQ = supabase
        .from("publicacoes_djen")
        .select(baseCols)
        .gte("dedup_data_ref", opts.dataInicio)
        .lte("dedup_data_ref", opts.dataFim)
        .limit(20000);
      if (opts.coordenacaoId) {
        servQ = servQ.eq("coordenacao_id", opts.coordenacaoId);
        browQ = browQ.eq("coordenacao_id", opts.coordenacaoId);
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

      const [serv, brow, coords, monits, kurierRes, pautasRes, vincKurier] = await Promise.all([
        servQ,
        browQ,
        supabase.from("coordenacoes").select("id, nome"),
        supabase.from("monitoramentos_djen").select("id, tipo, coordenacao_id"),
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

      type Row = {
        coordenacao_id?: string | null;
        monitoramento_id?: string | null;
        id_djen?: string | null;
        dedup_conteudo_key?: string | null;
        dedup_processo_digits?: string | null;
        dedup_data_ref?: string | null;
        hash_conteudo: string;
      };

      const key = (r: Row) =>
        r.id_djen
          ? `${r.coordenacao_id || "sem_coord"}|id_djen|${r.id_djen}`
          : r.dedup_conteudo_key ||
            `${r.coordenacao_id || "sem_coord"}|legacy|${r.dedup_processo_digits || ""}|${r.dedup_data_ref || ""}|${r.hash_conteudo}`;

      const groupKey = (r: Row) => {
        const coordId = r.coordenacao_id || "sem_coord";
        const tipo = (r.monitoramento_id && monitTipo.get(r.monitoramento_id)) || "sem_monitoramento";
        return `${coordId}::${tipo}`;
      };

      const sRows = (serv.data || []) as Row[];
      const bRows = (brow.data || []) as Row[];

      const sByKey = new Map(sRows.map((r) => [key(r), r] as const));
      const bByKey = new Map(bRows.map((r) => [key(r), r] as const));

      type Bucket = {
        coordenacaoId: string;
        tipo: string;
        servidor: Set<string>;
        browser: Set<string>;
      };
      const buckets = new Map<string, Bucket>();
      const ensure = (r: Row): Bucket => {
        const gk = groupKey(r);
        let b = buckets.get(gk);
        if (!b) {
          b = {
            coordenacaoId: r.coordenacao_id || "sem_coord",
            tipo: (r.monitoramento_id && monitTipo.get(r.monitoramento_id)) || "sem_monitoramento",
            servidor: new Set(),
            browser: new Set(),
          };
          buckets.set(gk, b);
        }
        return b;
      };
      for (const r of sRows) ensure(r).servidor.add(key(r));
      for (const r of bRows) ensure(r).browser.add(key(r));

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

      const djenUnicoTotal = new Set<string>([...sByKey.keys(), ...bByKey.keys()]).size;

      return {
        dataInicio: opts.dataInicio,
        dataFim: opts.dataFim,
        geradoEm: new Date().toISOString(),
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