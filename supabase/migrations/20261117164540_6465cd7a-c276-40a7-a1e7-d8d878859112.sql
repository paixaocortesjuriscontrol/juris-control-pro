CREATE OR REPLACE FUNCTION public.pauta_nome_autoridade(_n text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT coalesce(_n,'') ~* '^\s*(ministr[oa]\M|presidente\M|tribunal pleno|tribunal superior do trabalho|[oó]rg[aã]o especial|corregedor|subse[cç][aã]o|sbdi|sdc\M|sdi\M|se[cç][aã]o especializada|\d+[ªaº]?\s*turma|turma\M)'
$$;

CREATE OR REPLACE FUNCTION public.pauta_partes_polo(_pj jsonb, _polo text)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT nullif(string_agg(DISTINCT e->>'nome', ', '), '')
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_pj)='array' THEN _pj ELSE '[]'::jsonb END) e
  WHERE e->>'polo' = _polo AND coalesce(e->>'nome','') <> '' AND NOT public.pauta_nome_autoridade(e->>'nome')
$function$;

UPDATE public.pautas_tst SET
  reclamante = CASE WHEN public.pauta_nome_autoridade(reclamante) THEN NULL ELSE reclamante END,
  reclamada  = CASE WHEN public.pauta_nome_autoridade(reclamada)  THEN NULL ELSE reclamada  END
WHERE dados_benner_id IS NULL AND (public.pauta_nome_autoridade(reclamante) OR public.pauta_nome_autoridade(reclamada));

CREATE OR REPLACE FUNCTION public.arquivado_tst_data_distribuicao(_s jsonb) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE v text; BEGIN
  FOREACH v IN ARRAY ARRAY[_s->>'data_distribuicao', _s->>'data_distribuicao_real', _s->>'data_distribuicao_planilha'] LOOP
    IF coalesce(trim(v),'') = '' THEN CONTINUE; END IF;
    BEGIN
      IF v ~ '^\d{2}/\d{2}/\d{4}' THEN RETURN to_date(substr(v,1,10),'DD/MM/YYYY'); END IF;
      RETURN substr(v,1,10)::date;
    EXCEPTION WHEN others THEN CONTINUE; END;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.listar_arquivados_tst_por_periodo(_de date DEFAULT NULL, _ate date DEFAULT NULL, _so_dossie boolean DEFAULT false, _origem text DEFAULT NULL)
RETURNS TABLE(id uuid, processo text, dossie text, aba_origem text, data_distribuicao date, arquivado_em timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT a.id, a.processo, a.dossie, coalesce(a.aba_origem, a.snapshot->>'aba_origem'), public.arquivado_tst_data_distribuicao(a.snapshot), a.arquivado_em
  FROM public.dados_benner_arquivados a
  WHERE (NOT _so_dossie OR nullif(trim(a.dossie),'') IS NOT NULL)
    AND (_origem IS NULL OR coalesce(a.aba_origem, a.snapshot->>'aba_origem') ILIKE _origem)
    AND (_de IS NULL OR public.arquivado_tst_data_distribuicao(a.snapshot) >= _de)
    AND (_ate IS NULL OR public.arquivado_tst_data_distribuicao(a.snapshot) <= _ate)
  ORDER BY 5 NULLS LAST, a.processo
$$;
GRANT EXECUTE ON FUNCTION public.listar_arquivados_tst_por_periodo(date,date,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arquivado_tst_data_distribuicao(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pauta_nome_autoridade(text) TO authenticated;