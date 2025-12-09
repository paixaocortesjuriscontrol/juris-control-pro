-- Table for DJEN monitoring configurations
CREATE TABLE public.monitoramentos_djen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('palavra-chave', 'advogado', 'processo')),
  termo_busca TEXT NOT NULL,
  oab TEXT,
  uf TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for found DJEN publications (to track what's new)
CREATE TABLE public.publicacoes_djen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  hash_conteudo TEXT NOT NULL,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  processo_numero TEXT,
  conteudo TEXT,
  fonte TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for in-app notifications
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'warning', 'success', 'djen')),
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  dados JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate publications
CREATE UNIQUE INDEX idx_publicacoes_djen_hash ON public.publicacoes_djen(monitoramento_id, hash_conteudo);

-- Enable RLS
ALTER TABLE public.monitoramentos_djen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacoes_djen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies for monitoramentos_djen
CREATE POLICY "Users can view own monitoramentos"
  ON public.monitoramentos_djen FOR SELECT
  USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Users can create monitoramentos"
  ON public.monitoramentos_djen FOR INSERT
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Users can update own monitoramentos"
  ON public.monitoramentos_djen FOR UPDATE
  USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Users can delete own monitoramentos"
  ON public.monitoramentos_djen FOR DELETE
  USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

-- RLS policies for publicacoes_djen
CREATE POLICY "Users can view publicacoes of own monitoramentos"
  ON public.publicacoes_djen FOR SELECT
  USING (monitoramento_id IN (
    SELECT id FROM public.monitoramentos_djen 
    WHERE criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid())
  ));

CREATE POLICY "System can insert publicacoes"
  ON public.publicacoes_djen FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update publicacoes of own monitoramentos"
  ON public.publicacoes_djen FOR UPDATE
  USING (monitoramento_id IN (
    SELECT id FROM public.monitoramentos_djen 
    WHERE criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid())
  ));

-- RLS policies for notificacoes
CREATE POLICY "Users can view own notificacoes"
  ON public.notificacoes FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY "System can insert notificacoes"
  ON public.notificacoes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notificacoes"
  ON public.notificacoes FOR UPDATE
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can delete own notificacoes"
  ON public.notificacoes FOR DELETE
  USING (usuario_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_monitoramentos_djen_updated_at
  BEFORE UPDATE ON public.monitoramentos_djen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();