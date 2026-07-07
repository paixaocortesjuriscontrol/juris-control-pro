-- Correção final: a trava precisa valer para qualquer status do Kurier,
-- porque o gatilho pode marcar a repetição como 'duplicada' antes da gravação.

-- 1) Remove duplicatas Kurier em qualquer status, mantendo preferencialmente a encontrada mais antiga.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY dedup_conteudo_key
      ORDER BY
        CASE WHEN status = 'encontrada'::public.djen_status THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.publicacoes_djen
  WHERE fonte = 'kurier'
    AND dedup_conteudo_key IS NOT NULL
)
DELETE FROM public.publicacoes_djen p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Remove a trava parcial anterior, que só valia para status encontrada.
DROP INDEX IF EXISTS public.publicacoes_djen_kurier_conteudo_unique_idx;

-- 3) Trava definitiva: não permite repetir o mesmo conteúdo Kurier em nenhum status.
CREATE UNIQUE INDEX IF NOT EXISTS publicacoes_djen_kurier_conteudo_any_status_unique_idx
  ON public.publicacoes_djen (dedup_conteudo_key)
  WHERE fonte = 'kurier'
    AND dedup_conteudo_key IS NOT NULL;