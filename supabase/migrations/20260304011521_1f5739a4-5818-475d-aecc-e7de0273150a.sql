-- Add unique index for upsert deduplication on alertas_processos_nao_cadastrados
CREATE UNIQUE INDEX IF NOT EXISTS idx_alertas_proc_nao_cad_dedup 
ON public.alertas_processos_nao_cadastrados (processo_numero, termo_id);