CREATE OR REPLACE FUNCTION public.mark_djen_duplicada_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.coordenacao_id IS NULL AND NEW.monitoramento_id IS NOT NULL THEN
    SELECT md.coordenacao_id INTO NEW.coordenacao_id
    FROM public.monitoramentos_djen md
    WHERE md.id = NEW.monitoramento_id;
  END IF;

  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id,
    NEW.processo_numero,
    NEW.data_disponibilizacao,
    NEW.data_publicacao,
    COALESCE(NEW.created_at, now())
  );

  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, COALESCE(NEW.created_at, now())::date);
  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(public.strip_destinatarios(NEW.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);

  IF NEW.status = 'descartada' THEN
    RETURN NEW;
  END IF;

  -- Duplicação DJEN Termos: apenas dentro da MESMA coordenação.
  -- Não usa monitoramento_id: se dois termos da mesma coordenação capturam a
  -- mesma publicação, só uma fica como encontrada. Em outra coordenação, fica independente.
  IF EXISTS (
    SELECT 1
    FROM public.publicacoes_djen pd
    WHERE pd.status = 'encontrada'
      AND pd.id <> NEW.id
      AND pd.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
      AND pd.dedup_processo_digits IS NOT DISTINCT FROM NEW.dedup_processo_digits
      AND pd.dedup_data_ref IS NOT DISTINCT FROM NEW.dedup_data_ref
      AND pd.dedup_head_norm IS NOT DISTINCT FROM NEW.dedup_head_norm
  ) THEN
    NEW.status := 'duplicada';
  ELSE
    NEW.status := 'encontrada';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_djen_duplicadas_global()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count bigint;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY coordenacao_id, dedup_processo_digits, dedup_data_ref, dedup_head_norm
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.publicacoes_djen
    WHERE coordenacao_id IS NOT NULL
      AND status = 'encontrada'
  ),
  upd AS (
    UPDATE public.publicacoes_djen pd
    SET status = 'duplicada'
    FROM ranked r
    WHERE pd.id = r.id
      AND r.rn > 1
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$function$;