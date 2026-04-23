-- Limpar campo processo da tela Distribuição TST: extrair número CNJ e mover anotações para observacao_advogado
WITH sujos AS (
  SELECT
    id,
    processo,
    dossie,
    observacao_advogado,
    (regexp_match(processo, '([0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4})'))[1] AS numero_limpo,
    btrim(regexp_replace(
      regexp_replace(processo, '([0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4})', '', 'g'),
      '^[\s\*\)\(\-:;,\.]+|[\s\*\)\(\-:;,\.]+$', '', 'g'
    )) AS anotacao
  FROM public.dados_benner
  WHERE tribunal = 'TST'
    AND processo IS NOT NULL
    AND processo !~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'
),
sujos_validos AS (
  SELECT * FROM sujos WHERE numero_limpo IS NOT NULL
),
-- Para cada sujo, verifica se já existe um registro com o número limpo (mesmo par processo+dossie)
com_conflito AS (
  SELECT s.id AS sujo_id, s.numero_limpo, s.dossie, s.anotacao, d.id AS limpo_id, d.observacao_advogado AS obs_limpo
  FROM sujos_validos s
  JOIN public.dados_benner d
    ON d.tribunal = 'TST'
   AND d.id <> s.id
   AND d.processo = s.numero_limpo
   AND COALESCE(d.dossie, '') = COALESCE(s.dossie, '')
),
-- 1) Anexa anotação ao registro limpo existente
upd_limpo AS (
  UPDATE public.dados_benner d
  SET observacao_advogado = btrim(
    COALESCE(NULLIF(d.observacao_advogado, ''), '') ||
    CASE WHEN COALESCE(NULLIF(d.observacao_advogado, ''), '') <> '' AND c.anotacao <> '' THEN ' | ' ELSE '' END ||
    c.anotacao
  ),
  updated_at = now()
  FROM com_conflito c
  WHERE d.id = c.limpo_id AND c.anotacao <> ''
  RETURNING d.id
),
-- 2) Apaga responsáveis dos registros sujos com conflito
del_resp AS (
  DELETE FROM public.dados_benner_responsaveis r
  USING com_conflito c
  WHERE r.dados_benner_id = c.sujo_id
  RETURNING r.id
),
-- 3) Apaga os registros sujos com conflito
del_sujos AS (
  DELETE FROM public.dados_benner d
  USING com_conflito c
  WHERE d.id = c.sujo_id
  RETURNING d.id
),
-- 4) Para os sujos SEM conflito: atualiza processo + anexa anotação em observacao_advogado
sem_conflito AS (
  SELECT s.* FROM sujos_validos s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.dados_benner d
    WHERE d.tribunal = 'TST' AND d.id <> s.id
      AND d.processo = s.numero_limpo
      AND COALESCE(d.dossie, '') = COALESCE(s.dossie, '')
  )
)
UPDATE public.dados_benner d
SET
  processo = s.numero_limpo,
  observacao_advogado = btrim(
    COALESCE(NULLIF(d.observacao_advogado, ''), '') ||
    CASE WHEN COALESCE(NULLIF(d.observacao_advogado, ''), '') <> '' AND s.anotacao <> '' THEN ' | ' ELSE '' END ||
    s.anotacao
  ),
  updated_at = now()
FROM sem_conflito s
WHERE d.id = s.id;