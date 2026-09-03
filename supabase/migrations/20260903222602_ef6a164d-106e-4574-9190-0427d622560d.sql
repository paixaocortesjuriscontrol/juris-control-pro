CREATE OR REPLACE FUNCTION public.jsonb_text_array(j jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN j IS NULL OR jsonb_typeof(j) = 'null' THEN NULL
    WHEN jsonb_typeof(j) = 'array' THEN NULLIF(ARRAY(SELECT x FROM jsonb_array_elements_text(j) x WHERE x <> ''), '{}')
    WHEN NULLIF(j #>> '{}', '') IS NULL THEN NULL
    ELSE ARRAY[j #>> '{}']
  END
$$;

DO $mig$
DECLARE
  f record;
  def text;
  tag_old text := '        NULLIF(filters->>''tagId'','''') IS NULL' || chr(10) || '        OR filters->>''tagId'' = ''todas''';
  tag_new text := '        public.jsonb_text_array(filters->''tagId'') IS NULL' || chr(10) ||
                  '        OR ''todas'' = ANY(public.jsonb_text_array(filters->''tagId''))' || chr(10) ||
                  '        OR (jsonb_typeof(filters->''tagId'') = ''array'' AND EXISTS (' || chr(10) ||
                  '              SELECT 1 FROM public.dados_benner_processo_tags t' || chr(10) ||
                  '              WHERE t.dado_benner_id = db.id' || chr(10) ||
                  '                AND t.tag_id::text = ANY(public.jsonb_text_array(filters->''tagId''))))';
  ped text := 'AND (' || chr(10) ||
    '        NULLIF(filters->>''pedidosDossie'','''') IS NULL OR filters->>''pedidosDossie'' = ''todos''' || chr(10) ||
    '        OR (filters->>''pedidosDossie'' = ''com'' AND db.dossie IS NOT NULL AND db.dossie <> '''' AND EXISTS (' || chr(10) ||
    '              SELECT 1 FROM public.pedidos_por_dossie pd WHERE pd.dossie = db.dossie))' || chr(10) ||
    '        OR (filters->>''pedidosDossie'' = ''sem'' AND (db.dossie IS NULL OR db.dossie = '''' OR NOT EXISTS (' || chr(10) ||
    '              SELECT 1 FROM public.pedidos_por_dossie pd WHERE pd.dossie = db.dossie)))' || chr(10) ||
    '      )' || chr(10) || '      ';
BEGIN
  FOR f IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc LIKE '%situacaoProcesso%'
  LOOP
    def := pg_get_functiondef(f.oid);

    -- TAGs: aceita lista de tags
    def := replace(def, tag_old, tag_new);

    -- Situação do processo (versão inline usada em multi_resp_ids): aceita lista
    def := replace(def, 'NULLIF(filters->>''situacaoProcesso'','''') IS NULL',
                        'public.jsonb_text_array(filters->''situacaoProcesso'') IS NULL');
    def := regexp_replace(def, 'filters->>''situacaoProcesso'' = (''[a-z_]+'')',
                          '\1 = ANY(public.jsonb_text_array(filters->''situacaoProcesso''))', 'g');

    -- Matérias por dossiê
    IF position('v_subida IS NULL' in def) > 0 THEN
      def := replace(def, 'AND (' || chr(10) || '        v_subida IS NULL', ped || 'AND (' || chr(10) || '        v_subida IS NULL');
    ELSE
      def := replace(def, 'AND (NULLIF(filters->>''dataInicio'','''') IS NULL', ped || 'AND (NULLIF(filters->>''dataInicio'','''') IS NULL');
    END IF;

    EXECUTE def;
  END LOOP;
END
$mig$;

REVOKE ALL ON FUNCTION public.jsonb_text_array(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jsonb_text_array(jsonb) TO authenticated, service_role;