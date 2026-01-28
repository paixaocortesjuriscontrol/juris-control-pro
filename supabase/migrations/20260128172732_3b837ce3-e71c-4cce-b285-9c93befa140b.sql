-- Tabela para pedidos trabalhistas detalhados (editáveis)
CREATE TABLE public.pedidos_processo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  pedido TEXT NOT NULL,
  valor_pedido NUMERIC(15,2),
  lei TEXT,
  data DATE,
  sentenca BOOLEAN DEFAULT false,
  juiz_sentenca TEXT,
  acordao BOOLEAN DEFAULT false,
  desembargador_turma TEXT,
  tst BOOLEAN DEFAULT false,
  ministro_turma_sessao TEXT,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pedidos_processo ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view pedidos" 
ON public.pedidos_processo 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pedidos" 
ON public.pedidos_processo 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pedidos" 
ON public.pedidos_processo 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pedidos" 
ON public.pedidos_processo 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_pedidos_processo_updated_at
BEFORE UPDATE ON public.pedidos_processo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_pedidos_processo_processo_id ON public.pedidos_processo(processo_id);