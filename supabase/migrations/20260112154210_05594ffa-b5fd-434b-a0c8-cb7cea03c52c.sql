-- Adicionar coluna de preferência de email para Monitoração 360
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notificacoes_email_360 boolean NOT NULL DEFAULT false;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.profiles.notificacoes_email_360 IS 'User preference for receiving Monitoração 360 alerts by email';