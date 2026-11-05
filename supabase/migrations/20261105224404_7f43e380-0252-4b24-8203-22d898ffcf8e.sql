CREATE OR REPLACE FUNCTION public.pauta_preencher_de_benner(_pauta uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; a record; adv text; bid uuid;
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
    (array_agg(nullif(sustentacao_oral,'')) FILTER (WHERE nullif(sustentacao_oral,'') IS NOT NULL))[1] sust,
    (array_agg(nullif(entrega_memoriais,'')) FILTER (WHERE nullif(entrega_memoriais,'') IS NOT NULL))[1] memo,
    (array_agg(nullif(observacao_advogado,'')) FILTER (WHERE nullif(observacao_advogado,'') IS NOT NULL))[1] obs,
    array_agg(id) ids
  INTO a FROM bs;

  IF a.id IS NULL THEN RETURN; END IF;

  SELECT nullif(string_agg(DISTINCT pr.nome, ', '), '') INTO adv
  FROM dados_benner_responsaveis r JOIN profiles pr ON pr.id = r.usuario_id
  WHERE r.dados_benner_id = ANY(a.ids);

  UPDATE pautas_tst SET
    dados_benner_id = coalesce(dados_benner_id, a.id),
    dossie = coalesce(nullif(dossie,''), a.dossie),
    equipe = coalesce(nullif(equipe,''), a.equipe),
    advogado_interno = coalesce(nullif(advogado_interno,''), adv),
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
    sustentacao_oral = coalesce(nullif(sustentacao_oral,''), a.sust),
    entrega_memoriais = coalesce(nullif(entrega_memoriais,''), a.memo),
    comentarios_advogado = coalesce(nullif(comentarios_advogado,''), a.obs)
  WHERE id = _pauta;
END $$;
REVOKE EXECUTE ON FUNCTION public.pauta_preencher_de_benner(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pautas_reverificar_benner(_dias_atras integer DEFAULT 15)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM pautas_tst WHERE origem = 'djen_auto'
    AND (data_julgamento IS NULL OR data_julgamento >= current_date - _dias_atras)
  LOOP PERFORM pauta_preencher_de_benner(r.id); n := n + 1; END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.pautas_reverificar_benner(integer) FROM PUBLIC, anon, authenticated;

-- Encadeia a reverificação ao final da rotina automática
DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.gerar_pautas_tst_auto'::regproc);
  src := replace(src, E'  END LOOP;\n  RETURN n;', E'  END LOOP;\n  PERFORM pautas_reverificar_benner(15);\n  RETURN n;');
  EXECUTE src;
END $$;

-- Preenche todas as pautas automáticas já existentes
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM pautas_tst WHERE origem='djen_auto' LOOP PERFORM pauta_preencher_de_benner(r.id); END LOOP;
END $$;