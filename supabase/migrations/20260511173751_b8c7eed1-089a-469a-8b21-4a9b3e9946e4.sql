
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS centralizador text,
  ADD COLUMN IF NOT EXISTS comarca text,
  ADD COLUMN IF NOT EXISTS juizo text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS objeto_padrao text,
  ADD COLUMN IF NOT EXISTS assunto text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS subcategoria text;
