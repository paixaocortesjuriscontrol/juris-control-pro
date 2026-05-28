ALTER TABLE public.kurier_credencial_coordenacoes
  ADD COLUMN IF NOT EXISTS captura_total boolean NOT NULL DEFAULT false;

UPDATE public.kurier_credencial_coordenacoes kcc
SET captura_total = true
FROM public.coordenacoes c
WHERE kcc.coordenacao_id = c.id
  AND c.kurier_captura_total = true
  AND kcc.captura_total = false;

CREATE INDEX IF NOT EXISTS idx_kcc_captura_total
  ON public.kurier_credencial_coordenacoes(coordenacao_id)
  WHERE captura_total = true;