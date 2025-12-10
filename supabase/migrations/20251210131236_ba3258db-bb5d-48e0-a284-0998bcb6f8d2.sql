-- Add email notification preference column to profiles
ALTER TABLE public.profiles 
ADD COLUMN notificacoes_email boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.notificacoes_email IS 'User preference for receiving email notifications';