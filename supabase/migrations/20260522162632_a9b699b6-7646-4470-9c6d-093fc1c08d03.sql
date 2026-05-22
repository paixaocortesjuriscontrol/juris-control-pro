-- Índices para acelerar a listagem de publicações DJEN descartadas visíveis
-- (exclui descartes por termo não encontrado, que não entram na auditoria solicitada)

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_coord_data_pub_created
ON public.publicacoes_djen_descartadas (coordenacao_id, data_publicacao DESC, created_at DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_coord_data_disp_created
ON public.publicacoes_djen_descartadas (coordenacao_id, data_disponibilizacao DESC, created_at DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_coord_created_id
ON public.publicacoes_djen_descartadas (coordenacao_id, created_at DESC, id DESC)
WHERE motivo_descarte <> 'termo_nao_encontrado';

-- Busca por processo_numero usa ILIKE com dígitos normalizados; GIN/trigram atende buscas com contains (%...%).
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_processo_trgm
ON public.publicacoes_djen_descartadas USING gin (processo_numero gin_trgm_ops)
WHERE processo_numero IS NOT NULL
  AND motivo_descarte <> 'termo_nao_encontrado';

-- Complementa buscas por processo exato/normalizado dentro da coordenação e preserva ordenação recente.
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_coord_processo_created
ON public.publicacoes_djen_descartadas (coordenacao_id, processo_numero, created_at DESC)
WHERE processo_numero IS NOT NULL
  AND motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_coord_proc_data_pub_created
ON public.publicacoes_djen_descartadas (coordenacao_id, processo_numero, data_publicacao DESC, created_at DESC)
WHERE processo_numero IS NOT NULL
  AND motivo_descarte <> 'termo_nao_encontrado';

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_vis_coord_proc_data_disp_created
ON public.publicacoes_djen_descartadas (coordenacao_id, processo_numero, data_disponibilizacao DESC, created_at DESC)
WHERE processo_numero IS NOT NULL
  AND motivo_descarte <> 'termo_nao_encontrado';