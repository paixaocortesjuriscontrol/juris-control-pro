CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_datadisp_coord
ON public.publicacoes_djen (data_disponibilizacao DESC, coordenacao_id);