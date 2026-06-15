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
  data?: string;
  status: "pendente" | "executando" | "concluido" | "erro";
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
  heartbeat_at: string;
  started_at: string;
  metadata: Record<string, unknown> | null;
}

export interface PublicacaoServidor {
  id: string;
  monitoramento_id: string;
  processo_numero: string | null;
  tribunal: string | null;
  data_publicacao: string | null;
  data_disponibilizacao: string | null;
  conteudo: string | null;
  origem: string;
  created_at: string;
  hash_conteudo: string;
  dedup_processo_digits: string | null;
  dedup_data_ref: string | null;
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

  return { ...query, toggle };
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

export function useComparadorPublicacoes(opts: { dataInicio: string; dataFim: string }) {
  return useQuery({
    queryKey: ["djen-servidor", "comparador", opts.dataInicio, opts.dataFim],
    queryFn: async () => {
      const [serv, brow] = await Promise.all([
        supabase
          .from("publicacoes_djen_servidor")
          .select("processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, tribunal")
          .gte("dedup_data_ref", opts.dataInicio)
          .lte("dedup_data_ref", opts.dataFim)
          .limit(5000),
        supabase
          .from("publicacoes_djen")
          .select("processo_numero, dedup_processo_digits, dedup_data_ref, hash_conteudo, tribunal")
          .gte("dedup_data_ref", opts.dataInicio)
          .lte("dedup_data_ref", opts.dataFim)
          .limit(5000),
      ]);
      if (serv.error) throw serv.error;
      if (brow.error) throw brow.error;

      const key = (r: { dedup_processo_digits?: string | null; dedup_data_ref?: string | null; hash_conteudo: string }) =>
        `${r.dedup_processo_digits || ""}|${r.dedup_data_ref || ""}|${r.hash_conteudo}`;

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

export function useTickAge() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}