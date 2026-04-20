-- Etapa 1: Mesclar observações em registros conflitantes e remover duplicatas
WITH extracted AS (
  SELECT
    id,
    processo AS original,
    dossie,
    (regexp_match(processo, '([0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4})'))[1] AS cnj,
    btrim(regexp_replace(replace(processo, (regexp_match(processo, '([0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4})'))[1], ''), '^[\s\)\(\-:,;]+|[\s\(\)\-:,;]+$', '', 'g')) AS obs
  FROM public.dados_benner
  WHERE aba_origem IS NOT NULL
    AND processo IS NOT NULL
    AND btrim(processo) <> ''
    AND processo !~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'
),
conflicts AS (
  SELECT e.id AS dirty_id, e.cnj, e.dossie, e.obs, d2.id AS keeper_id
  FROM extracted e
  JOIN public.dados_benner d2
    ON d2.processo = e.cnj
   AND COALESCE(d2.dossie,'') = COALESCE(e.dossie,'')
   AND d2.id <> e.id
  WHERE e.cnj IS NOT NULL AND e.obs <> ''
)
UPDATE public.dados_benner d
SET observacao_advogado = COALESCE(NULLIF(btrim(d.observacao_advogado), ''), c.obs)
FROM conflicts c
WHERE d.id = c.keeper_id;

-- Apaga linhas duplicadas (sujas) cujo CNJ + dossiê já existem em outro registro
WITH extracted AS (
  SELECT
    id, processo, dossie,
    (regexp_match(processo, '([0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4})'))[1] AS cnj
  FROM public.dados_benner
  WHERE aba_origem IS NOT NULL
    AND processo !~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'
)
DELETE FROM public.dados_benner d
USING extracted e, public.dados_benner d2
WHERE d.id = e.id
  AND e.cnj IS NOT NULL
  AND d2.processo = e.cnj
  AND COALESCE(d2.dossie,'') = COALESCE(e.dossie,'')
  AND d2.id <> e.id;

-- Etapa 2: Para os restantes (sem conflito), separar processo e observação
WITH extracted AS (
  SELECT
    id,
    processo AS original,
    (regexp_match(processo, '([0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4})'))[1] AS cnj
  FROM public.dados_benner
  WHERE aba_origem IS NOT NULL
    AND processo IS NOT NULL
    AND btrim(processo) <> ''
    AND processo !~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'
)
UPDATE public.dados_benner d
SET
  processo = e.cnj,
  observacao_advogado = COALESCE(
    NULLIF(btrim(d.observacao_advogado), ''),
    NULLIF(btrim(regexp_replace(replace(e.original, e.cnj, ''), '^[\s\)\(\-:,;]+|[\s\(\)\-:,;]+$', '', 'g')), '')
  )
FROM extracted e
WHERE d.id = e.id
  AND e.cnj IS NOT NULL;