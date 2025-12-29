-- Criar bucket para repositório de documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('repositorio_documentos', 'repositorio_documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket
CREATE POLICY "Advogados podem fazer upload de documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'repositorio_documentos');

CREATE POLICY "Advogados podem visualizar documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'repositorio_documentos');

CREATE POLICY "Admins podem deletar documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'repositorio_documentos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'coordenador')
  )
);

-- Tabela para metadados dos documentos
CREATE TABLE public.repositorio_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  descricao TEXT,
  tipo_documento TEXT,
  tags TEXT[],
  tamanho_bytes BIGINT,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  processado BOOLEAN DEFAULT false,
  erro_processamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.repositorio_documentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Advogados podem ver todos os documentos"
ON public.repositorio_documentos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Advogados podem inserir documentos"
ON public.repositorio_documentos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Admins podem atualizar documentos"
ON public.repositorio_documentos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'coordenador')
  )
);

CREATE POLICY "Admins podem deletar documentos"
ON public.repositorio_documentos FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'coordenador')
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_repositorio_documentos_updated_at
BEFORE UPDATE ON public.repositorio_documentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Tabela para conversas com IA
CREATE TABLE public.repositorio_conversas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  titulo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repositorio_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem suas próprias conversas"
ON public.repositorio_conversas FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários criam suas próprias conversas"
ON public.repositorio_conversas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

CREATE TRIGGER update_repositorio_conversas_updated_at
BEFORE UPDATE ON public.repositorio_conversas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Tabela para mensagens das conversas
CREATE TABLE public.repositorio_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.repositorio_conversas(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  documentos_referenciados UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repositorio_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem mensagens de suas conversas"
ON public.repositorio_mensagens FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.repositorio_conversas 
    WHERE id = conversa_id AND usuario_id = auth.uid()
  )
);

CREATE POLICY "Usuários inserem mensagens em suas conversas"
ON public.repositorio_mensagens FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.repositorio_conversas 
    WHERE id = conversa_id AND usuario_id = auth.uid()
  )
);