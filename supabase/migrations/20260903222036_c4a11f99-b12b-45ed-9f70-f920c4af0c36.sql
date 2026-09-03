DO $mig$
DECLARE
  f record;
  def text;
  head text := $h$v_situacoes IS NULL OR 'todos' = ANY(v_situacoes)
        OR ('pronto_enviar' = ANY(v_situacoes) AND db.status::text IN ('pronto_envio','planilhado','enviado'))
        OR ('problema_judit' = ANY(v_situacoes) AND db.problema_judit = true)
        OR ('recurso_terceiro' = ANY(v_situacoes) AND db.recurso_terceiro = true)
        OR ('acordo' = ANY(v_situacoes) AND db.acordo = true)$h$;
BEGIN
  FOR f IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc LIKE '%situacaoProcesso%'
  LOOP
    def := pg_get_functiondef(f.oid);

    -- 1) declara v_situacoes ao lado de v_situacao
    def := regexp_replace(
      def,
      'v_situacao text\s*:=\s*NULLIF\(filters->>''situacaoProcesso'', ''''\);',
      'v_situacao text := NULLIF(filters->>''situacaoProcesso'', '''');' || chr(10) ||
      '  v_situacoes text[] := CASE ' ||
      'WHEN jsonb_typeof(filters->''situacaoProcesso'') = ''array'' ' ||
      'THEN ARRAY(SELECT jsonb_array_elements_text(filters->''situacaoProcesso'')) ' ||
      'WHEN NULLIF(filters->>''situacaoProcesso'','''') IS NULL THEN NULL ' ||
      'ELSE ARRAY[filters->>''situacaoProcesso''] END;'
    );

    -- 2) comparacoes escalares viram teste de pertinencia no array
    def := regexp_replace(def, 'v_situacao = (''[a-z_]+'')', '\1 = ANY(v_situacoes)', 'g');

    -- 3) cabecalho do bloco + novas opcoes
    def := replace(def, 'v_situacao IS NULL OR ''todos'' = ANY(v_situacoes)', head);

    EXECUTE def;
  END LOOP;
END
$mig$;