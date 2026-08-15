
-- Contagem de pendências de um registro da Distribuição TST (espelha as regras da UI)
CREATE OR REPLACE FUNCTION public.tst_pendencias_count(r public.dados_benner)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  v_rec text := upper(coalesce(r.recorrente, ''));
  v_midia text := upper(trim(coalesce(r.midia_negativa, '')));
  v_temjulg text := upper(trim(coalesce(r.tem_data_julgamento, '')));
  item jsonb;
  arr jsonb;
  somente_outra boolean;
BEGIN
  IF r.data_distribuicao_real IS NULL THEN n := n + 1; END IF;
  IF coalesce(trim(r.processo), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.dossie), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.tribunal), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.equipe), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.reclamante), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.reclamada), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.relator), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.turma), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.recorrente), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.honra), '') = '' THEN n := n + 1; END IF;
  IF v_midia = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.recurso_terceiros), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.decisao_quarteirizado), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.provas_digitais), '') = '' THEN n := n + 1; END IF;
  IF coalesce(trim(r.processo_baixado), '') = '' THEN n := n + 1; END IF;

  IF v_rec LIKE '%RECLAMANTE%' THEN
    IF coalesce(trim(r.tipo_recurso_reclamante), '') = '' THEN n := n + 1; END IF;
    IF coalesce(trim(r.materias_recurso_reclamante), '') = '' THEN n := n + 1; END IF;
    IF coalesce(trim(r.tem_chance_exito_reclamante), '') = '' THEN n := n + 1; END IF;
  END IF;

  IF v_rec LIKE '%RECLAMAD%' THEN
    IF coalesce(trim(r.tipo_recurso_banco), '') = '' THEN n := n + 1; END IF;
    IF coalesce(trim(r.materias_recurso_banco), '') = '' THEN n := n + 1; END IF;
  END IF;

  IF v_rec LIKE '%TERCEIRO%' THEN
    IF coalesce(trim(r.tipo_recurso_terceiro), '') = '' THEN n := n + 1; END IF;
    IF coalesce(trim(r.tem_chance_exito_terceiro), '') = '' THEN n := n + 1; END IF;
  END IF;

  IF v_midia IN ('SIM', 'S') THEN
    IF coalesce(trim(r.risco_nivel), '') = '' THEN n := n + 1; END IF;
    IF coalesce(trim(r.risco_descricao), '') = '' THEN n := n + 1; END IF;
  END IF;

  IF v_temjulg IN ('SIM', 'S') THEN
    IF r.data_julgamento IS NULL THEN n := n + 1; END IF;
    IF coalesce(trim(r.horario_julgamento), '') = '' THEN n := n + 1; END IF;
    IF coalesce(trim(r.tipo_julgamento), '') = '' THEN n := n + 1; END IF;
  END IF;

  -- Análise por matéria (JSONB). "Outra Matéria" isolada é apenas aviso.
  FOREACH arr IN ARRAY ARRAY[
    coalesce(r.materias_analise_reclamante, '[]'::jsonb),
    coalesce(r.materias_analise_banco, '[]'::jsonb)
  ] LOOP
    IF jsonb_typeof(arr) = 'array' AND jsonb_array_length(arr) > 0 THEN
      SELECT bool_and(upper(coalesce(e->>'materia', '')) LIKE 'OUTRA%')
        INTO somente_outra
      FROM jsonb_array_elements(arr) e;
      IF NOT coalesce(somente_outra, false) THEN
        FOR item IN SELECT e FROM jsonb_array_elements(arr) e LOOP
          IF coalesce(trim(item->>'materia'), '') = '' THEN CONTINUE; END IF;
          IF upper(coalesce(item->>'materia', '')) LIKE 'OUTRA%' THEN CONTINUE; END IF;
          IF coalesce(trim(item->>'aparelhamento'), '') = '' THEN n := n + 1; END IF;
          IF coalesce(trim(item->>'chance_turma'), '') = '' THEN n := n + 1; END IF;
          IF coalesce(trim(item->>'chance_relator'), '') = '' THEN n := n + 1; END IF;
          IF coalesce(trim(item->>'chance_exito'), '') = '' THEN n := n + 1; END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN n;
END;
$$;

