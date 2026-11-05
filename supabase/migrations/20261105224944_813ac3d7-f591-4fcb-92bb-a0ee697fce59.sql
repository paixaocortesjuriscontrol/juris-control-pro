ALTER TABLE public.dados_benner ADD COLUMN IF NOT EXISTS data_publicacao_djen date;

DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.gerar_distribuicoes_tst_auto'::regproc);
  src := replace(src, E'    IF tag IS NOT NULL AND NOT EXISTS', E'    UPDATE dados_benner SET data_publicacao_djen = coalesce(data_publicacao_djen, d) WHERE id = bid;\n    IF tag IS NOT NULL AND NOT EXISTS');
  EXECUTE src;
END $$;

UPDATE dados_benner b SET data_publicacao_djen = x.d
FROM (
  SELECT regexp_replace(p.processo_numero,'\D','','g') dig, min((p.data_publicacao AT TIME ZONE 'America/Sao_Paulo')::date) d
  FROM publicacoes_djen p
  WHERE p.coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5' AND p.tipo_comunicacao ILIKE '%lista de distribui%'
  GROUP BY 1
) x
WHERE b.importado_djen_em IS NOT NULL AND b.data_publicacao_djen IS NULL
  AND regexp_replace(b.processo,'\D','','g') = x.dig;