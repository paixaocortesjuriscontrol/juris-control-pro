
-- Remover políticas problemáticas que causam recursão infinita
DROP POLICY IF EXISTS "Users can view membros of their coordenacoes" ON public.membros_coordenacao;
DROP POLICY IF EXISTS "Users can view their coordenacoes" ON public.coordenacoes;

-- Criar função SECURITY DEFINER para verificar pertencimento sem recursão
CREATE OR REPLACE FUNCTION public.is_member_of_coordenacao(_user_id uuid, _coordenacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.membros_coordenacao mc
    WHERE mc.usuario_id = _user_id
      AND mc.coordenacao_id = _coordenacao_id
  );
$$;

-- Política para coordenacoes usando a função SECURITY DEFINER (sem recursão)
CREATE POLICY "Users can view their coordenacoes"
ON public.coordenacoes
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR public.is_member_of_coordenacao(auth.uid(), coordenacoes.id)
);

-- Política para membros_coordenacao usando a função SECURITY DEFINER (sem recursão)
CREATE POLICY "Users can view membros of their coordenacoes"
ON public.membros_coordenacao
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR membros_coordenacao.usuario_id = auth.uid()
  OR public.is_member_of_coordenacao(auth.uid(), membros_coordenacao.coordenacao_id)
);
