
ALTER TABLE public.processos ADD COLUMN advogados_identificados jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.processos.advogados_identificados IS 'Advogados identificados pela análise IA de documentos [{nome, oab, parte}]';
