
-- Drop old overloaded signatures (without p_monitoramento_id) that cause ambiguity
DROP FUNCTION IF EXISTS public.get_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text, integer, integer);
DROP FUNCTION IF EXISTS public.count_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text);
