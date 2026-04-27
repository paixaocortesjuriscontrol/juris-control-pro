import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MateriaBenner {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type MateriaBennerInsert = {
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
};

export function useMateriasBenner(opts: { onlyAtivas?: boolean } = {}) {
  const { onlyAtivas = false } = opts;
  const [dados, setDados] = useState<MateriaBenner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("materias_benner" as any)
      .select("*")
      .order("nome", { ascending: true })
      .limit(2000);
    if (onlyAtivas) query = query.eq("ativo", true);
    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar matérias: " + error.message);
    } else {
      setDados((data as any[]) as MateriaBenner[]);
    }
    setLoading(false);
  }, [onlyAtivas]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const saveDado = async (dado: MateriaBennerInsert, id?: string) => {
    if (!dado.nome?.trim()) {
      toast.warning("Informe o nome da matéria");
      return false;
    }
    const payload = {
      nome: dado.nome.trim(),
      descricao: dado.descricao?.trim() || null,
      ativo: dado.ativo ?? true,
    };
    if (id) {
      const { error } = await supabase
        .from("materias_benner" as any)
        .update(payload as any)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao atualizar: " + error.message);
        return false;
      }
    } else {
      const { error } = await supabase
        .from("materias_benner" as any)
        .insert(payload as any);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        return false;
      }
    }
    toast.success(id ? "Matéria atualizada!" : "Matéria criada!");
    fetchDados();
    return true;
  };

  const deleteDado = async (id: string) => {
    const { error } = await supabase
      .from("materias_benner" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return false;
    }
    toast.success("Matéria excluída!");
    fetchDados();
    return true;
  };

  return { dados, loading, fetchDados, saveDado, deleteDado };
}