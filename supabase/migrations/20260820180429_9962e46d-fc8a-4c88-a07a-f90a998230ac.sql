UPDATE public.configuracoes_monitoramento_servidor
SET horarios_execucao = ARRAY['07:30','13:00','19:20'],
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('dias_semana', '[1,2,3,4,5]'::jsonb)
WHERE tipo = 'djet_pautas_servidor';