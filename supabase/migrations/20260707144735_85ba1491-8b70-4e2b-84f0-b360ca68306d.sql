-- Deduplicação Kurier por conteúdo real da publicação.
-- Motivo: o Kurier pode enviar vários id_kurier diferentes para o mesmo processo/data/conteúdo.

-- 1) Remove duplicatas Kurier já existentes, mantendo a mais antiga por dedup_conteudo_key.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY dedup_conteudo_key
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.publicacoes_djen
  WHERE fonte = 'kurier'
    AND status = 'encontrada'::public.djen_status
    AND dedup_conteudo_key IS NOT NULL
)
DELETE FROM public.publicacoes_djen p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Índice para consultas por essa chave.
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_kurier_conteudo_key
  ON public.publicacoes_djen (dedup_conteudo_key)
  WHERE fonte = 'kurier'
    AND dedup_conteudo_key IS NOT NULL;

-- 3) Trava definitiva: Kurier não pode ter duas publicações encontradas com o mesmo conteúdo deduplicado.
CREATE UNIQUE INDEX IF NOT EXISTS publicacoes_djen_kurier_conteudo_unique_idx
  ON public.publicacoes_djen (dedup_conteudo_key)
  WHERE fonte = 'kurier'
    AND status = 'encontrada'::public.djen_status
    AND dedup_conteudo_key IS NOT NULL;