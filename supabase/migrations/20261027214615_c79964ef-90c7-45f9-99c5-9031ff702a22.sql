DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('coordenacoes','Assistente geral visualiza coordenacoes'),
    ('membros_coordenacao','Assistente geral visualiza membros'),
    ('tarefas','Assistente geral visualiza tarefas'),
    ('eventos_agenda','Assistente geral visualiza eventos'),
    ('audiencias_detectadas','Assistente geral visualiza audiencias'),
    ('publicacoes_djen','Assistente geral visualiza publicacoes'),
    ('monitoramentos_djen','Assistente geral visualiza monitoramentos')) v(t,p)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING ((SELECT public.is_assistente_juridico_geral(auth.uid())))', r.p, r.t);
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_tarefas_coord_tipo_tarefa_venc ON public.tarefas (coordenacao_id, tipo_tarefa, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_venc_status ON public.tarefas (data_vencimento, status);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_data_status ON public.eventos_agenda (data_inicio, status);