WITH fontes AS (
  SELECT id_kurier,
    min(btrim(regexp_replace(substring(payload->>'Texto' from '\mTEXTO([[:upper:]À-Ÿ].*)'), '[[:space:]]+', ' ', 'g'))) AS texto
  FROM public.kurier_publicacoes_raw
  WHERE id_kurier = '3069626532'
  GROUP BY id_kurier
  HAVING count(DISTINCT btrim(regexp_replace(substring(payload->>'Texto' from '\mTEXTO([[:upper:]À-Ÿ].*)'), '[[:space:]]+', ' ', 'g'))) = 1
)
UPDATE public.publicacoes_djen p
SET conteudo = f.texto,
    resumo_ia = NULL,
    resumo_gerado_em = NULL
FROM fontes f
WHERE p.id_kurier = f.id_kurier
  AND p.fonte = 'kurier'
  AND p.processo_numero IN ('0000340-48.2026.5.18.0052','00003404820265180052')
  AND length(p.conteudo) > 0
  AND length(f.texto) > length(p.conteudo)
  AND right(f.texto, length(p.conteudo)) = p.conteudo;