
-- 1. Reaper: 6min → 10min de tolerância de heartbeat
CREATE OR REPLACE FUNCTION public.reaper_execucoes_servidor_travadas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.execucoes_servidor
       SET status = 'falhou',
           finalizado_em = now(),
           erro = COALESCE(erro, '') ||
             CASE WHEN COALESCE(erro,'') = '' THEN '' ELSE ' | ' END ||
             'Heartbeat parado (' ||
             COALESCE(EXTRACT(EPOCH FROM (now() - heartbeat_at))::int, EXTRACT(EPOCH FROM (now() - iniciado_em))::int) ||
             's) — worker/VPS derrubado. Execute novamente (checkpoint preservado).',
           updated_at = now()
     WHERE status = 'executando'
       AND (
         (heartbeat_at IS NOT NULL AND heartbeat_at < now() - interval '10 minutes')
         OR (heartbeat_at IS NULL AND iniciado_em IS NOT NULL AND iniciado_em < now() - interval '10 minutes')
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$function$;

-- 2. Índice para listagem quente "últimas execuções por tipo"
CREATE INDEX IF NOT EXISTS idx_execucoes_servidor_tipo_created
  ON public.execucoes_servidor (tipo, created_at DESC);

-- 3. Índice para processos por (coordenacao, advogado responsável)
CREATE INDEX IF NOT EXISTS idx_processos_coord_advogado
  ON public.processos (coordenacao_id, advogado_responsavel_id);

-- 4. Remover índices redundantes da tabela mais escrita (publicacoes_djen_servidor)
--    Cada INSERT hoje atualiza ~10 índices; estes 3 são cobertos por índices compostos existentes.
DROP INDEX IF EXISTS public.idx_pub_djen_servidor_coord;         -- prefixo de idx_pub_djen_servidor_coord_data_dispo
DROP INDEX IF EXISTS public.idx_pub_djen_servidor_data_dispo;    -- prefixo de idx_pub_djen_servidor_data_dispo_created
DROP INDEX IF EXISTS public.idx_pub_djen_servidor_data;          -- data_publicacao não é usada em queries quentes
