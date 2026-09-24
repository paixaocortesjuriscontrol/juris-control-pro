CREATE OR REPLACE FUNCTION public.get_inteligencia_oportunidades_acordo(p_coordenacao_id uuid DEFAULT NULL, p_equipe text DEFAULT NULL, p_tribunal text DEFAULT NULL, p_limite int DEFAULT 200)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
WITH todos AS (
  SELECT b.*, upper(trim(b.reclamante)) recl_n, upper(trim(b.tipo_recurso_reclamante)) tipo_n, upper(trim(b.relator)) rel_n,
         CASE WHEN b.acordo THEN 1.0 ELSE 0.0 END ac
  FROM dados_benner b
),
geral AS (SELECT GREATEST(avg(ac), 0.001) p FROM todos),
t_recl AS (SELECT recl_n k, count(*) n, sum(ac) a FROM todos WHERE recl_n <> '' GROUP BY 1),
t_tipo AS (SELECT tipo_n k, count(*) n, sum(ac) a FROM todos WHERE tipo_n <> '' GROUP BY 1),
t_rel AS (SELECT rel_n k, count(*) n, sum(ac) a FROM todos WHERE rel_n <> '' GROUP BY 1),
mat AS (
  SELECT DISTINCT b.id, NULLIF(trim(both ' .' FROM regexp_replace(trim(x), '^\d+\s*[\.\)-]\s*', '')), '') m, b.ac
  FROM todos b, LATERAL unnest(string_to_array(concat_ws(';', b.materias_recurso_reclamante, b.materias_recurso_banco), ';')) x
),
t_mat AS (SELECT m k, count(*) n, sum(ac) a FROM mat WHERE m IS NOT NULL AND m <> 'Outra Matéria' GROUP BY 1),
abertos AS (
  SELECT t.* FROM todos t
  WHERE NOT COALESCE(t.ganhamos,false) AND NOT COALESCE(t.perdemos,false) AND NOT COALESCE(t.acordo,false)
    AND lower(trim(COALESCE(t.processo_baixado,''))) NOT IN ('sim','s','true','x','baixado')
    AND (p_coordenacao_id IS NULL OR t.coordenacao_id = p_coordenacao_id)
    AND (p_equipe IS NULL OR t.equipe = p_equipe)
    AND (p_tribunal IS NULL OR t.tribunal = p_tribunal)
),
fatores AS (
  SELECT a.id,
    -- taxas suavizadas (peso 10 do histórico geral) para não inventar precisão
    (COALESCE(r.a,0) + 10*g.p) / (COALESCE(r.n,0) + 10) f_recl, COALESCE(r.n,0) n_recl,
    (COALESCE(tp.a,0) + 10*g.p) / (COALESCE(tp.n,0) + 10) f_tipo, COALESCE(tp.n,0) n_tipo,
    (COALESCE(rl.a,0) + 10*g.p) / (COALESCE(rl.n,0) + 10) f_rel, COALESCE(rl.n,0) n_rel,
    (SELECT avg((tm.a + 10*g.p)/(tm.n + 10)) FROM mat mm JOIN t_mat tm ON tm.k = mm.m WHERE mm.id = a.id) f_mat,
    (SELECT COALESCE(sum(tm.n),0) FROM mat mm JOIN t_mat tm ON tm.k = mm.m WHERE mm.id = a.id) n_mat,
    g.p
  FROM abertos a CROSS JOIN geral g
  LEFT JOIN t_recl r ON r.k = a.recl_n LEFT JOIN t_tipo tp ON tp.k = a.tipo_n LEFT JOIN t_rel rl ON rl.k = a.rel_n
),
score AS (
  SELECT f.*, (0.4*f.f_recl + 0.3*COALESCE(f.f_mat, f.p) + 0.15*f.f_tipo + 0.15*f.f_rel) s,
         (LEAST(n_recl,5) + LEAST(n_mat,50)/10 + LEAST(n_tipo,50)/10 + LEAST(n_rel,50)/10) evid
  FROM fatores f
),
proc AS (
  SELECT DISTINCT ON (d) regexp_replace(numero,'\D','','g') d, valor_causa, valor_condenacao, provisionamento_provavel, id
  FROM processos WHERE numero IS NOT NULL ORDER BY d, valor_causa DESC NULLS LAST
),
ranked AS (
  SELECT a.id, a.processo, a.dossie, a.reclamante, a.turma, a.relator, a.equipe, a.tribunal, a.tipo_recurso_reclamante,
         round((s.s / s.p) * 10) / 10 AS vezes_media,
         round(s.s * 1000) / 10 AS prob,
         CASE WHEN s.evid >= 8 THEN 'alta' WHEN s.evid >= 3 THEN 'media' ELSE 'baixa' END confianca,
         s.n_recl, pr.valor_causa, pr.valor_condenacao, pr.provisionamento_provavel, pr.id processo_id
  FROM abertos a JOIN score s ON s.id = a.id
  LEFT JOIN proc pr ON pr.d = regexp_replace(a.processo,'\D','','g')
)
SELECT jsonb_build_object(
  'taxa_geral', (SELECT round(p*1000)/10 FROM geral),
  'total_abertos', (SELECT count(*) FROM abertos),
  'acordos_historicos', (SELECT sum(ac) FROM todos),
  'itens', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]') FROM (
      SELECT * FROM ranked ORDER BY prob DESC, COALESCE(provisionamento_provavel, valor_condenacao, valor_causa, 0) DESC LIMIT LEAST(COALESCE(p_limite,200), 500)) x)
);
$function$;
REVOKE EXECUTE ON FUNCTION public.get_inteligencia_oportunidades_acordo(uuid,text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inteligencia_oportunidades_acordo(uuid,text,text,int) TO authenticated, service_role;