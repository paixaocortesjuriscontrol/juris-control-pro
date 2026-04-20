-- Adiciona coluna erro_judit em dados_benner para marcar registros com turma inválida (fora da composição oficial 1ª-8ª Turma do TST)
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS erro_judit boolean NOT NULL DEFAULT false;

-- Índice parcial para filtragem rápida
CREATE INDEX IF NOT EXISTS idx_dados_benner_erro_judit
  ON public.dados_benner (erro_judit)
  WHERE erro_judit = true;

-- Backfill: marcar como erro_judit todos os registros preenchidos pela Judit cuja turma
-- não pertence à composição oficial atual do TST (1ª a 8ª Turma).
-- Normaliza acentos, espaços, "ª/a", caixa.
UPDATE public.dados_benner
SET erro_judit = true
WHERE judit_preenchido = true
  AND turma IS NOT NULL
  AND btrim(turma) <> ''
  AND regexp_replace(
        lower(public.unaccent(turma)),
        '\s+', ' ', 'g'
      ) !~ '^[1-8][ªa]?\s*turma$';