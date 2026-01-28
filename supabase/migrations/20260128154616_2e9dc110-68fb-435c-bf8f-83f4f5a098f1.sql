-- Tabela para depósitos recursais
CREATE TABLE public.depositos_recursais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data_pagamento DATE NOT NULL,
  titulo TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id)
);

-- Tabela para custas processuais
CREATE TABLE public.custas_processuais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data_pagamento DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_depositos_recursais_processo ON public.depositos_recursais(processo_id);
CREATE INDEX idx_custas_processuais_processo ON public.custas_processuais(processo_id);

-- Triggers para updated_at
CREATE TRIGGER update_depositos_recursais_updated_at
  BEFORE UPDATE ON public.depositos_recursais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custas_processuais_updated_at
  BEFORE UPDATE ON public.custas_processuais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.depositos_recursais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custas_processuais ENABLE ROW LEVEL SECURITY;

-- Políticas para depósitos recursais
CREATE POLICY "Usuários autenticados podem ver depósitos" 
  ON public.depositos_recursais FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar depósitos" 
  ON public.depositos_recursais FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar depósitos" 
  ON public.depositos_recursais FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar depósitos" 
  ON public.depositos_recursais FOR DELETE 
  USING (auth.uid() IS NOT NULL);

-- Políticas para custas processuais
CREATE POLICY "Usuários autenticados podem ver custas" 
  ON public.custas_processuais FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar custas" 
  ON public.custas_processuais FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar custas" 
  ON public.custas_processuais FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar custas" 
  ON public.custas_processuais FOR DELETE 
  USING (auth.uid() IS NOT NULL);