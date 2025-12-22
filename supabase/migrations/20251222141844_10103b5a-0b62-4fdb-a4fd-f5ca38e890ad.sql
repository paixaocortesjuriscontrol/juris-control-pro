-- Create pastas table
CREATE TABLE public.pastas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  coordenacao_id UUID REFERENCES public.coordenacoes(id),
  criado_por UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pasta_id to processos (optional link)
ALTER TABLE public.processos ADD COLUMN pasta_id UUID REFERENCES public.pastas(id);

-- Add pasta_id to documentos (document can belong to folder OR process)
ALTER TABLE public.documentos ADD COLUMN pasta_id UUID REFERENCES public.pastas(id);

-- Enable RLS on pastas
ALTER TABLE public.pastas ENABLE ROW LEVEL SECURITY;

-- RLS policies for pastas
CREATE POLICY "Users can view accessible pastas"
ON public.pastas FOR SELECT
USING (
  criado_por = auth.uid() 
  OR is_admin_or_coordenador(auth.uid())
  OR coordenacao_id IN (
    SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
  )
);

CREATE POLICY "Users can create pastas"
ON public.pastas FOR INSERT
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Users can update own pastas or admins"
ON public.pastas FOR UPDATE
USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins can delete pastas"
ON public.pastas FOR DELETE
USING (is_admin_or_coordenador(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_pastas_updated_at
BEFORE UPDATE ON public.pastas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();