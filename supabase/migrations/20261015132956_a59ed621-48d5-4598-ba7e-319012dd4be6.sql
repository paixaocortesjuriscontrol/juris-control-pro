CREATE INDEX IF NOT EXISTS idx_tarefas_data_cumprimento ON public.tarefas (data_cumprimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_data_fatal ON public.tarefas (data_fatal);
CREATE INDEX IF NOT EXISTS idx_tarefas_coord_created ON public.tarefas (coordenacao_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tarefas_coord_cumprimento ON public.tarefas (coordenacao_id, data_cumprimento);
ANALYZE public.tarefas;