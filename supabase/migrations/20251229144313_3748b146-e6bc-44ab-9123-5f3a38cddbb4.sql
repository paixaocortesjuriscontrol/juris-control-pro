-- Permitir data_vencimento nula em prazos
ALTER TABLE public.prazos ALTER COLUMN data_vencimento DROP NOT NULL;