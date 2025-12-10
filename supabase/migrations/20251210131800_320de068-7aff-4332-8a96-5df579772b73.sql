-- Disable email notifications for all existing users
UPDATE public.profiles SET notificacoes_email = false;

-- Change the default value for new users to false
ALTER TABLE public.profiles ALTER COLUMN notificacoes_email SET DEFAULT false;