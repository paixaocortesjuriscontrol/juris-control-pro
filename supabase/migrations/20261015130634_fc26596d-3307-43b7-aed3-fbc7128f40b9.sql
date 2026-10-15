DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_ranking_atendimento_geral'::regproc);
  d := replace(d,
$a$FROM public.tarefas t WHERE (p_coordenacao_id IS NULL OR t.coordenacao_id=p_coordenacao_id)
   AND t.created_at < (p_fim + 1)
   AND (t.created_at >= p_inicio OR t.data_cumprimento >= p_inicio
        OR coalesce(t.data_fatal,t.data_vencimento,t.data_prevista) >= p_inicio
        OR EXISTS (SELECT 1 FROM public.subatividades_item s WHERE s.item_id=t.id AND (s.concluida_em >= p_inicio OR s.concluida_em IS NULL))
        OR lower(coalesce(t.origem,'')) IN ('astrea','projuris','importacao','import','planilha','migracao','carga','benner'))$a$,
$b$FROM public.tarefas t WHERE p_coordenacao_id IS NULL OR t.coordenacao_id=p_coordenacao_id$b$);
  d := replace(d, $a$tar AS (
 SELECT b.*,$a$, $b$tar0 AS (
 SELECT b.*,$b$);
  d := replace(d, $a$ ) a ON true
),$a$, $b$ ) a ON true
),
tar AS (
 SELECT * FROM tar0 t
 WHERE t.created_at::date BETWEEN p_inicio AND p_fim
    OR t.prazo BETWEEN p_inicio AND p_fim
    OR t.data_conclusao_filtro::date BETWEEN p_inicio AND p_fim
    OR t.id IN (SELECT s.item_id FROM public.subatividades_item s)
),$b$);
  IF position('FROM tar0 t' in d) = 0 THEN RAISE EXCEPTION 'replace falhou'; END IF;
  EXECUTE d;
END $do$;