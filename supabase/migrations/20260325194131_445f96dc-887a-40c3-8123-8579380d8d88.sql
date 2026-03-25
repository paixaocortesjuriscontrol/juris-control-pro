-- Índice composto para as queries principais do painel de audiências
CREATE INDEX IF NOT EXISTS idx_audiencias_coord_status_data 
  ON public.audiencias_detectadas (coordenacao_id, status, data_audiencia);

-- Índice para busca textual por processo_numero com coordenação
CREATE INDEX IF NOT EXISTS idx_audiencias_coord_processo 
  ON public.audiencias_detectadas (coordenacao_id, processo_numero);