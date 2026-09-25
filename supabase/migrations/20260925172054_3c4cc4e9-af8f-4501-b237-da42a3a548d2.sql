DO $migration$
DECLARE
  v_definition text;
  v_old text := '(v_search_digits IS NOT NULL AND regexp_replace(coalesce(p.numero,'''') , ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'')';
  v_old_exact text := '(v_search_digits IS NOT NULL AND regexp_replace(coalesce(p.numero,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'')';
  v_new text := '(v_search_digits IS NOT NULL AND (
        regexp_replace(coalesce(p.numero,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'' OR
        regexp_replace(coalesce(p.dossie_tst,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'' OR
        regexp_replace(coalesce(p.pasta_cliente,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'' OR
        regexp_replace(coalesce(p.pasta_fisica,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%''
      ))';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_processos_paginados'
  LIMIT 1;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Função get_processos_paginados não encontrada';
  END IF;

  v_definition := replace(v_definition, v_old_exact, v_new);

  IF position(v_new IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Trecho de busca esperado não encontrado em get_processos_paginados';
  END IF;

  EXECUTE v_definition;
END
$migration$;

CREATE OR REPLACE FUNCTION public.buscar_processos_global(_termo text, _limite integer DEFAULT 8)
RETURNS TABLE (
  id uuid,
  numero text,
  assunto text,
  polo_ativo text,
  polo_passivo text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH busca AS (
    SELECT
      nullif(trim(_termo), '') AS texto,
      regexp_replace(coalesce(_termo, ''), '\D', '', 'g') AS digitos
  )
  SELECT p.id, p.numero, p.assunto, p.polo_ativo, p.polo_passivo
  FROM public.processos p
  CROSS JOIN busca b
  WHERE b.texto IS NOT NULL
    AND (
      p.numero ILIKE '%' || b.texto || '%' OR
      p.assunto ILIKE '%' || b.texto || '%' OR
      p.polo_ativo ILIKE '%' || b.texto || '%' OR
      p.polo_passivo ILIKE '%' || b.texto || '%' OR
      p.dossie_tst ILIKE '%' || b.texto || '%' OR
      p.pasta_cliente ILIKE '%' || b.texto || '%' OR
      p.pasta_fisica ILIKE '%' || b.texto || '%' OR
      (
        length(b.digitos) >= 4
        AND (
          regexp_replace(coalesce(p.numero, ''), '\D', '', 'g') ILIKE '%' || b.digitos || '%' OR
          regexp_replace(coalesce(p.dossie_tst, ''), '\D', '', 'g') ILIKE '%' || b.digitos || '%' OR
          regexp_replace(coalesce(p.pasta_cliente, ''), '\D', '', 'g') ILIKE '%' || b.digitos || '%' OR
          regexp_replace(coalesce(p.pasta_fisica, ''), '\D', '', 'g') ILIKE '%' || b.digitos || '%'
        )
      )
    )
  ORDER BY p.created_at DESC
  LIMIT greatest(1, least(coalesce(_limite, 8), 20));
$function$;

REVOKE ALL ON FUNCTION public.buscar_processos_global(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_processos_global(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_processos_global(text, integer) TO service_role;