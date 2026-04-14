-- Add new columns for SENAI/SESI import
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS objeto text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS natureza_financeira text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS entidade text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS calculo_validado text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS rateio text;