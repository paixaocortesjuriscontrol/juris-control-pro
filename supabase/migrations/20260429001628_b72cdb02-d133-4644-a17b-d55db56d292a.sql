
-- Função de backfill por lotes para publicacoes_djen
CREATE OR REPLACE FUNCTION public.backfill_djen_status_batch(p_limit int DEFAULT 2000)
RETURNS TABLE(processados int, restantes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_count int;
  v_rest bigint;
BEGIN
  SELECT array_agg(id) INTO v_ids FROM (
    SELECT id FROM public.publicacoes_djen WHERE dedup_key IS NULL LIMIT p_limit
  ) sub;

  IF v_ids IS NULL THEN
    SELECT COUNT(*) INTO v_rest FROM public.publicacoes_djen WHERE dedup_key IS NULL;
    RETURN QUERY SELECT 0, v_rest;
    RETURN;
  END IF;

  UPDATE public.publicacoes_djen
  SET dedup_key = public.compute_djen_dedup_key(coordenacao_id, processo_numero, data_disponibilizacao, data_publicacao, created_at)
  WHERE id = ANY(v_ids);

  v_count := array_length(v_ids, 1);
  SELECT COUNT(*) INTO v_rest FROM public.publicacoes_djen WHERE dedup_key IS NULL;
  RETURN QUERY SELECT v_count, v_rest;
END;
$$;

-- Função de backfill por lotes para publicacoes_djen_processos
CREATE OR REPLACE FUNCTION public.backfill_djenp_status_batch(p_limit int DEFAULT 2000)
RETURNS TABLE(processados int, restantes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_count int;
  v_rest bigint;
BEGIN
  SELECT array_agg(id) INTO v_ids FROM (
    SELECT id FROM public.publicacoes_djen_processos WHERE dedup_key IS NULL LIMIT p_limit
  ) sub;

  IF v_ids IS NULL THEN
    SELECT COUNT(*) INTO v_rest FROM public.publicacoes_djen_processos WHERE dedup_key IS NULL;
    RETURN QUERY SELECT 0, v_rest;
    RETURN;
  END IF;

  UPDATE public.publicacoes_djen_processos
  SET dedup_key = public.compute_djen_dedup_key(coordenacao_id, processo_numero, data_disponibilizacao, data_publicacao, created_at)
  WHERE id = ANY(v_ids);

  v_count := array_length(v_ids, 1);
  SELECT COUNT(*) INTO v_rest FROM public.publicacoes_djen_processos WHERE dedup_key IS NULL;
  RETURN QUERY SELECT v_count, v_rest;
END;
$$;

-- Função para marcar duplicadas (uma só vez no fim, é uma única consulta CTE)
CREATE OR REPLACE FUNCTION public.mark_djen_duplicadas_global()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count bigint;
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY dedup_key ORDER BY created_at ASC, id ASC) AS rn
    FROM public.publicacoes_djen
    WHERE coordenacao_id IS NOT NULL AND dedup_key IS NOT NULL AND status = 'encontrada'
  ),
  upd AS (
    UPDATE public.publicacoes_djen pd
    SET status = 'duplicada'
    FROM ranked r
    WHERE pd.id = r.id AND r.rn > 1
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_djenp_duplicadas_global()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count bigint;
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY dedup_key ORDER BY created_at ASC, id ASC) AS rn
    FROM public.publicacoes_djen_processos
    WHERE coordenacao_id IS NOT NULL AND dedup_key IS NOT NULL AND status = 'encontrada'
  ),
  upd AS (
    UPDATE public.publicacoes_djen_processos pdp
    SET status = 'duplicada'
    FROM ranked r
    WHERE pdp.id = r.id AND r.rn > 1
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;
