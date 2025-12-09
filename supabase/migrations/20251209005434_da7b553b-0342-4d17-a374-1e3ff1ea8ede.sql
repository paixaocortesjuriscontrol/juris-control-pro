-- Add ativo column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.ativo IS 'Indica se o usuário está ativo no sistema';