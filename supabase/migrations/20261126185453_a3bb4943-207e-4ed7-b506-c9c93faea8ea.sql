CREATE OR REPLACE FUNCTION public.modelos_tarefas_periodo(_de date, _ate date, _coords uuid[] DEFAULT NULL)
RETURNS TABLE(id uuid, nome text, cor text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH t AS (
    SELECT v.id, v.modelo_tarefa_id, v.origem
      FROM _agenda_tarefas_visiveis(_de, _ate, false, NULL, _coords) v
     WHERE v.modelo_tarefa_id IS NOT NULL OR v.origem = 'workflow'
  ), wf AS (
    SELECT DISTINCT ON (e.item_id) e.item_id, we.campos_item->>'cor' AS cor
      FROM workflow_execucao_etapas e
      JOIN workflow_etapas we ON we.id = e.etapa_id
     WHERE e.item_id IN (SELECT t.id FROM t WHERE t.origem = 'workflow')
       AND coalesce(we.campos_item->>'cor','') <> ''
  )
  SELECT t.id, coalesce(m.nome, ''), coalesce(wf.cor, m.padroes->>'cor')
    FROM t
    LEFT JOIN modelos_titulo_coordenacao m ON m.id = t.modelo_tarefa_id
    LEFT JOIN wf ON wf.item_id = t.id
   WHERE m.id IS NOT NULL OR wf.cor IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.modelos_tarefas_periodo(date, date, uuid[]) TO authenticated;