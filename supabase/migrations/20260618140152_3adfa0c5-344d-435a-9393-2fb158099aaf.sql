CREATE OR REPLACE FUNCTION public.djen_first_comunicacao_id_from_json(p_partes jsonb, p_advogados jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  SELECT regexp_replace(value->>'comunicacao_id', '\D', '', 'g')
  INTO v_id
  FROM jsonb_array_elements(COALESCE(p_partes, '[]'::jsonb)) AS value
  WHERE regexp_replace(COALESCE(value->>'comunicacao_id', ''), '\D', '', 'g') <> ''
  LIMIT 1;

  IF v_id IS NOT NULL AND v_id <> '' THEN
    RETURN v_id;
  END IF;

  SELECT regexp_replace(value->>'comunicacao_id', '\D', '', 'g')
  INTO v_id
  FROM jsonb_array_elements(COALESCE(p_advogados, '[]'::jsonb)) AS value
  WHERE regexp_replace(COALESCE(value->>'comunicacao_id', ''), '\D', '', 'g') <> ''
  LIMIT 1;

  RETURN NULLIF(v_id, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.djen_pick_kurier_raw_processo(
  p_comunicacao_id text,
  p_data_disponibilizacao timestamptz DEFAULT NULL
)
RETURNS TABLE(processo text, login_usado text)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id text := regexp_replace(COALESCE(p_comunicacao_id, ''), '\D', '', 'g');
  v_data_br text;
BEGIN
  IF v_id = '' THEN
    RETURN;
  END IF;

  IF p_data_disponibilizacao IS NOT NULL THEN
    v_data_br := to_char((p_data_disponibilizacao AT TIME ZONE 'America/Sao_Paulo')::date, 'DD/MM/YYYY');
  END IF;

  RETURN QUERY
  SELECT NULLIF(btrim(r.payload->>'Processo'), '') AS processo,
         r.login_usado
  FROM public.kurier_publicacoes_raw r
  WHERE NULLIF(btrim(r.payload->>'Processo'), '') IS NOT NULL
    AND (
      (r.payload->>'Texto') ~* ('ID\s*COMUNICA(?:ÇÃO|CAO)\s*' || v_id)
      OR regexp_replace(COALESCE(r.payload->>'IdComunicacao', r.payload->>'CodigoComunicacao', r.payload->>'CodComunicacao', ''), '\D', '', 'g') = v_id
    )
    AND (v_data_br IS NULL OR r.payload->>'DataDisponibilizacao' = v_data_br OR r.created_at >= p_data_disponibilizacao - interval '3 days')
  ORDER BY
    CASE WHEN v_data_br IS NOT NULL AND r.payload->>'DataDisponibilizacao' = v_data_br THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_processo_numero_djen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_extracted text;
  v_comunicacao_id text;
  v_raw record;
BEGIN
  IF NEW.processo_numero IS NULL OR length(trim(NEW.processo_numero)) = 0 THEN
    v_extracted := public.extract_cnj_from_text(NEW.conteudo);
    IF v_extracted IS NOT NULL THEN
      NEW.processo_numero := v_extracted;
    END IF;
  END IF;

  IF NEW.processo_numero IS NULL OR length(trim(NEW.processo_numero)) = 0 THEN
    v_comunicacao_id := regexp_replace(COALESCE(NEW.id_djen, ''), '\D', '', 'g');
    IF v_comunicacao_id = '' THEN
      v_comunicacao_id := public.djen_first_comunicacao_id_from_json(NEW.partes_json, NEW.advogados_json);
    END IF;

    IF v_comunicacao_id IS NOT NULL AND v_comunicacao_id <> '' THEN
      SELECT * INTO v_raw
      FROM public.djen_pick_kurier_raw_processo(v_comunicacao_id, NEW.data_disponibilizacao)
      LIMIT 1;

      IF v_raw.processo IS NOT NULL AND length(trim(v_raw.processo)) > 0 THEN
        NEW.processo_numero := v_raw.processo;
        IF NEW.kurier_login IS NULL OR length(trim(NEW.kurier_login)) = 0 THEN
          NEW.kurier_login := v_raw.login_usado;
        END IF;
      END IF;
    END IF;
  END IF;

  IF NEW.processo_numero IS NOT NULL AND length(trim(NEW.processo_numero)) > 0 THEN
    NEW.dedup_processo_digits := regexp_replace(NEW.processo_numero, '\D', '', 'g');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_processo_numero_djen ON public.publicacoes_djen;
CREATE TRIGGER trg_ensure_processo_numero_djen
  BEFORE INSERT OR UPDATE OF processo_numero, conteudo, id_djen, partes_json, advogados_json, data_disponibilizacao
  ON public.publicacoes_djen
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_processo_numero_djen();

DROP TRIGGER IF EXISTS trg_ensure_processo_numero_djen_servidor ON public.publicacoes_djen_servidor;
CREATE TRIGGER trg_ensure_processo_numero_djen_servidor
  BEFORE INSERT OR UPDATE OF processo_numero, conteudo, id_djen, partes_json, advogados_json, data_disponibilizacao
  ON public.publicacoes_djen_servidor
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_processo_numero_djen();

CREATE OR REPLACE FUNCTION public.backfill_publicacao_djen_from_kurier_raw()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_processo text := NULLIF(btrim(NEW.payload->>'Processo'), '');
  v_login text := NEW.login_usado;
  v_texto text := COALESCE(NEW.payload->>'Texto', '');
  v_data_ref timestamptz := COALESCE(NEW.recebida_em, NEW.created_at, now());
BEGIN
  IF v_processo IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.publicacoes_djen p
  SET processo_numero = v_processo,
      dedup_processo_digits = regexp_replace(v_processo, '\D', '', 'g'),
      kurier_login = COALESCE(NULLIF(p.kurier_login, ''), v_login)
  WHERE (p.processo_numero IS NULL OR btrim(p.processo_numero) = '')
    AND p.created_at >= v_data_ref - interval '7 days'
    AND (
      (regexp_replace(COALESCE(p.id_djen, ''), '\D', '', 'g') <> '' AND v_texto ~* ('ID\s*COMUNICA(?:ÇÃO|CAO)\s*' || regexp_replace(COALESCE(p.id_djen, ''), '\D', '', 'g')))
      OR (public.djen_first_comunicacao_id_from_json(p.partes_json, p.advogados_json) IS NOT NULL AND v_texto ~* ('ID\s*COMUNICA(?:ÇÃO|CAO)\s*' || public.djen_first_comunicacao_id_from_json(p.partes_json, p.advogados_json)))
    );

  UPDATE public.publicacoes_djen_servidor p
  SET processo_numero = v_processo,
      dedup_processo_digits = regexp_replace(v_processo, '\D', '', 'g'),
      kurier_login = COALESCE(NULLIF(p.kurier_login, ''), v_login)
  WHERE (p.processo_numero IS NULL OR btrim(p.processo_numero) = '')
    AND p.created_at >= v_data_ref - interval '7 days'
    AND (
      (regexp_replace(COALESCE(p.id_djen, ''), '\D', '', 'g') <> '' AND v_texto ~* ('ID\s*COMUNICA(?:ÇÃO|CAO)\s*' || regexp_replace(COALESCE(p.id_djen, ''), '\D', '', 'g')))
      OR (public.djen_first_comunicacao_id_from_json(p.partes_json, p.advogados_json) IS NOT NULL AND v_texto ~* ('ID\s*COMUNICA(?:ÇÃO|CAO)\s*' || public.djen_first_comunicacao_id_from_json(p.partes_json, p.advogados_json)))
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_publicacao_djen_from_kurier_raw ON public.kurier_publicacoes_raw;
CREATE TRIGGER trg_backfill_publicacao_djen_from_kurier_raw
  AFTER INSERT OR UPDATE OF payload, login_usado
  ON public.kurier_publicacoes_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.backfill_publicacao_djen_from_kurier_raw();