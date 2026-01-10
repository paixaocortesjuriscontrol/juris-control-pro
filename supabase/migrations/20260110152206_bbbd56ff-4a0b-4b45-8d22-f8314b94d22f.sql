-- Adicionar campos para processos administrativos na tabela processos
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS tipo_processo TEXT DEFAULT 'judicial',
ADD COLUMN IF NOT EXISTS auto_infracao TEXT,
ADD COLUMN IF NOT EXISTS nit_fiscalizado TEXT,
ADD COLUMN IF NOT EXISTS cnpj_fiscalizado TEXT,
ADD COLUMN IF NOT EXISTS valor_multa NUMERIC,
ADD COLUMN IF NOT EXISTS data_lavratura DATE,
ADD COLUMN IF NOT EXISTS fiscal_responsavel TEXT,
ADD COLUMN IF NOT EXISTS orgao_origem TEXT;

-- Índice para filtrar por tipo de processo
CREATE INDEX IF NOT EXISTS idx_processos_tipo_processo ON public.processos(tipo_processo);

-- Índice para busca por auto de infração
CREATE INDEX IF NOT EXISTS idx_processos_auto_infracao ON public.processos(auto_infracao) WHERE auto_infracao IS NOT NULL;

-- Índice para busca por CNPJ fiscalizado
CREATE INDEX IF NOT EXISTS idx_processos_cnpj_fiscalizado ON public.processos(cnpj_fiscalizado) WHERE cnpj_fiscalizado IS NOT NULL;

-- Criar tabela para monitoramentos do e-Processo
CREATE TABLE IF NOT EXISTS public.monitoramentos_eprocesso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  numero_processo TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ultima_verificacao TIMESTAMPTZ,
  ultimo_andamento_data TIMESTAMPTZ,
  ultimo_andamento_texto TEXT,
  total_andamentos INTEGER DEFAULT 0,
  erro_ultima_verificacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NOT NULL
);

-- Índices para monitoramentos_eprocesso
CREATE INDEX IF NOT EXISTS idx_monitoramentos_eprocesso_processo_id ON public.monitoramentos_eprocesso(processo_id);
CREATE INDEX IF NOT EXISTS idx_monitoramentos_eprocesso_ativo ON public.monitoramentos_eprocesso(ativo) WHERE ativo = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoramentos_eprocesso_numero ON public.monitoramentos_eprocesso(numero_processo);

-- RLS para monitoramentos_eprocesso
ALTER TABLE public.monitoramentos_eprocesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver monitoramentos e-Processo"
ON public.monitoramentos_eprocesso
FOR SELECT
USING (true);

CREATE POLICY "Usuários autenticados podem criar monitoramentos e-Processo"
ON public.monitoramentos_eprocesso
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar monitoramentos e-Processo"
ON public.monitoramentos_eprocesso
FOR UPDATE
USING (true);

CREATE POLICY "Usuários podem deletar monitoramentos e-Processo"
ON public.monitoramentos_eprocesso
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_monitoramentos_eprocesso_updated_at
BEFORE UPDATE ON public.monitoramentos_eprocesso
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON COLUMN public.processos.tipo_processo IS 'Tipo: judicial ou administrativo';
COMMENT ON COLUMN public.processos.auto_infracao IS 'Número do Auto de Infração (processos administrativos)';
COMMENT ON COLUMN public.processos.nit_fiscalizado IS 'NIT do empregador fiscalizado';
COMMENT ON COLUMN public.processos.cnpj_fiscalizado IS 'CNPJ da empresa fiscalizada';
COMMENT ON COLUMN public.processos.valor_multa IS 'Valor da multa aplicada';
COMMENT ON COLUMN public.processos.data_lavratura IS 'Data de lavratura do auto';
COMMENT ON COLUMN public.processos.fiscal_responsavel IS 'Nome do fiscal responsável';
COMMENT ON COLUMN public.processos.orgao_origem IS 'Órgão emissor (MTE, Receita, etc.)';