-- ==================== RANKING GERAL ====================
CREATE OR REPLACE FUNCTION public.get_ranking_atendimento_geral(
  p_inicio date,
  p_fim date,
  p_coordenacao_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS TABLE (
  usuario_id uuid,
  nome text,
  abertos_prazos bigint,
  abertos_tarefas bigint,
  abertos_audiencias bigint,
  abertos_eventos bigint,
  abertos_parcelamentos bigint,
  abertos_total bigint,
  concluidos bigint,
  concluidos_no_prazo bigint,
  concluidos_atraso bigint,
  prazos_perdidos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH tar AS (
  SELECT
    t.id, t.criado_por, t.coordenacao_id, t.created_at, t.status::text AS status,
    t.data_cumprimento, t.responsavel_id,
    CASE
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'audi%' THEN 'audiencia'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'prazo%' THEN 'prazo'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'evento%' THEN 'evento'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'parcel%' THEN 'parcelamento'
      ELSE 'tarefa'
    END AS tipo,
    coalesce(t.data_fatal, t.data_vencimento, t.data_prevista) AS prazo
  FROM public.tarefas t
  WHERE (p_coordenacao_id IS NULL OR t.coordenacao_id = p_coordenacao_id)
),
abertos AS (
  SELECT criado_por AS uid,
    count(*) FILTER (WHERE tipo = 'prazo') AS a_prazos,
    count(*) FILTER (WHERE tipo = 'tarefa') AS a_tarefas,
    count(*) FILTER (WHERE tipo = 'audiencia') AS a_audiencias,
    count(*) FILTER (WHERE tipo = 'evento') AS a_eventos,
    count(*) FILTER (WHERE tipo = 'parcelamento') AS a_parcelamentos,
    count(*) AS a_total
  FROM tar
  WHERE criado_por IS NOT NULL
    AND created_at::date >= p_inicio AND created_at::date <= p_fim
  GROUP BY criado_por
),
resp AS (
  SELECT tr.tarefa_id, tr.usuario_id FROM public.tarefa_responsaveis tr
  UNION
  SELECT t.id, t.responsavel_id FROM public.tarefas t WHERE t.responsavel_id IS NOT NULL
),
tar_resp AS (
  SELECT r.usuario_id AS uid, t.*
  FROM tar t
  JOIN resp r ON r.tarefa_id = t.id
),
concl AS (
  SELECT uid,
    count(*) AS c_total,
    count(*) FILTER (WHERE prazo IS NULL OR data_cumprimento::date <= prazo) AS c_prazo,
    count(*) FILTER (WHERE prazo IS NOT NULL AND data_cumprimento::date > prazo) AS c_atraso
  FROM tar_resp
  WHERE status IN ('cumprido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso')
    AND data_cumprimento IS NOT NULL
    AND data_cumprimento::date >= p_inicio AND data_cumprimento::date <= p_fim
  GROUP BY uid
),
perdidos AS (
  SELECT uid, count(*) AS p_total
  FROM tar_resp
  WHERE prazo IS NOT NULL
    AND prazo >= p_inicio AND prazo <= p_fim
    AND (
      (status IN ('cumprido','tratado','protocolado','baixado','verificado') AND data_cumprimento IS NOT NULL AND data_cumprimento::date > prazo)
      OR (status NOT IN ('cumprido','tratado','protocolado','baixado','verificado','cancelado','concluido_sem_sucesso') AND prazo < current_date)
    )
  GROUP BY uid
),
ids AS (
  SELECT uid FROM abertos
  UNION SELECT uid FROM concl
  UNION SELECT uid FROM perdidos
)
SELECT
  i.uid,
  coalesce(p.nome, 'Sem nome') AS nome,
  coalesce(a.a_prazos, 0), coalesce(a.a_tarefas, 0), coalesce(a.a_audiencias, 0),
  coalesce(a.a_eventos, 0), coalesce(a.a_parcelamentos, 0), coalesce(a.a_total, 0),
  coalesce(c.c_total, 0), coalesce(c.c_prazo, 0), coalesce(c.c_atraso, 0),
  coalesce(pd.p_total, 0)
FROM ids i
LEFT JOIN abertos a ON a.uid = i.uid
LEFT JOIN concl c ON c.uid = i.uid
LEFT JOIN perdidos pd ON pd.uid = i.uid
LEFT JOIN public.profiles p ON p.id = i.uid
WHERE i.uid IS NOT NULL
  AND (p_usuario_id IS NULL OR i.uid = p_usuario_id)
ORDER BY coalesce(c.c_total, 0) DESC, coalesce(a.a_total, 0) DESC;
$$;

-- ==================== RANKING TST ====================
CREATE OR REPLACE FUNCTION public.get_ranking_atendimento_tst(
  p_inicio date,
  p_fim date,
  p_coordenacao_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS TABLE (
  usuario_id uuid,
  nome text,
  total bigint,
  sem_pendencia bigint,
  com_pendencia bigint,
  pendencias_total bigint,
  judit_preenchidos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT db.*, public.tst_pendencias_count(db.*) AS pend
  FROM public.dados_benner db
  WHERE db.aba_origem IS NOT NULL
    AND coalesce(db.data_distribuicao_real, db.created_at::date) BETWEEN p_inicio AND p_fim
    AND (p_coordenacao_id IS NULL OR db.coordenacao_id = p_coordenacao_id)
),
porresp AS (
  SELECT r.usuario_id AS uid, b.pend, b.judit_preenchido
  FROM base b
  JOIN public.dados_benner_responsaveis r ON r.dados_benner_id = b.id
)
SELECT
  pr.uid,
  coalesce(p.nome, 'Sem nome') AS nome,
  count(*) AS total,
  count(*) FILTER (WHERE pr.pend = 0) AS sem_pendencia,
  count(*) FILTER (WHERE pr.pend > 0) AS com_pendencia,
  coalesce(sum(pr.pend), 0)::bigint AS pendencias_total,
  count(*) FILTER (WHERE pr.judit_preenchido) AS judit_preenchidos
FROM porresp pr
LEFT JOIN public.profiles p ON p.id = pr.uid
WHERE p_usuario_id IS NULL OR pr.uid = p_usuario_id
GROUP BY pr.uid, p.nome
ORDER BY count(*) FILTER (WHERE pr.pend = 0) DESC, count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.tst_pendencias_count(public.dados_benner) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ranking_atendimento_geral(date, date, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ranking_atendimento_tst(date, date, uuid, uuid) TO authenticated, service_role;
