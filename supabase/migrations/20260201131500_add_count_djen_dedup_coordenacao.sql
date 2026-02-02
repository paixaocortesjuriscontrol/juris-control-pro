-- RPC para contagem deduplicada de publicações DJEN por coordenação (hoje)
CREATE OR REPLACE FUNCTION public.count_djen_publicacoes_deduplicadas_hoje_por_coordenacao(
  p_coordenacao_id uuid
)
RETURNS TABLE(total_unicas bigint, total_bruto bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inicio timestamptz;
  v_fim timestamptz;
BEGIN
  IF p_coordenacao_id IS NULL THEN
    RAISE EXCEPTION 'coordenacao_id is required' USING ERRCODE = '22004';
  END IF;

  v_inicio := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_fim := v_inicio + interval '1 day';

  RETURN QUERY
  WITH pub_base AS (
    SELECT
      m.coordenacao_id,
      regexp_replace(COALESCE(p.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
      COALESCE(
        to_char(p.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(p.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(p.created_at::date, 'YYYY-MM-DD')
      ) AS data_ref,
      left(
        lower(regexp_replace(regexp_replace(
          COALESCE(p.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '\s+', ' ', 'g')),
        300
      ) AS head_norm
    FROM public.publicacoes_djen p
    JOIN public.monitoramentos_djen m ON m.id = p.monitoramento_id
    WHERE p.created_at >= v_inicio
      AND p.created_at < v_fim
      AND m.coordenacao_id = p_coordenacao_id
  )
  SELECT
    COUNT(DISTINCT (
      COALESCE(pub_base.coordenacao_id::text, 'sem_coord') || '|' ||
      pub_base.processo_digits || '|' ||
      pub_base.data_ref || '|' ||
      pub_base.head_norm
    ))::bigint AS total_unicas,
    COUNT(*)::bigint AS total_bruto
  FROM pub_base;
END;
$$;
