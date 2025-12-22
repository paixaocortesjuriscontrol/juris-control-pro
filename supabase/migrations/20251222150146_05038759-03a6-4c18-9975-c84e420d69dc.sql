-- Create a security definer function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ativo FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Update processos SELECT policy to also check if user is active
DROP POLICY IF EXISTS "Users can view accessible processos" ON public.processos;
CREATE POLICY "Users can view accessible processos" ON public.processos
FOR SELECT USING (
  is_user_active(auth.uid()) AND (
    advogado_responsavel_id = auth.uid() 
    OR is_admin_or_coordenador(auth.uid()) 
    OR coordenacao_id IN (
      SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
    )
  )
);

-- Update processos UPDATE policy
DROP POLICY IF EXISTS "Users can update own processos" ON public.processos;
CREATE POLICY "Users can update own processos" ON public.processos
FOR UPDATE USING (
  is_user_active(auth.uid()) AND (
    advogado_responsavel_id = auth.uid() 
    OR is_admin_or_coordenador(auth.uid())
  )
);

-- Update processos INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert processos" ON public.processos;
CREATE POLICY "Authenticated users can insert processos" ON public.processos
FOR INSERT WITH CHECK (is_user_active(auth.uid()));

-- Update clientes policies
DROP POLICY IF EXISTS "Users can view clientes linked to accessible processos" ON public.clientes;
CREATE POLICY "Users can view clientes linked to accessible processos" ON public.clientes
FOR SELECT USING (
  is_user_active(auth.uid()) AND (
    is_admin_or_coordenador(auth.uid()) OR (id IN (
      SELECT DISTINCT p.cliente_id
      FROM processos p
      WHERE p.cliente_id IS NOT NULL AND (
        p.advogado_responsavel_id = auth.uid() 
        OR p.coordenacao_id IN (
          SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
        )
      )
    ))
  )
);

DROP POLICY IF EXISTS "Admins and coordenadores can manage clientes" ON public.clientes;
CREATE POLICY "Admins and coordenadores can manage clientes" ON public.clientes
FOR ALL USING (is_user_active(auth.uid()) AND is_admin_or_coordenador(auth.uid()));

-- Update prazos policies
DROP POLICY IF EXISTS "Users can view prazos of accessible processos or own" ON public.prazos;
CREATE POLICY "Users can view prazos of accessible processos or own" ON public.prazos
FOR SELECT USING (
  is_user_active(auth.uid()) AND (
    can_access_processo(auth.uid(), processo_id) 
    OR responsavel_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage prazos of accessible processos or own" ON public.prazos;
CREATE POLICY "Users can manage prazos of accessible processos or own" ON public.prazos
FOR ALL USING (
  is_user_active(auth.uid()) AND (
    can_access_processo(auth.uid(), processo_id) 
    OR responsavel_id = auth.uid()
  )
);

-- Update documentos policies
DROP POLICY IF EXISTS "Users can view documentos of accessible processos" ON public.documentos;
CREATE POLICY "Users can view documentos of accessible processos" ON public.documentos
FOR SELECT USING (
  is_user_active(auth.uid()) AND (
    processo_id IS NULL 
    OR can_access_processo(auth.uid(), processo_id)
  )
);

DROP POLICY IF EXISTS "Authenticated can upload documentos" ON public.documentos;
CREATE POLICY "Authenticated can upload documentos" ON public.documentos
FOR INSERT WITH CHECK (is_user_active(auth.uid()) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own documentos" ON public.documentos;
CREATE POLICY "Users can update own documentos" ON public.documentos
FOR UPDATE USING (
  is_user_active(auth.uid()) AND (
    uploaded_by = auth.uid() 
    OR is_admin_or_coordenador(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own documentos" ON public.documentos;
CREATE POLICY "Users can delete own documentos" ON public.documentos
FOR DELETE USING (
  is_user_active(auth.uid()) AND (
    uploaded_by = auth.uid() 
    OR is_admin_or_coordenador(auth.uid())
  )
);

-- Update movimentacoes policies
DROP POLICY IF EXISTS "Users can view movimentacoes of accessible processos" ON public.movimentacoes;
CREATE POLICY "Users can view movimentacoes of accessible processos" ON public.movimentacoes
FOR SELECT USING (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

DROP POLICY IF EXISTS "Users can insert movimentacoes for accessible processos" ON public.movimentacoes;
CREATE POLICY "Users can insert movimentacoes for accessible processos" ON public.movimentacoes
FOR INSERT WITH CHECK (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

-- Update pastas policies
DROP POLICY IF EXISTS "Users can view accessible pastas" ON public.pastas;
CREATE POLICY "Users can view accessible pastas" ON public.pastas
FOR SELECT USING (
  is_user_active(auth.uid()) AND (
    criado_por = auth.uid() 
    OR is_admin_or_coordenador(auth.uid()) 
    OR coordenacao_id IN (
      SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can create pastas" ON public.pastas;
CREATE POLICY "Users can create pastas" ON public.pastas
FOR INSERT WITH CHECK (is_user_active(auth.uid()) AND criado_por = auth.uid());

DROP POLICY IF EXISTS "Users can update own pastas or admins" ON public.pastas;
CREATE POLICY "Users can update own pastas or admins" ON public.pastas
FOR UPDATE USING (
  is_user_active(auth.uid()) AND (
    criado_por = auth.uid() 
    OR is_admin_or_coordenador(auth.uid())
  )
);

-- Update notificacoes policies
DROP POLICY IF EXISTS "Users can view own notificacoes" ON public.notificacoes;
CREATE POLICY "Users can view own notificacoes" ON public.notificacoes
FOR SELECT USING (is_user_active(auth.uid()) AND usuario_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notificacoes" ON public.notificacoes;
CREATE POLICY "Users can update own notificacoes" ON public.notificacoes
FOR UPDATE USING (is_user_active(auth.uid()) AND usuario_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notificacoes" ON public.notificacoes;
CREATE POLICY "Users can delete own notificacoes" ON public.notificacoes
FOR DELETE USING (is_user_active(auth.uid()) AND usuario_id = auth.uid());