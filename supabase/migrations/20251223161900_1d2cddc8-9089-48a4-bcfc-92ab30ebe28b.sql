
-- Remover o check constraint antigo
ALTER TABLE public.monitoramentos_djen DROP CONSTRAINT monitoramentos_djen_tipo_check;

-- Adicionar novo check constraint com todos os tipos necessários
ALTER TABLE public.monitoramentos_djen 
ADD CONSTRAINT monitoramentos_djen_tipo_check 
CHECK (tipo = ANY (ARRAY['palavra-chave'::text, 'advogado'::text, 'processo'::text, 'nome'::text, 'parte'::text]));
