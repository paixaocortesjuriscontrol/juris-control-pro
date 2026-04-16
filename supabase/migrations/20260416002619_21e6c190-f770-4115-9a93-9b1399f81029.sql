CREATE UNIQUE INDEX IF NOT EXISTS idx_processos_numero_unique 
ON public.processos (numero) 
WHERE numero IS NOT NULL;