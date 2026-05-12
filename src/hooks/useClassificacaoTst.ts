import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ClassificacaoTst = "POSITIVO" | "NEGATIVO" | "IMPEDIDA";

export interface TurmaTst {
  id: string;
  nome: string;
  classificacao: ClassificacaoTst;
  observacao: string | null;
}

export interface RelatorTst {
  id: string;
  nome: string;
  cargo: string | null;
  classificacao: ClassificacaoTst;
  observacao: string | null;
  turma_id: string | null;
}

function normalizar(t: string): string {
  return (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classificarTurmaDB(
  turma: string | null | undefined,
  lista: TurmaTst[],
): ClassificacaoTst | null {
  if (!turma) return null;
  const n = normalizar(turma);
  for (const t of lista) {
    const alvo = normalizar(t.nome);
    if (n === alvo || n.includes(alvo) || alvo.includes(n)) return t.classificacao;
  }
  if (n.includes("sbdi 1") || n.includes("sbdi1") || n.includes("sdi 1") || n.includes("sdi1")) {
    return lista.find(t => normalizar(t.nome).includes("sbdi 1"))?.classificacao ?? null;
  }
  if (n.includes("sbdi 2") || n.includes("sbdi2") || n.includes("sdi 2") || n.includes("sdi2")) {
    return lista.find(t => normalizar(t.nome).includes("sbdi 2"))?.classificacao ?? null;
  }
  if (n.includes("pleno") || n.includes("orgao especial")) {
    return lista.find(t => normalizar(t.nome) === "pleno")?.classificacao ?? null;
  }
  return null;
}

export function classificarRelatorDB(
  relator: string | null | undefined,
  lista: RelatorTst[],
): { classificacao: ClassificacaoTst; relator: RelatorTst } | null {
  if (!relator) return null;
  const n = normalizar(relator)
    .replace(/\b(ministro|ministra|min|exmo|exma|sr|sra|desembargador|desembargadora|des)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return null;
  let melhor: { score: number; r: RelatorTst } | null = null;
  for (const r of lista) {
    const alvo = normalizar(r.nome);
    if (n === alvo) return { classificacao: r.classificacao, relator: r };
    if (n.includes(alvo) || alvo.includes(n)) {
      const score = Math.min(n.length, alvo.length);
      if (!melhor || score > melhor.score) melhor = { score, r };
      continue;
    }
    const partesN = new Set(n.split(" ").filter(p => p.length > 2));
    const partesAlvo = alvo.split(" ").filter(p => p.length > 2);
    const intersec = partesAlvo.filter(p => partesN.has(p)).length;
    if (intersec >= 2) {
      const score = intersec * 10;
      if (!melhor || score > melhor.score) melhor = { score, r };
    }
  }
  return melhor ? { classificacao: melhor.r.classificacao, relator: melhor.r } : null;
}

export function useTurmasTst() {
  return useQuery({
    queryKey: ["classificacao-turmas-tst"],
    queryFn: async (): Promise<TurmaTst[]> => {
      const { data, error } = await supabase
        .from("classificacao_turmas_tst" as any)
        .select("id, nome, classificacao, observacao")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as any;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRelatoresTst() {
  return useQuery({
    queryKey: ["classificacao-relatores-tst"],
    queryFn: async (): Promise<RelatorTst[]> => {
      const { data, error } = await supabase
        .from("classificacao_relatores_tst" as any)
        .select("id, nome, cargo, classificacao, observacao, turma_id")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as any;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertTurmaTst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TurmaTst> & { nome: string; classificacao: ClassificacaoTst }) => {
      const payload: any = {
        nome: input.nome.trim(),
        classificacao: input.classificacao,
        observacao: input.observacao ?? null,
      };
      if (input.id) {
        const { error } = await supabase
          .from("classificacao_turmas_tst" as any)
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classificacao_turmas_tst" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["classificacao-turmas-tst"] });
      toast({ title: "Turma salva" });
    },
    onError: (err: any) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteTurmaTst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classificacao_turmas_tst" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["classificacao-turmas-tst"] });
      toast({ title: "Turma removida" });
    },
    onError: (err: any) => toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
  });
}

export function useUpsertRelatorTst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RelatorTst> & { nome: string; classificacao: ClassificacaoTst }) => {
      const payload: any = {
        nome: input.nome.trim(),
        cargo: input.cargo ?? null,
        classificacao: input.classificacao,
        observacao: input.observacao ?? null,
        turma_id: input.turma_id ?? null,
      };
      if (input.id) {
        const { error } = await supabase
          .from("classificacao_relatores_tst" as any)
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classificacao_relatores_tst" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["classificacao-relatores-tst"] });
      toast({ title: "Relator salvo" });
    },
    onError: (err: any) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteRelatorTst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classificacao_relatores_tst" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["classificacao-relatores-tst"] });
      toast({ title: "Relator removido" });
    },
    onError: (err: any) => toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
  });
}
