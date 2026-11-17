CREATE OR REPLACE FUNCTION public.pauta_advogado_interno(_benner uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT NULL::text $$;

CREATE OR REPLACE FUNCTION public.pauta_relator_padrao(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT nullif(upper(regexp_replace(regexp_replace(trim(coalesce(_v,'')), '^(desembargador[a]?\s+convocad[oa]\s+|ministr[oa]\s+)', '', 'i'), '[.\s]+$', '')), '')
$$;

CREATE OR REPLACE FUNCTION public.trg_pautas_tst_padrao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pj jsonb;
BEGIN
  IF NEW.relator IS NOT NULL AND NEW.relator !~* '^sem informa' THEN
    NEW.relator := pauta_relator_padrao(NEW.relator);
  END IF;
  IF coalesce(NEW.advogado_interno,'') <> '' AND EXISTS (
       SELECT 1 FROM profiles pr WHERE coalesce(pr.nome,'') <> ''
         AND position(upper(pr.nome) in upper(NEW.advogado_interno)) > 0) THEN
    NEW.advogado_interno := NULL;
  END IF;
  IF coalesce(NEW.parte_recorrente,'') = '' AND NEW.publicacao_djen_id IS NOT NULL THEN
    SELECT partes_json::jsonb INTO pj FROM publicacoes_djen WHERE id = NEW.publicacao_djen_id;
    IF pj IS NOT NULL THEN NEW.parte_recorrente := nullif(pauta_partes_polo(pj,'A'),''); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pautas_tst_padrao ON public.pautas_tst;
CREATE TRIGGER trg_pautas_tst_padrao BEFORE INSERT OR UPDATE ON public.pautas_tst
FOR EACH ROW EXECUTE FUNCTION public.trg_pautas_tst_padrao();

CREATE OR REPLACE FUNCTION public.pautas_importar_faltantes(_linhas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE l jsonb; dig text; n int; atual int := 0; nao text[] := '{}';
BEGIN
  FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
    dig := regexp_replace(coalesce(l->>'processo',''),'\D','','g');
    IF length(dig) < 7 THEN CONTINUE; END IF;
    UPDATE pautas_tst SET
      dossie = coalesce(nullif(dossie,''), nullif(trim(l->>'dossie'),'')),
      equipe = normalizar_equipe_tst(coalesce(nullif(equipe,''), nullif(trim(l->>'equipe'),''))),
      advogado_interno = upper(coalesce(nullif(advogado_interno,''), nullif(trim(l->>'advogado_interno'),'')))
    WHERE processo_digits = dig;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN nao := nao || (l->>'processo'); ELSE atual := atual + n; END IF;
  END LOOP;
  RETURN jsonb_build_object('atualizadas', atual, 'nao_encontrados', to_jsonb(nao));
END $$;
GRANT EXECUTE ON FUNCTION public.pautas_importar_faltantes(jsonb) TO authenticated;