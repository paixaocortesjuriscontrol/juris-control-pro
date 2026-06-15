
ALTER TABLE public.execucoes_servidor
  ADD COLUMN IF NOT EXISTS progresso jsonb,
  ADD COLUMN IF NOT EXISTS progresso_atualizado_em timestamptz;

-- Habilita Realtime (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'execucoes_servidor'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.execucoes_servidor;
  END IF;
END $$;

ALTER TABLE public.execucoes_servidor REPLICA IDENTITY FULL;
