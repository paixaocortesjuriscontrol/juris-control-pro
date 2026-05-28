ALTER TABLE public.monitoramentos_djen 
  ADD COLUMN IF NOT EXISTS somente_kurier boolean NOT NULL DEFAULT false;

-- Migrar dados antigos: monitoramentos criados com tipo='kurier_only' (abordagem anterior)
-- viram tipo='palavra-chave' com somente_kurier=true
UPDATE public.monitoramentos_djen 
SET somente_kurier = true, tipo = 'palavra-chave'
WHERE tipo = 'kurier_only';