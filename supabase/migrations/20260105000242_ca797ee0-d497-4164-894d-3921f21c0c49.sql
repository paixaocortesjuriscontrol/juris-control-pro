-- Criar a função update_updated_at_column se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela para grupos de clientes
CREATE TABLE public.grupos_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de junção para vincular clientes a grupos
CREATE TABLE public.clientes_grupos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  grupo_id UUID NOT NULL REFERENCES public.grupos_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, grupo_id)
);

-- Enable RLS
ALTER TABLE public.grupos_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_grupos ENABLE ROW LEVEL SECURITY;

-- Policies para grupos_clientes
CREATE POLICY "Grupos são visíveis para usuários autenticados"
ON public.grupos_clientes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem criar grupos"
ON public.grupos_clientes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar grupos"
ON public.grupos_clientes FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem deletar grupos"
ON public.grupos_clientes FOR DELETE
TO authenticated
USING (true);

-- Policies para clientes_grupos
CREATE POLICY "Vínculos são visíveis para usuários autenticados"
ON public.clientes_grupos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem criar vínculos"
ON public.clientes_grupos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar vínculos"
ON public.clientes_grupos FOR DELETE
TO authenticated
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_grupos_clientes_updated_at
BEFORE UPDATE ON public.grupos_clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();