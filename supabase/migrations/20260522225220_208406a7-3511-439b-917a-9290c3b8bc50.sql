
CREATE OR REPLACE FUNCTION public.get_ia_schema()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_agg(t)
  FROM (
    SELECT
      c.table_name,
      jsonb_agg(
        jsonb_build_object(
          'name', c.column_name,
          'type', c.data_type,
          'nullable', c.is_nullable = 'YES'
        ) ORDER BY c.ordinal_position
      ) AS columns
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type IN ('BASE TABLE','VIEW')
      AND c.table_name NOT IN (
        'cofre_senhas','kurier_credenciais','historico_login',
        'historico_capturas','google_calendar_tokens','user_roles',
        'convites_cliente'
      )
      AND c.table_name NOT LIKE 'pg_%'
    GROUP BY c.table_name
    ORDER BY c.table_name
  ) t;
$$;

REVOKE ALL ON FUNCTION public.get_ia_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ia_schema() TO service_role;
