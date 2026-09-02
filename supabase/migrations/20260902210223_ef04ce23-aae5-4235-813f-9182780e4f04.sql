CREATE POLICY "Admins e coordenadores inserem na lista oficial"
ON public.materias_pedidos_oficiais
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Admins e coordenadores atualizam a lista oficial"
ON public.materias_pedidos_oficiais
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));