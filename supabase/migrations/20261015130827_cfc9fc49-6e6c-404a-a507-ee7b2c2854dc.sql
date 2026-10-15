DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_ranking_atendimento_geral'::regproc);
  d := replace(d, $a$UNION SELECT r.usuario_id FROM resp r WHERE r.tarefa_id=s.item_id$a$,
   $b$UNION SELECT tr.usuario_id FROM public.tarefa_responsaveis tr WHERE tr.tarefa_id=s.item_id UNION SELECT te.usuario_id FROM public.tarefa_envolvidos te WHERE te.tarefa_id=s.item_id UNION SELECT t.responsavel_id$b$);
  IF position('te.tarefa_id=s.item_id' in d) = 0 THEN RAISE EXCEPTION 'replace falhou'; END IF;
  EXECUTE d;
END $do$;