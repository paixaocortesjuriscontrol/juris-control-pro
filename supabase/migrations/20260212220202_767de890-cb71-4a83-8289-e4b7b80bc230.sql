
-- Add login attempt tracking columns to cofre_senhas
ALTER TABLE public.cofre_senhas
  ADD COLUMN IF NOT EXISTS tentativas_falhas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_erro_login timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueado_ate timestamptz;

-- Add index for quick lookup of blocked credentials
CREATE INDEX IF NOT EXISTS idx_cofre_senhas_bloqueado ON public.cofre_senhas (bloqueado_ate) WHERE bloqueado_ate IS NOT NULL;
