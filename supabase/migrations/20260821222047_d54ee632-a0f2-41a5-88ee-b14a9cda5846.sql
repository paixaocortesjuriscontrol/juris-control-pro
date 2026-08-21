CREATE OR REPLACE FUNCTION public.tst_pendencias_count(r dados_benner)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  n integer := 0;
  v_rec text := upper(coalesce(r.recorrente, ''));
  v_midia text := upper(trim(coalesce(r.midia_negativa, '')));
  v_temjulg text := upper(trim(coalesce(r.tem_data_julgamento, '')));
  item jsonb;
  arr jsonb;
  somente_outra boolean;
BEGIN
  -- Isenções (mesma regra da tela Distribuição TST / getPendenciasEAvisos):
  -- Acordo, CEJUSC, processo em outro escritório, Segredo de Justiça,
  -- Trânsito em Julgado ou Terceiro como parte recorrente não exigem
  -- preenchimento e contam como SEM pendência.
  IF r.acordo = true
     OR r.cejusc = true
     OR r.processo_outro_escritorio = true
     OR r.segredo_justica = true
     OR r.transito_julgado = true
     OR v_rec LIKE '%TERCEIRO%' THEN
    RETURN 0;
  END IF;

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
$function$;