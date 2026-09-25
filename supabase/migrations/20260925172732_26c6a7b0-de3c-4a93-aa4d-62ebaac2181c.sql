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
SECURITY DEFINER
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
  WHERE auth.uid() IS NOT NULL
    AND b.texto IS NOT NULL
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
REVOKE ALL ON FUNCTION public.buscar_processos_global(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.buscar_processos_global(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_processos_global(text, integer) TO service_role;