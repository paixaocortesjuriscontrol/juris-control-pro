-- Adicionar campo para controlar se o processo deve ter os andamentos monitorados
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS monitorar_andamentos boolean NOT NULL DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN public.processos.monitorar_andamentos IS 'Indica se o processo deve ter seus andamentos buscados pelo monitoramento automático';