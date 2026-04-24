UPDATE execucoes_agendadas
SET status = 'cancelado',
    finalizado_em = now(),
    detalhes = COALESCE(detalhes, '{}'::jsonb) || jsonb_build_object('mensagem', 'Cancelado: orfa limpa apos travamento do botao Cancelar')
WHERE tipo = 'djen_paralela'
  AND status = 'executando'
  AND finalizado_em IS NULL;