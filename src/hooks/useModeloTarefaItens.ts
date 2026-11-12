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
      // Cor escolhida na etapa do workflow tem prioridade sobre a cor do modelo.
      const wf: string[] = [];
      for (let off = 0; ; off += 1000) {
        const { data, error } = await db.from("tarefas").select("id")
          .eq("origem", "workflow").gte("data_vencimento", de).lte("data_vencimento", ate)
          .order("id").range(off, off + 999);
        if (error) throw error;
        wf.push(...(data || []).map((t: any) => t.id));
        if (!data || data.length < 1000) break;
      }
      for (let k = 0; k < wf.length; k += 100) {
        const { data, error } = await db.from("workflow_execucao_etapas")
          .select("item_id, workflow_etapas(campos_item)").in("item_id", wf.slice(k, k + 100));
        if (error) break;
        for (const r of data || []) {
          const cor = r.workflow_etapas?.campos_item?.cor;
          if (cor && r.item_id) mapa.set(r.item_id, { nome: mapa.get(r.item_id)?.nome || "", cor });
        }
      }
      // Audiências e eventos não guardam o modelo: usa o modelo do mesmo tipo
      // e coordenação cujo nome é igual ao título do item. Branco é ignorado
      // (cor padrão, não aparece na agenda).
      const norm = (v?: string | null) => (v || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const corValida = (c?: string | null) => !!c && !/^#?f{3}(f{3})?$/i.test(c.trim());
      const { data: mods } = await db.from("modelos_titulo_coordenacao")
        .select("nome,tipo,coordenacao_id,padroes,ativo").in("tipo", ["audiencia", "evento"]);
      const porChave = new Map<string, ModeloDoItem>();
      for (const m of (mods || []).filter((x: any) => x.ativo !== false)) {
        const cor = m.padroes?.cor;
        if (!corValida(cor)) continue;
        porChave.set(`${m.tipo}|${m.coordenacao_id}|${norm(m.nome)}`, { nome: m.nome, cor });
      }
      if (porChave.size > 0) {
        for (let off = 0; ; off += 1000) {
          const { data, error } = await db.from("audiencias_detectadas").select("id,titulo,tipo_audiencia,coordenacao_id")
            .gte("data_audiencia", de).lte("data_audiencia", ate).order("id").range(off, off + 999);
          if (error) break;
          for (const a of data || []) {
            const m = porChave.get(`audiencia|${a.coordenacao_id}|${norm(a.titulo || a.tipo_audiencia)}`)
              || porChave.get(`audiencia|${a.coordenacao_id}|${norm(a.tipo_audiencia)}`);
            if (m) mapa.set(a.id, m);
          }
          if (!data || data.length < 1000) break;
        }
        for (let off = 0; ; off += 1000) {
          const { data, error } = await db.from("eventos_agenda").select("id,titulo,tipo,coordenacao_id")
            .gte("data_inicio", de).lte("data_inicio", `${ate}T23:59:59`).order("id").range(off, off + 999);
          if (error) break;
          for (const ev of data || []) {
            const m = porChave.get(`evento|${ev.coordenacao_id}|${norm(ev.titulo)}`)
              || porChave.get(`evento|${ev.coordenacao_id}|${norm(ev.tipo)}`);
            if (m) mapa.set(ev.id, m);
          }
          if (!data || data.length < 1000) break;
        }
      }
      return mapa;
    },
  });
}
