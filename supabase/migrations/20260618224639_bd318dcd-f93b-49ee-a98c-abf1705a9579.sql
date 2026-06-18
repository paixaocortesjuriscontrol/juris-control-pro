
CREATE OR REPLACE FUNCTION public.arquivar_duplicados_dados_benner_ids(
  _ids uuid[],
  _motivo text DEFAULT 'Arquivamento automático de duplicados'
)
RETURNS TABLE(arquivados int, grupos int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _row public.dados_benner%ROWTYPE;
  _snap jsonb;
  _arq int := 0;
  _grp int := 0;
  _id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RAISE EXCEPTION 'Apenas administradores ou coordenadores podem arquivar';
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE _losers ON COMMIT DROP AS
  WITH base AS (
    SELECT
      d.id,
      regexp_replace(coalesce(d.processo,''), '\D', '', 'g') AS pn,
      d.updated_at,
      (SELECT count(*) FROM public.dados_benner_processo_tags t WHERE t.dado_benner_id = d.id) AS tag_count,
      (SELECT count(*) FROM jsonb_each(to_jsonb(d)) e
        WHERE e.value IS NOT NULL AND e.value::text NOT IN ('null','""','"null"')) AS filled_count
    FROM public.dados_benner d
    WHERE d.id = ANY(_ids)
      AND d.processo IS NOT NULL AND btrim(d.processo) <> ''
  ),
  grp AS (
    SELECT pn FROM base WHERE length(pn) >= 20 GROUP BY pn HAVING count(*) > 1
  ),
  ranked AS (
    SELECT b.*,
      row_number() OVER (PARTITION BY b.pn ORDER BY b.tag_count DESC, b.filled_count DESC, b.updated_at DESC) AS rn_info,
      row_number() OVER (PARTITION BY b.pn ORDER BY b.updated_at DESC) AS rn_date
    FROM base b JOIN grp g USING (pn)
  ),
  wi AS (SELECT pn, id AS info_id, updated_at AS info_upd FROM ranked WHERE rn_info = 1),
  wd AS (SELECT pn, id AS date_id, updated_at AS date_upd FROM ranked WHERE rn_date = 1),
  decided AS (
    SELECT wi.pn,
      CASE WHEN wd.date_upd > wi.info_upd THEN wd.date_id ELSE wi.info_id END AS winner_id
    FROM wi JOIN wd USING (pn)
  )
  SELECT r.id, r.pn FROM ranked r JOIN decided d USING (pn) WHERE r.id <> d.winner_id;

  SELECT count(DISTINCT pn) INTO _grp FROM _losers;

  FOR _id IN SELECT id FROM _losers LOOP
    SELECT * INTO _row FROM public.dados_benner WHERE id = _id;
    IF FOUND THEN
      SELECT to_jsonb(_row) INTO _snap;
      INSERT INTO public.dados_benner_arquivados
        (dados_benner_id, processo, dossie, aba_origem, coordenacao_id, snapshot, arquivado_por, motivo)
      VALUES
        (_row.id, _row.processo, _row.dossie, _row.aba_origem, _row.coordenacao_id, _snap, auth.uid(), _motivo);
      DELETE FROM public.dados_benner WHERE id = _id;
      _arq := _arq + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT _arq, _grp;
END;
$$;

REVOKE ALL ON FUNCTION public.arquivar_duplicados_dados_benner_ids(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.arquivar_duplicados_dados_benner_ids(uuid[], text) TO authenticated;
