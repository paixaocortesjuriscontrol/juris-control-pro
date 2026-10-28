GRANT SELECT ON public.manutencao_restauracao_kurier TO authenticated;
CREATE POLICY "Admins veem progresso da restauração Kurier"
ON public.manutencao_restauracao_kurier FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));