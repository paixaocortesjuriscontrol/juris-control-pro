-- 1) Índice de cobertura para busca por TAG (índice-only scan)
CREATE INDEX IF NOT EXISTS idx_dbpt_tag_dado
  ON public.dados_benner_processo_tags (tag_id, dado_benner_id);

CREATE INDEX IF NOT EXISTS idx_dbpt_dado_tag
  ON public.dados_benner_processo_tags (dado_benner_id, tag_id);

-- 2) Cast seguro para uuid
CREATE OR REPLACE FUNCTION public.try_uuid(_txt text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN _txt::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_uuid(text) TO anon, authenticated, service_role;

-- 3) Injeta o filtro nativo por TAG nas RPCs da Distribuição TST
DO $do$
DECLARE
  r record;
  src text;
  novo text;
  pred text := $pred$db.aba_origem IS NOT NULL AND (
        NULLIF(filters->>'tagId','') IS NULL
        OR filters->>'tagId' = 'todas'
        OR (filters->>'tagId' = '__sem__' AND NOT EXISTS (
              SELECT 1 FROM public.dados_benner_processo_tags t
              WHERE t.dado_benner_id = db.id))
        OR (public.try_uuid(filters->>'tagId') IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.dados_benner_processo_tags t
              WHERE t.dado_benner_id = db.id
                AND t.tag_id = public.try_uuid(filters->>'tagId')))
      )$pred$;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_distribuicao_tst_responsaveis_counts',
        'get_distribuicao_tst_situacao_totais',
        'get_distribuicao_tst_stats',
        'get_distribuicao_tst_multi_resp_ids'
      )
  LOOP
    src := pg_get_functiondef(r.oid);
    IF position('tagId' in src) > 0 THEN
      CONTINUE; -- já possui filtro por TAG
    END IF;
    novo := replace(src, 'db.aba_origem IS NOT NULL', pred);
    IF novo = src THEN
      RAISE EXCEPTION 'Ancora nao encontrada em %', r.proname;
    END IF;
    EXECUTE novo;
  END LOOP;
END
$do$;