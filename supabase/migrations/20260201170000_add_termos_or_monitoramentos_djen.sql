ALTER TABLE public.monitoramentos_djen
ADD COLUMN IF NOT EXISTS termos_or TEXT[] NULL;
