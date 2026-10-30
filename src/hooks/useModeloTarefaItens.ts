import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface ModeloDoItem { nome: string; cor?: string | null }

/**
 * Tarefas do período que vieram de um Modelo de tarefa (inclui tipos do
 * Projuris): devolve, por ID da tarefa, o nome do modelo e a cor.
 * Uma única leitura por período (só as tarefas com modelo), sem listas de IDs.
 */
export function useModeloTarefaItens(inicio: Date, fim: Date) {
  const de = format(inicio, "yyyy-MM-dd");
  const ate = format(fim, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["agenda-modelo-tarefa", de, ate],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const db = supabase as any;
      const tarefas: { id: string; modelo_tarefa_id: string }[] = [];
      for (let off = 0; ; off += 1000) {
        const { data, error } = await db.from("tarefas").select("id,modelo_tarefa_id")
          .not("modelo_tarefa_id", "is", null).gte("data_vencimento", de).lte("data_vencimento", ate)
          .order("id").range(off, off + 999);
        if (error) throw error;
        tarefas.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      const ids = Array.from(new Set(tarefas.map((t) => t.modelo_tarefa_id)));
      const modelos = new Map<string, ModeloDoItem>();
      for (let k = 0; k < ids.length; k += 100) {
        const { data, error } = await db.from("modelos_titulo_coordenacao").select("id,nome,padroes").in("id", ids.slice(k, k + 100));
        if (error) throw error;
        for (const m of data || []) modelos.set(m.id, { nome: m.nome, cor: m.padroes?.cor || null });
      }
      const mapa = new Map<string, ModeloDoItem>();
      for (const t of tarefas) { const m = modelos.get(t.modelo_tarefa_id); if (m) mapa.set(t.id, m); }
      return mapa;
    },
  });
}
