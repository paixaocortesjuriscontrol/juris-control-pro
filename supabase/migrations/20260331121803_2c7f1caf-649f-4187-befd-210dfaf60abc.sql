UPDATE configuracoes_monitoramento SET metadata = jsonb_set(jsonb_set(coalesce(metadata, '{}'::jsonb), '{cancelado}', 'true', true), '{status}', '"cancelado"', true), ativo = false WHERE tipo = 'djen_processos';

UPDATE execucoes_agendadas SET status = 'cancelado', finalizado_em = now() WHERE tipo = 'djen_processos' AND status = 'executando';