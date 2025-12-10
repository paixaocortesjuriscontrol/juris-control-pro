-- Create table for PJE monitoring configurations
CREATE TABLE public.monitoramentos_pje (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('palavra-chave', 'advogado', 'processo')),
  termo_busca TEXT NOT NULL,
  oab TEXT,
  uf TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for PJE publications found
CREATE TABLE public.publicacoes_pje (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_pje(id) ON DELETE CASCADE,
  hash_conteudo TEXT NOT NULL,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  processo_numero TEXT,
  conteudo TEXT,
  fonte TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(monitoramento_id, hash_conteudo)
);

-- Enable RLS
ALTER TABLE public.monitoramentos_pje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacoes_pje ENABLE ROW LEVEL SECURITY;

-- RLS policies for monitoramentos_pje
CREATE POLICY "Users can view their own PJE monitoring" 
ON public.monitoramentos_pje FOR SELECT 
USING (auth.uid() = criado_por);

CREATE POLICY "Users can create their own PJE monitoring" 
ON public.monitoramentos_pje FOR INSERT 
WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Users can update their own PJE monitoring" 
ON public.monitoramentos_pje FOR UPDATE 
USING (auth.uid() = criado_por);

CREATE POLICY "Users can delete their own PJE monitoring" 
ON public.monitoramentos_pje FOR DELETE 
USING (auth.uid() = criado_por);

-- RLS policies for publicacoes_pje
CREATE POLICY "Users can view PJE publications from their monitorings" 
ON public.publicacoes_pje FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.monitoramentos_pje m 
    WHERE m.id = monitoramento_id AND m.criado_por = auth.uid()
  )
);

CREATE POLICY "Users can update PJE publications from their monitorings" 
ON public.publicacoes_pje FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.monitoramentos_pje m 
    WHERE m.id = monitoramento_id AND m.criado_por = auth.uid()
  )
);

-- Add index for performance
CREATE INDEX idx_monitoramentos_pje_criado_por ON public.monitoramentos_pje(criado_por);
CREATE INDEX idx_publicacoes_pje_monitoramento_id ON public.publicacoes_pje(monitoramento_id);