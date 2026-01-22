-- Remover publicações DJEN (processos) duplicadas, mantendo a mais antiga por chave normalizada.
-- Chave: processo_numero + data_publicacao + data_disponibilizacao + head(220) do conteúdo normalizado.
-- Obs: data_publicacao/data_disponibilizacao podem ser NULL; o coalesce para 'null' mantém consistência.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        processo_numero,
        COALESCE(to_char(data_publicacao, 'YYYY-MM-DD'), 'null'),
        COALESCE(to_char(data_disponibilizacao, 'YYYY-MM-DD'), 'null'),
        left(regexp_replace(lower(coalesce(conteudo,'')), '\s+', ' ', 'g'), 220)
      ORDER BY created_at ASC
    ) AS rn
  FROM public.publicacoes_djen_processos
)
DELETE FROM public.publicacoes_djen_processos p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;