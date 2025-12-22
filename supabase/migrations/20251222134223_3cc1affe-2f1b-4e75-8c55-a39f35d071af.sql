-- Criar tabela para resumos por monitoramento DJEN
CREATE TABLE public.resumos_monitoramento_djen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  resumo TEXT NOT NULL,
  data_busca TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  publicacoes_incluidas UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice para busca rápida
CREATE INDEX idx_resumos_monitoramento_djen_monitoramento_id ON public.resumos_monitoramento_djen(monitoramento_id);
CREATE INDEX idx_resumos_monitoramento_djen_data_busca ON public.resumos_monitoramento_djen(data_busca DESC);

-- Habilitar RLS
ALTER TABLE public.resumos_monitoramento_djen ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view resumos of own monitoramentos"
ON public.resumos_monitoramento_djen
FOR SELECT
USING (
  monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid())
  )
);

CREATE POLICY "System can insert resumos"
ON public.resumos_monitoramento_djen
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete resumos of own monitoramentos"
ON public.resumos_monitoramento_djen
FOR DELETE
USING (
  monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid())
  )
);