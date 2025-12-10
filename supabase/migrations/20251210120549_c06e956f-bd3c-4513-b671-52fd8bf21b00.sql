-- Add filial column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS filial text;

-- Create index for filial queries
CREATE INDEX IF NOT EXISTS idx_profiles_filial ON public.profiles(filial);

-- Add the new roles if they don't exist (check first)
-- The app_role enum should have: admin, coordenador, advogado, estagiario, assistente, secretaria
DO $$
BEGIN
  -- Add 'estagiario' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'estagiario' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'estagiario';
  END IF;
  
  -- Add 'assistente' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assistente' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'assistente';
  END IF;
  
  -- Add 'secretaria' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'secretaria' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'secretaria';
  END IF;
END $$;