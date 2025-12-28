-- Adicionar novos campos à tabela processos para suportar importação Dr. Osmar (Rede D'Or)
ALTER TABLE public.processos
ADD COLUMN IF NOT EXISTS unidade_cliente text,
ADD COLUMN IF NOT EXISTS sigla_unidade text,
ADD COLUMN IF NOT EXISTS tipo_controladora text,
ADD COLUMN IF NOT EXISTS cpf_cnpj_parte_contraria text,
ADD COLUMN IF NOT EXISTS data_fato_gerador text,
ADD COLUMN IF NOT EXISTS pedidos text,
ADD COLUMN IF NOT EXISTS funcao_parte_contraria text,
ADD COLUMN IF NOT EXISTS periodo_laborado text,
ADD COLUMN IF NOT EXISTS andamento_atual text,
ADD COLUMN IF NOT EXISTS esfera text,
ADD COLUMN IF NOT EXISTS natureza text,
ADD COLUMN IF NOT EXISTS materia text,
ADD COLUMN IF NOT EXISTS terceiro_envolvido text,
ADD COLUMN IF NOT EXISTS provisionamento_provavel numeric,
ADD COLUMN IF NOT EXISTS provisionamento_possivel numeric,
ADD COLUMN IF NOT EXISTS provisionamento_remoto numeric,
ADD COLUMN IF NOT EXISTS valor_pagamento numeric,
ADD COLUMN IF NOT EXISTS tipo_pagamento text,
ADD COLUMN IF NOT EXISTS forma_pagamento text,
ADD COLUMN IF NOT EXISTS valor_pago numeric,
ADD COLUMN IF NOT EXISTS deposito_judicial numeric,
ADD COLUMN IF NOT EXISTS observacoes_processo text;

-- Criar índice para busca por sigla_unidade
CREATE INDEX IF NOT EXISTS idx_processos_sigla_unidade ON public.processos(sigla_unidade);

-- Criar índice para busca por unidade_cliente
CREATE INDEX IF NOT EXISTS idx_processos_unidade_cliente ON public.processos(unidade_cliente);

COMMENT ON COLUMN public.processos.unidade_cliente IS 'Nome completo da unidade (Hospital DF Star, etc)';
COMMENT ON COLUMN public.processos.sigla_unidade IS 'Sigla da unidade (DF STAR, HCORACAO, etc)';
COMMENT ON COLUMN public.processos.tipo_controladora IS 'Controladora ou Consolidado';
COMMENT ON COLUMN public.processos.provisionamento_provavel IS 'Valor provável de provisionamento';
COMMENT ON COLUMN public.processos.provisionamento_possivel IS 'Valor possível de provisionamento';
COMMENT ON COLUMN public.processos.provisionamento_remoto IS 'Valor remoto de provisionamento';
COMMENT ON COLUMN public.processos.andamento_atual IS 'Descrição do andamento atual do processo';