
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS confianca_transito integer,
  ADD COLUMN IF NOT EXISTS data_transito_julgado date;
