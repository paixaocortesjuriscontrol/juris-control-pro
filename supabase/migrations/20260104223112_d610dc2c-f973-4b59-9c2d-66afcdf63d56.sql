-- Adicionar novas colunas para campos da planilha de Pedidos
ALTER TABLE public.processos
ADD COLUMN IF NOT EXISTS periodo_contratacao TEXT,
ADD COLUMN IF NOT EXISTS observacao_resp_subsidiaria TEXT,
ADD COLUMN IF NOT EXISTS cargo_reconhecimento_vinculo TEXT,
ADD COLUMN IF NOT EXISTS tipo_estabilidade TEXT,
ADD COLUMN IF NOT EXISTS data_situacao DATE;