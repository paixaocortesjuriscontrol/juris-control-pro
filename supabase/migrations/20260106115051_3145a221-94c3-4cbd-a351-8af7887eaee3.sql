-- Adiciona processo_id na tabela audiencias_detectadas
ALTER TABLE public.audiencias_detectadas
ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.processos(id);

-- Criar índice para otimizar joins
CREATE INDEX IF NOT EXISTS idx_audiencias_detectadas_processo_id 
ON public.audiencias_detectadas(processo_id);

-- Atualizar registros existentes baseando-se no processo_numero
UPDATE public.audiencias_detectadas ad
SET processo_id = p.id
FROM public.processos p
WHERE ad.processo_id IS NULL 
  AND ad.processo_numero IS NOT NULL 
  AND p.numero = ad.processo_numero;