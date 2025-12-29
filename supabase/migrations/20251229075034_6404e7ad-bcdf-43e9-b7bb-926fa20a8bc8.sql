-- Primeiro, adicionar "direito_privado" ao enum existente
ALTER TYPE public.area_atuacao ADD VALUE IF NOT EXISTS 'direito_privado';

-- Converter a coluna area de enum para text para permitir áreas dinâmicas
-- Primeiro, remover a constraint do enum
ALTER TABLE public.processos 
  ALTER COLUMN area TYPE text USING area::text;

-- Atualizar a tabela coordenacoes também
ALTER TABLE public.coordenacoes
  ALTER COLUMN area TYPE text USING area::text;

-- Atualizar a tabela profiles também
ALTER TABLE public.profiles
  ALTER COLUMN area_principal TYPE text USING area_principal::text;

-- Criar tabela de áreas para referência (não obrigatória, mas útil para listar áreas disponíveis)
CREATE TABLE IF NOT EXISTS public.areas_atuacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  cor text DEFAULT '#3B82F6',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.areas_atuacao ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Todos podem visualizar áreas ativas" 
  ON public.areas_atuacao FOR SELECT 
  USING (ativo = true);

CREATE POLICY "Admins podem gerenciar áreas" 
  ON public.areas_atuacao FOR ALL 
  USING (is_admin_or_coordenador(auth.uid()));

-- Inserir áreas existentes
INSERT INTO public.areas_atuacao (nome, slug, cor) VALUES
  ('Cível', 'civil', '#3B82F6'),
  ('Trabalhista', 'trabalhista', '#22C55E'),
  ('Empresarial', 'empresarial', '#8B5CF6'),
  ('Direito Privado', 'direito_privado', '#F59E0B')
ON CONFLICT (slug) DO NOTHING;