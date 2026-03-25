-- Adicionar coluna de prioridade DJEN
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS prioridade_djen boolean NOT NULL DEFAULT false;

-- Índice para buscar processos prioritários primeiro no monitoramento
CREATE INDEX IF NOT EXISTS idx_processos_prioridade_djen 
  ON public.processos (prioridade_djen DESC, numero) 
  WHERE monitorar_djen = true;

-- Marcar todos os processos do BRADESCO como prioridade
UPDATE public.processos p
SET prioridade_djen = true
FROM public.clientes c
WHERE p.cliente_id = c.id
  AND upper(c.nome) LIKE '%BRADESCO%'
  AND p.monitorar_djen = true;