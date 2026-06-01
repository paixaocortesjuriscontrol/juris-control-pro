ALTER TABLE public.kurier_credencial_coordenacoes
  ADD COLUMN IF NOT EXISTS somente_djen_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.kurier_credencial_coordenacoes
  DROP CONSTRAINT IF EXISTS kurier_cred_coord_modo_exclusivo;

ALTER TABLE public.kurier_credencial_coordenacoes
  ADD CONSTRAINT kurier_cred_coord_modo_exclusivo
  CHECK (
    (CASE WHEN captura_total THEN 1 ELSE 0 END
   + CASE WHEN somente_kurier_only THEN 1 ELSE 0 END
   + CASE WHEN somente_djen_only THEN 1 ELSE 0 END) <= 1
  );