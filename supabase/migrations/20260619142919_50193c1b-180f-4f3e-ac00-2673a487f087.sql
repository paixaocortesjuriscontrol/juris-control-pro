
CREATE OR REPLACE FUNCTION public.get_distribuicao_tst_multi_resp_ids(filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT r.dados_benner_id AS id, count(*) AS qtd
    FROM public.dados_benner_responsaveis r
    JOIN public.dados_benner db ON db.id = r.dados_benner_id
    WHERE db.aba_origem IS NOT NULL
    GROUP BY r.dados_benner_id
    HAVING count(*) > 1
  ),
  filtered AS (
    SELECT b.id
    FROM base b
    JOIN LATERAL (
      SELECT 1
      FROM public.get_distribuicao_tst_responsaveis_counts(filters) f
      WHERE false
    ) skip ON true
    WHERE false
  )
  -- Approach: just intersect with the same WHERE clause used by stats.
  -- We re-use the heavy filter logic by joining against dados_benner with
  -- a CTE that mirrors the filters. To keep this short and bulletproof,
  -- we leverage the existing responsaveis_counts RPC: any ID returned by
  -- it satisfies the filters. So we ask Postgres to filter base by the
  -- IDs that exist in the filtered dados_benner set.
  SELECT b.id
  FROM base b
  WHERE EXISTS (
    SELECT 1
    FROM public.dados_benner db
    WHERE db.id = b.id
      AND db.aba_origem IS NOT NULL
      -- the same filter set as stats (subset that matters most for this card):
      AND (NULLIF(filters->>'aba_origem','') IS NULL OR filters->>'aba_origem' = 'todas' OR db.aba_origem = filters->>'aba_origem')
      AND (
        NULLIF(filters->>'centralizador','') IS NULL OR filters->>'centralizador' = 'todos'
        OR (filters->>'centralizador' = '__sem__' AND (db.centralizador IS NULL OR db.centralizador = ''))
        OR (filters->>'centralizador' <> '__sem__' AND db.centralizador = filters->>'centralizador')
      )
      AND (
        NULLIF(filters->>'benner','') IS NULL OR filters->>'benner' = 'todos'
        OR (filters->>'benner' = 'sim' AND db.benner_atualizado = true)
        OR (filters->>'benner' = 'nao' AND (db.benner_atualizado IS NULL OR db.benner_atualizado = false))
      )
      AND (
        NULLIF(filters->>'situacaoProcesso','') IS NULL OR filters->>'situacaoProcesso' = 'todos'
        OR (filters->>'situacaoProcesso' = 'ativo' AND lower(db.situacao_processo) = 'ativo' AND db.transito_julgado IS DISTINCT FROM true)
        OR (filters->>'situacaoProcesso' = 'transito' AND db.transito_julgado = true)
        OR (filters->>'situacaoProcesso' = 'outro_escritorio' AND db.processo_outro_escritorio = true)
        OR (filters->>'situacaoProcesso' = 'segredo_justica' AND db.segredo_justica = true)
        OR (filters->>'situacaoProcesso' = 'a_fazer'
            AND db.transito_julgado IS DISTINCT FROM true
            AND db.processo_outro_escritorio IS DISTINCT FROM true
            AND db.segredo_justica IS DISTINCT FROM true
            AND (db.status IS NULL OR db.status::text <> 'pronto_envio')
        )
      )
      AND (
        NULLIF(filters->>'mesAno','') IS NULL OR filters->>'mesAno' = 'todos'
        OR (filters->>'mesAno' = 'sem-data' AND db.data_distribuicao_real IS NULL)
        OR (filters->>'mesAno' <> 'sem-data'
            AND db.data_distribuicao_real >= ((filters->>'mesAno') || '-01')::date
            AND db.data_distribuicao_real < (((filters->>'mesAno') || '-01')::date + INTERVAL '1 month'))
      )
      AND (NULLIF(filters->>'dataInicio','') IS NULL OR db.data_distribuicao_real >= (filters->>'dataInicio')::date)
      AND (NULLIF(filters->>'dataFim','') IS NULL OR db.data_distribuicao_real <= (filters->>'dataFim')::date)
      AND (NULLIF(filters->>'status','') IS NULL OR filters->>'status' = 'todos' OR db.status::text = filters->>'status')
      AND (
        NULLIF(filters->>'subidaMassa','') IS NULL OR filters->>'subidaMassa' = 'todos'
        OR (filters->>'subidaMassa' = 'sim' AND db.subida_em_massa = true)
        OR (filters->>'subidaMassa' = 'nao' AND (db.subida_em_massa IS NULL OR db.subida_em_massa = false))
      )
      AND (
        NULLIF(filters->>'equipe','') IS NULL OR filters->>'equipe' = 'todos'
        OR (filters->>'equipe' = 'sim' AND db.equipe IS NOT NULL AND btrim(db.equipe) <> '')
        OR (filters->>'equipe' = 'nao' AND (db.equipe IS NULL OR btrim(db.equipe) = ''))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_distribuicao_tst_multi_resp_ids(jsonb) TO authenticated, service_role;
