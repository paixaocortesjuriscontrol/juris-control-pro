-- Add UPDATE policy for movimentacoes_datajud so users can mark as read
CREATE POLICY "Users can update their coordination DataJud records"
ON public.movimentacoes_datajud
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = movimentacoes_datajud.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = movimentacoes_datajud.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);