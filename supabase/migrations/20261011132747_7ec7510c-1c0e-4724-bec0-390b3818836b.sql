CREATE OR REPLACE FUNCTION public.vincular_pautas_distribuicao(_somente_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  WITH b AS (
    SELECT DISTINCT ON (regexp_replace(processo,'\D','','g')) regexp_replace(processo,'\D','','g') dig, id, dossie, equipe, relator, turma, reclamante, reclamada
    FROM dados_benner WHERE processo IS NOT NULL ORDER BY regexp_replace(processo,'\D','','g'), updated_at DESC NULLS LAST
  )
  UPDATE pautas_tst t SET
    dados_benner_id = b.id,
    dossie = coalesce(nullif(t.dossie,''), b.dossie),
    equipe = coalesce(nullif(t.equipe,''), b.equipe),
    relator = coalesce(nullif(t.relator,''), b.relator),
    reclamante = coalesce(nullif(t.reclamante,''), b.reclamante),
    reclamada = coalesce(nullif(t.reclamada,''), b.reclamada)
  FROM b
  WHERE b.dig = t.processo_digits AND t.dados_benner_id IS NULL
    AND (_somente_ids IS NULL OR t.id = ANY(_somente_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.vincular_pautas_distribuicao(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vincular_pautas_distribuicao(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_pautas_apos_djen_servidor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tipo = 'djen_paralela_servidor' AND NEW.status IN ('concluido','concluido_parcial')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN
      PERFORM public.gerar_pautas_tst_auto(2);
      PERFORM public.vincular_pautas_distribuicao(NULL);
    EXCEPTION WHEN others THEN RAISE WARNING 'pautas auto: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

SELECT public.vincular_pautas_distribuicao(NULL);