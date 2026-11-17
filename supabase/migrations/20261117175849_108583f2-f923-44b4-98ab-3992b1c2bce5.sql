CREATE OR REPLACE FUNCTION public.normalizar_equipe_tst(_e text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN nullif(trim(_e),'') IS NULL THEN NULL
    WHEN trim(_e) ~* '^jur[ií]dico trabalhista' THEN regexp_replace(trim(_e), '^jur[ií]dico trabalhista\s*-\s*', 'Jurídico Trabalhista - ', 'i')
    WHEN trim(_e) ~* '^adm e coligadas$' THEN 'Jurídico Trabalhista - Núcleo Adm e Coligadas'
    WHEN trim(_e) ~* '^(a[cç][oõ]es corporativas|a[cç][oõ]es especiais|autos de infra[cç][aã]o|n[uú]cleo .+)$' THEN 'Jurídico Trabalhista - ' || trim(_e)
    ELSE trim(_e) END
$$;

UPDATE public.dados_benner SET equipe = public.normalizar_equipe_tst(equipe) WHERE equipe IS NOT NULL AND equipe IS DISTINCT FROM public.normalizar_equipe_tst(equipe);
UPDATE public.pautas_tst SET equipe = public.normalizar_equipe_tst(equipe) WHERE equipe IS NOT NULL AND equipe IS DISTINCT FROM public.normalizar_equipe_tst(equipe);
UPDATE public.pautas_tst SET advogado_interno = upper(advogado_interno) WHERE advogado_interno IS NOT NULL AND advogado_interno <> upper(advogado_interno);

ALTER TABLE public.pautas_tst ADD COLUMN IF NOT EXISTS comentarios_advogado_banco text;

CREATE OR REPLACE FUNCTION public.pauta_preencher_de_benner(_pauta uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t record; a record; adv text;
BEGIN
  SELECT * INTO t FROM pautas_tst WHERE id = _pauta;
  IF NOT FOUND OR coalesce(t.processo_digits,'') = '' THEN RETURN; END IF;
  WITH bs AS (
    SELECT b.* FROM dados_benner b
    WHERE regexp_replace(coalesce(b.processo,''),'\D','','g') = t.processo_digits
    ORDER BY (b.id = t.dados_benner_id) DESC NULLS LAST, (b.aba_origem IS NOT NULL) DESC, (b.dossie IS NOT NULL) DESC, b.updated_at DESC NULLS LAST
  )
  SELECT
    (array_agg(id))[1] id,
    (array_agg(nullif(dossie,'')) FILTER (WHERE nullif(dossie,'') IS NOT NULL))[1] dossie,
    (array_agg(nullif(equipe,'')) FILTER (WHERE nullif(equipe,'') IS NOT NULL))[1] equipe,
    (array_agg(nullif(reclamante,'')) FILTER (WHERE nullif(reclamante,'') IS NOT NULL))[1] reclamante,
    (array_agg(nullif(reclamada,'')) FILTER (WHERE nullif(reclamada,'') IS NOT NULL))[1] reclamada,
    (array_agg(nullif(turma,'')) FILTER (WHERE nullif(turma,'') IS NOT NULL))[1] turma,
    (array_agg(nullif(relator,'')) FILTER (WHERE nullif(relator,'') IS NOT NULL))[1] relator,
    (array_agg(coalesce(nullif(recorrente,''),nullif(parte_recorrente_origem,''))) FILTER (WHERE coalesce(nullif(recorrente,''),nullif(parte_recorrente_origem,'')) IS NOT NULL))[1] recorrente,
    (array_agg(coalesce(nullif(tipo_recurso,''),nullif(tipo_recurso_reclamante,''),nullif(tipo_recurso_banco,''))) FILTER (WHERE coalesce(nullif(tipo_recurso,''),nullif(tipo_recurso_reclamante,''),nullif(tipo_recurso_banco,'')) IS NOT NULL))[1] tipo_recurso,
    (array_agg(nullif(materias_recurso_reclamante,'')) FILTER (WHERE nullif(materias_recurso_reclamante,'') IS NOT NULL))[1] mat_rte,
    (array_agg(nullif(aparelhamento_reclamante,'')) FILTER (WHERE nullif(aparelhamento_reclamante,'') IS NOT NULL))[1] ap_rte,
    (array_agg(coalesce(nullif(chance_exito_reclamante,''),nullif(tem_chance_exito_reclamante,''))) FILTER (WHERE coalesce(nullif(chance_exito_reclamante,''),nullif(tem_chance_exito_reclamante,'')) IS NOT NULL))[1] ch_rte,
    (array_agg(nullif(materias_recurso_banco,'')) FILTER (WHERE nullif(materias_recurso_banco,'') IS NOT NULL))[1] mat_bco,
    (array_agg(nullif(aparelhamento_banco,'')) FILTER (WHERE nullif(aparelhamento_banco,'') IS NOT NULL))[1] ap_bco,
    (array_agg(coalesce(nullif(chance_exito_banco,''),nullif(tem_chance_exito_banco,''),nullif(chance_exito,''))) FILTER (WHERE coalesce(nullif(chance_exito_banco,''),nullif(tem_chance_exito_banco,''),nullif(chance_exito,'')) IS NOT NULL))[1] ch_bco,
    (array_agg(coalesce(nullif(honra,''),nullif(materia_honra,''))) FILTER (WHERE coalesce(nullif(honra,''),nullif(materia_honra,'')) IS NOT NULL))[1] honra,
    (array_agg(coalesce(nullif(midia_negativa,''),nullif(risco_midia,''))) FILTER (WHERE coalesce(nullif(midia_negativa,''),nullif(risco_midia,'')) IS NOT NULL))[1] midia,
    (array_agg(nullif(entrega_memoriais,'')) FILTER (WHERE nullif(entrega_memoriais,'') IS NOT NULL))[1] memo,
    array_agg(id) ids
  INTO a FROM bs;
  IF a.id IS NULL THEN RETURN; END IF;
  SELECT nullif(upper(string_agg(DISTINCT pr.nome, ', ')), '') INTO adv
  FROM dados_benner_responsaveis r JOIN profiles pr ON pr.id = r.usuario_id
  WHERE r.dados_benner_id = ANY(a.ids);
  UPDATE pautas_tst SET
    dados_benner_id = coalesce(dados_benner_id, a.id),
    dossie = coalesce(nullif(dossie,''), a.dossie),
    equipe = normalizar_equipe_tst(coalesce(nullif(equipe,''), a.equipe)),
    advogado_interno = upper(coalesce(nullif(advogado_interno,''), adv)),
    reclamante = coalesce(nullif(reclamante,''), a.reclamante),
    reclamada = coalesce(nullif(reclamada,''), a.reclamada),
    orgao = coalesce(nullif(orgao,''), a.turma),
    relator = coalesce(nullif(relator,''), a.relator),
    parte_recorrente = coalesce(nullif(parte_recorrente,''), a.recorrente),
    tipo_recurso = coalesce(nullif(tipo_recurso,''), a.tipo_recurso),
    materia_recurso_reclamante = coalesce(nullif(materia_recurso_reclamante,''), a.mat_rte),
    aparelhamento_reclamante = coalesce(nullif(aparelhamento_reclamante,''), a.ap_rte),
    chance_exito_reclamante = coalesce(nullif(chance_exito_reclamante,''), a.ch_rte),
    materia_recurso_banco = coalesce(nullif(materia_recurso_banco,''), a.mat_bco),
    aparelhamento_banco = coalesce(nullif(aparelhamento_banco,''), a.ap_bco),
    chance_exito_banco = coalesce(nullif(chance_exito_banco,''), a.ch_bco),
    honra = coalesce(nullif(honra,''), a.honra),
    midia_negativa = coalesce(nullif(midia_negativa,''), a.midia),
    entrega_memoriais = coalesce(nullif(entrega_memoriais,''), a.memo)
  WHERE id = _pauta;
END $function$;

CREATE OR REPLACE FUNCTION public.pautas_reverificar_benner(_dias_atras integer DEFAULT 15)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM pautas_tst WHERE (data_julgamento IS NULL OR data_julgamento >= current_date - _dias_atras)
  LOOP PERFORM pauta_preencher_de_benner(r.id); n := n + 1; END LOOP;
  RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.pautas_completar_periodo(_de date, _ate date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  FOR r IN SELECT id FROM pautas_tst WHERE data_julgamento BETWEEN _de AND _ate
  LOOP PERFORM pauta_preencher_de_benner(r.id); n := n + 1; END LOOP;
  RETURN n;
END $function$;
REVOKE EXECUTE ON FUNCTION public.pautas_completar_periodo(date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.pautas_completar_periodo(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_equipe_tst(text) TO authenticated;