DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_ranking_atendimento_geral'::regproc);
  d := replace(d,
$a$CASE WHEN b.origem IN ('astrea','projuris','importacao','import','planilha','migracao','carga','benner') THEN a.data_original ELSE b.data_cumprimento END data_conclusao_filtro
  FROM tar_base b LEFT JOIN LATERAL (
   SELECT CASE WHEN at.dados_saida->>'data_cumprimento' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (at.dados_saida->>'data_cumprimento')::timestamptz END data_original
   FROM public.auditoria_tarefas at WHERE at.tarefa_id=b.id AND at.acao='criar' ORDER BY at.created_at LIMIT 1
  ) a ON true$a$,
$b$CASE WHEN b.origem IN ('astrea','projuris','importacao','import','planilha','migracao','carga','benner') THEN (
   SELECT CASE WHEN at.dados_saida->>'data_cumprimento' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (at.dados_saida->>'data_cumprimento')::timestamptz END
   FROM public.auditoria_tarefas at WHERE at.tarefa_id=b.id AND at.acao='criar' ORDER BY at.created_at LIMIT 1
  ) ELSE b.data_cumprimento END data_conclusao_filtro
  FROM tar_base b$b$);
  EXECUTE d;
END $do$;
ALTER FUNCTION public.get_ranking_atendimento_geral(date,date,uuid,uuid) SET statement_timeout = '30s';