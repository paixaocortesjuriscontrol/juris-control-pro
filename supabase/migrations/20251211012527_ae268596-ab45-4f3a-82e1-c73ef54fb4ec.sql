-- Add metadata column to store offset and other monitoring state
ALTER TABLE configuracoes_monitoramento 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN configuracoes_monitoramento.metadata IS 'Stores monitoring state including next_offset, last_batch_size, and last_complete_run timestamp';