
-- Fix overly permissive RLS on coordenacoes and membros_coordenacao tables
-- Users should only see coordinations they belong to (or are admin/coordenador)

-- 1. Fix coordenacoes: replace USING(true) with scoped policy
DROP POLICY IF EXISTS "Anyone can view coordenacoes" ON public.coordenacoes;

CREATE POLICY "Users can view their coordenacoes"
ON public.coordenacoes
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = coordenacoes.id
      AND mc.usuario_id = auth.uid()
  )
);

-- 2. Fix membros_coordenacao: replace USING(true) with scoped policy
DROP POLICY IF EXISTS "Anyone can view membros" ON public.membros_coordenacao;

CREATE POLICY "Users can view membros of their coordenacoes"
ON public.membros_coordenacao
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.membros_coordenacao mc2
    WHERE mc2.coordenacao_id = membros_coordenacao.coordenacao_id
      AND mc2.usuario_id = auth.uid()
  )
);
