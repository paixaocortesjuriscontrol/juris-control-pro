-- Remove a regra antiga, que ainda permitia repetir o mesmo anexo em instâncias diferentes
DROP INDEX IF EXISTS public.judit_anexos_dedup_uniq;

-- Deduplica anexos pelo documento lógico: processo + nome normalizado (sem "cópia") + timestamp completo + extensão.
WITH normalized AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        COALESCE(processo_numero, cnj, ''),
        regexp_replace(
          translate(
            upper(regexp_replace(trim(COALESCE(attachment_name, '')), '\s*\(C[ÓO]PIA\)\s*', '', 'gi')),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'AAAAAEEEEIIIIOOOOOUUUUCN'
          ),
          '[^A-Z0-9]+',
          '',
          'g'
        ),
        trim(COALESCE(attachment_date, '')),
        lower(trim(COALESCE(extension, '')))
      ORDER BY
        (storage_path IS NOT NULL) DESC,
        (documento_id IS NOT NULL) DESC,
        (texto_indexado IS TRUE) DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.judit_anexos
)
DELETE FROM public.judit_anexos a
USING normalized n
WHERE a.id = n.id
  AND n.rn > 1;

-- Impede que novas buscas gravem o mesmo anexo repetido novamente.
CREATE UNIQUE INDEX IF NOT EXISTS judit_anexos_logical_dedup_uniq
ON public.judit_anexos (
  COALESCE(processo_numero, cnj, ''),
  regexp_replace(
    translate(
      upper(regexp_replace(trim(COALESCE(attachment_name, '')), '\s*\(C[ÓO]PIA\)\s*', '', 'gi')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'AAAAAEEEEIIIIOOOOOUUUUCN'
    ),
    '[^A-Z0-9]+',
    '',
    'g'
  ),
  trim(COALESCE(attachment_date, '')),
  lower(trim(COALESCE(extension, '')))
);