CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_monitor_data_pub_created
ON public.publicacoes_djen_descartadas (monitoramento_id, data_publicacao DESC, created_at DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_monitor_created
ON public.publicacoes_djen_descartadas (monitoramento_id, created_at DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_data_pub_created
ON public.publicacoes_djen_descartadas (data_publicacao DESC, created_at DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_created
ON public.publicacoes_djen_descartadas (created_at DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_data_disp_created
ON public.publicacoes_djen_descartadas (data_disponibilizacao DESC, created_at DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';