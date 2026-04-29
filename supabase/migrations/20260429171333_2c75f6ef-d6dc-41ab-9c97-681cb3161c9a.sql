-- Excluir todas as publicações do DJET Pautas
-- Identificadas por tipo_publicacao = 'pauta' ou fonte = 'dejt-pdf'

-- Primeiro remove leituras associadas (se houver tabela de leituras)
DELETE FROM public.publicacoes_djen_leituras
WHERE publicacao_id IN (
  SELECT id FROM public.publicacoes_djen
  WHERE tipo_publicacao = 'pauta' OR fonte = 'dejt-pdf'
);

-- Remove as publicações DJET Pautas
DELETE FROM public.publicacoes_djen
WHERE tipo_publicacao = 'pauta' OR fonte = 'dejt-pdf';