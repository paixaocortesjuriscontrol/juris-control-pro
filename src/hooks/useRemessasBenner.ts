import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RemessaBenner {
  id: string;
  numero_sequencial: string;
  status: "gerada" | "enviada" | "retornada" | "conciliada" | "cancelada";
  data_geracao: string;
  data_envio: string | null;
  data_conciliacao: string | null;
  quantidade_itens: number;
  quantidade_aceitos: number;
  quantidade_rejeitados: number;
  quantidade_pendentes: number;
  filtros_aplicados: any;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  email_destinatarios: string[] | null;
  email_cc: string[] | null;
  email_assunto: string | null;
  email_corpo: string | null;
  observacoes: string | null;
  created_by: string | null;
  enviado_por: string | null;
  coordenacao_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemessaItem {
  id: string;
  remessa_id: string;
  dado_benner_id: string | null;
  dossie: string | null;
  processo: string | null;
  turma: string | null;
  relator: string | null;
  tribunal: string | null;
  status_retorno: "pendente" | "aceito" | "rejeitado";
  motivo_retorno: string | null;
  created_at: string;
}

export function useRemessasBenner() {
  return useQuery({
    queryKey: ["remessas_benner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remessas_benner" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as any[]) as RemessaBenner[];
    },
    staleTime: 30_000,
  });
}

export function useRemessaItens(remessaId: string | null) {
  return useQuery({
    queryKey: ["remessa_itens", remessaId],
    queryFn: async () => {
      if (!remessaId) return [] as RemessaItem[];
      const { data, error } = await supabase
        .from("remessas_benner_itens" as any)
        .select("*")
        .eq("remessa_id", remessaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as RemessaItem[];
    },
    enabled: !!remessaId,
  });
}

export interface CriarRemessaInput {
  arquivo: Blob;
  arquivoNome: string;
  filtros: any;
  itens: {
    dado_benner_id?: string | null;
    dossie?: string;
    processo?: string;
    turma?: string;
    relator?: string;
    tribunal?: string;
  }[];
  emailDestinatarios?: string[];
  emailCc?: string[];
  emailAssunto?: string;
  emailCorpo?: string;
  observacoes?: string;
}

export function useCriarRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarRemessaInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Usuário não autenticado");

      // Get sequential number
      const { data: numData, error: numErr } = await supabase.rpc("gerar_numero_remessa_benner" as any);
      if (numErr) throw numErr;
      const numero = String(numData);

      // Upload file to storage
      const path = `${new Date().getFullYear()}/${numero}/${input.arquivoNome}`;
      const { error: upErr } = await supabase.storage
        .from("cargas-benner-remessas")
        .upload(path, input.arquivo, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });
      if (upErr) throw upErr;

      // Insert remessa
      const { data: remessa, error: insErr } = await supabase
        .from("remessas_benner" as any)
        .insert({
          numero_sequencial: numero,
          status: "gerada",
          quantidade_itens: input.itens.length,
          quantidade_pendentes: input.itens.length,
          filtros_aplicados: input.filtros ?? null,
          arquivo_path: path,
          arquivo_nome: input.arquivoNome,
          email_destinatarios: input.emailDestinatarios ?? null,
          email_cc: input.emailCc ?? null,
          email_assunto: input.emailAssunto ?? null,
          email_corpo: input.emailCorpo ?? null,
          observacoes: input.observacoes ?? null,
          created_by: uid,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;

      const remessaId = (remessa as any).id as string;

      // Insert itens in batches
      const BATCH = 500;
      for (let i = 0; i < input.itens.length; i += BATCH) {
        const batch = input.itens.slice(i, i + BATCH).map((it) => ({
          ...it,
          remessa_id: remessaId,
          status_retorno: "pendente",
        }));
        const { error: itErr } = await supabase
          .from("remessas_benner_itens" as any)
          .insert(batch);
        if (itErr) throw itErr;
      }

      // Update status of dados_benner → "planilhado"
      const ids = input.itens.map((i) => i.dado_benner_id).filter(Boolean) as string[];
      const UB = 200;
      for (let i = 0; i < ids.length; i += UB) {
        const batch = ids.slice(i, i + UB);
        await supabase
          .from("dados_benner" as any)
          .update({ status: "planilhado" } as any)
          .in("id", batch);
      }

      await qc.invalidateQueries({ queryKey: ["remessas_benner"] });
      return remessa as any as RemessaBenner;
    },
    onError: (err: any) => toast.error("Erro ao criar remessa: " + (err?.message || String(err))),
  });
}

