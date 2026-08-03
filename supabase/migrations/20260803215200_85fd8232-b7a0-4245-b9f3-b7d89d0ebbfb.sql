WITH t AS (
  SELECT id, regexp_replace(COALESCE((regexp_match(identificador_projuris,'([0-9]{7}-[0-9_\.]+)$'))[1],''),'[^0-9]','','g') AS frag
  FROM public.tarefas
  WHERE identificador_projuris LIKE 'astrea-%' AND processo_id IS NULL
), m AS (
  SELECT t.id, (SELECT p.id FROM public.processos p WHERE regexp_replace(p.numero,'[^0-9]','','g') LIKE t.frag || '%' LIMIT 1) AS pid,
         (SELECT count(*) FROM public.processos p WHERE regexp_replace(p.numero,'[^0-9]','','g') LIKE t.frag || '%') AS n
  FROM t WHERE length(t.frag) >= 13
)
UPDATE public.tarefas tf
SET processo_id = m.pid,
    coordenacao_id = COALESCE(tf.coordenacao_id, (SELECT p.coordenacao_id FROM public.processos p WHERE p.id = m.pid))
FROM m
WHERE tf.id = m.id AND m.pid IS NOT NULL AND m.n = 1;