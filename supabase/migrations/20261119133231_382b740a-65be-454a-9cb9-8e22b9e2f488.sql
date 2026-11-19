CREATE POLICY "Quem ve a atividade ve o historico"
ON public.auditoria_tarefas FOR SELECT TO authenticated
USING (
  tarefa_id IS NOT NULL AND (
    (tipo_item IN ('tarefa','prazo') AND EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = auditoria_tarefas.tarefa_id))
    OR (tipo_item = 'evento' AND EXISTS (SELECT 1 FROM public.eventos_agenda e WHERE e.id = auditoria_tarefas.tarefa_id))
    OR (tipo_item = 'audiencia' AND EXISTS (SELECT 1 FROM public.audiencias_detectadas a WHERE a.id = auditoria_tarefas.tarefa_id))
  )
);
CREATE INDEX IF NOT EXISTS idx_auditoria_tarefas_tarefa_id ON public.auditoria_tarefas(tarefa_id);