export async function baixarArquivoRemessa(arquivoPath: string, arquivoNome: string) {
  const { data, error } = await supabase.storage
    .from("cargas-benner-remessas")
    .createSignedUrl(arquivoPath, 60 * 5);
  if (error || !data?.signedUrl) {
    toast.error("Erro ao baixar arquivo: " + (error?.message || ""));
    return;
  }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = arquivoNome;
  a.click();
}

export function useEnviarRemessaEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      remessaId: string;
      para: string[];
      cc?: string[];
      assunto: string;
      corpo: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("enviar-remessa-benner", {
        body: input,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["remessas_benner"] });
      toast.success("Remessa enviada por e-mail!");
    },
    onError: (err: any) => toast.error("Erro ao enviar: " + (err?.message || String(err))),
  });
}

export function useMarcarRemessaEnviada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (remessaId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      const { error } = await supabase
        .from("remessas_benner" as any)
        .update({
          status: "enviada",
          data_envio: new Date().toISOString(),
          enviado_por: uid,
        } as any)
        .eq("id", remessaId);
      if (error) throw error;

      // Update dados_benner status of items to 'enviado'
      const { data: itens } = await supabase
        .from("remessas_benner_itens" as any)
        .select("dado_benner_id")
        .eq("remessa_id", remessaId);
      const ids = ((itens as any[]) || []).map((i: any) => i.dado_benner_id).filter(Boolean);
      const UB = 200;
      for (let i = 0; i < ids.length; i += UB) {
        const batch = ids.slice(i, i + UB);
        await supabase
          .from("dados_benner" as any)
          .update({ status: "enviado" } as any)
          .in("id", batch);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["remessas_benner"] });
      toast.success("Remessa marcada como enviada");
    },
    onError: (err: any) => toast.error("Erro: " + (err?.message || String(err))),
  });
}

export function useCancelarRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (remessaId: string) => {
      const { error } = await supabase
        .from("remessas_benner" as any)
        .update({ status: "cancelada" } as any)
        .eq("id", remessaId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["remessas_benner"] });
      toast.success("Remessa cancelada");
    },
    onError: (err: any) => toast.error("Erro: " + (err?.message || String(err))),
  });
}

export function useConciliarRetorno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      remessaId: string;
      atualizacoes: { dossie: string; status: "aceito" | "rejeitado"; motivo?: string }[];
    }) => {
      const { data: itens, error } = await supabase
        .from("remessas_benner_itens" as any)
        .select("id, dossie")
        .eq("remessa_id", input.remessaId);
      if (error) throw error;

      const norm = (s: string) => String(s || "").replace(/\s+/g, "").toLowerCase();
      const map = new Map(((itens as any[]) || []).map((i: any) => [norm(i.dossie), i.id]));

      let aceitos = 0,
        rejeitados = 0;
      const ops = input.atualizacoes
        .map((a) => {
          const id = map.get(norm(a.dossie));
          if (!id) return null;
          if (a.status === "aceito") aceitos++;
          if (a.status === "rejeitado") rejeitados++;
          return { id, status_retorno: a.status, motivo_retorno: a.motivo ?? null };
        })
        .filter(Boolean) as any[];

      for (const op of ops) {
        await supabase
          .from("remessas_benner_itens" as any)
          .update({ status_retorno: op.status_retorno, motivo_retorno: op.motivo_retorno } as any)
          .eq("id", op.id);
      }

      const totalItens = (itens as any[])?.length ?? 0;
      const pendentes = totalItens - aceitos - rejeitados;

      await supabase
        .from("remessas_benner" as any)
        .update({
          status: "conciliada",
          data_conciliacao: new Date().toISOString(),
          quantidade_aceitos: aceitos,
          quantidade_rejeitados: rejeitados,
          quantidade_pendentes: pendentes,
        } as any)
        .eq("id", input.remessaId);

      return { aceitos, rejeitados, pendentes };
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["remessas_benner"] });
      await qc.invalidateQueries({ queryKey: ["remessa_itens"] });
      toast.success(`Conciliado: ${res.aceitos} aceito(s), ${res.rejeitados} rejeitado(s), ${res.pendentes} pendente(s)`);
    },
    onError: (err: any) => toast.error("Erro: " + (err?.message || String(err))),
  });
}