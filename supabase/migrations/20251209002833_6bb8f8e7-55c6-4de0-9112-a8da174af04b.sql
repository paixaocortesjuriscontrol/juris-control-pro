-- Phase 1: Create helper function for case access control
CREATE OR REPLACE FUNCTION public.can_access_processo(_user_id uuid, _processo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM processos p
    WHERE p.id = _processo_id
    AND (
      -- User is assigned to the case
      p.advogado_responsavel_id = _user_id
      -- OR user is admin/coordenador
      OR is_admin_or_coordenador(_user_id)
      -- OR user is in the same coordination as the case
      OR p.coordenacao_id IN (
        SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = _user_id
      )
    )
  )
$$;

-- Phase 2: Update processos RLS policies
DROP POLICY IF EXISTS "Users can view processos" ON public.processos;
CREATE POLICY "Users can view accessible processos" 
ON public.processos 
FOR SELECT 
USING (
  advogado_responsavel_id = auth.uid()
  OR is_admin_or_coordenador(auth.uid())
  OR coordenacao_id IN (
    SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
  )
);

-- Phase 3: Update clientes RLS policies
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can manage clientes" ON public.clientes;

CREATE POLICY "Users can view clientes linked to accessible processos" 
ON public.clientes 
FOR SELECT 
USING (
  is_admin_or_coordenador(auth.uid())
  OR id IN (
    SELECT DISTINCT cliente_id FROM processos p
    WHERE p.cliente_id IS NOT NULL
    AND (
      p.advogado_responsavel_id = auth.uid()
      OR p.coordenacao_id IN (
        SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Admins and coordenadores can manage clientes" 
ON public.clientes 
FOR ALL 
USING (is_admin_or_coordenador(auth.uid()));

-- Phase 4: Update documentos RLS policies
DROP POLICY IF EXISTS "Users can view documentos" ON public.documentos;

CREATE POLICY "Users can view documentos of accessible processos" 
ON public.documentos 
FOR SELECT 
USING (
  processo_id IS NULL
  OR can_access_processo(auth.uid(), processo_id)
);

-- Add UPDATE and DELETE policies for documentos
CREATE POLICY "Users can update own documentos" 
ON public.documentos 
FOR UPDATE 
USING (
  uploaded_by = auth.uid()
  OR is_admin_or_coordenador(auth.uid())
);

CREATE POLICY "Users can delete own documentos" 
ON public.documentos 
FOR DELETE 
USING (
  uploaded_by = auth.uid()
  OR is_admin_or_coordenador(auth.uid())
);

-- Phase 5: Update movimentacoes RLS policies
DROP POLICY IF EXISTS "Anyone can view movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Authenticated can insert movimentacoes" ON public.movimentacoes;

CREATE POLICY "Users can view movimentacoes of accessible processos" 
ON public.movimentacoes 
FOR SELECT 
USING (can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Users can insert movimentacoes for accessible processos" 
ON public.movimentacoes 
FOR INSERT 
WITH CHECK (can_access_processo(auth.uid(), processo_id));

-- Add UPDATE and DELETE policies for movimentacoes (admin/coordenador only)
CREATE POLICY "Admins can update movimentacoes" 
ON public.movimentacoes 
FOR UPDATE 
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins can delete movimentacoes" 
ON public.movimentacoes 
FOR DELETE 
USING (is_admin_or_coordenador(auth.uid()));

-- Phase 6: Update prazos RLS policies
DROP POLICY IF EXISTS "Users can view prazos" ON public.prazos;
DROP POLICY IF EXISTS "Authenticated can manage prazos" ON public.prazos;

CREATE POLICY "Users can view prazos of accessible processos" 
ON public.prazos 
FOR SELECT 
USING (can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Users can manage prazos of accessible processos" 
ON public.prazos 
FOR ALL 
USING (can_access_processo(auth.uid(), processo_id));

-- Phase 7: Update profiles RLS - keep basic visibility but restrict sensitive data access
-- Keeping current policy as team members need to see each other's names for case assignment