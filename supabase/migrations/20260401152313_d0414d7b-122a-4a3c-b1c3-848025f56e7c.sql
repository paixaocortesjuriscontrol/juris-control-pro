DELETE FROM publicacoes_djen WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo';

DELETE FROM publicacoes_djen_descartadas WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo';

DELETE FROM execucoes_agendadas WHERE tipo = 'djen_pro' AND created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo';